"""
FastAPI Backend for LinkedIn Crawler Scheduler
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime
import os
import sys
import json
import re
from pathlib import Path
import requests
from bs4 import BeautifulSoup
import pika

# Add crawler to path
sys.path.append(str(Path(__file__).parent.parent / "crawler"))

from scheduler_service import SchedulerService
from database import Database

app = FastAPI(title="LinkedIn Crawler API", version="1.0.0")

# CORS - Allow Vercel and localhost
ALLOWED_ORIGINS = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"),  # From env or default
    "http://localhost:3000",  # Local dev primary
    "http://localhost:3001",  # Local dev alternate
    "https://*.vercel.app",  # All Vercel preview deployments
]

# Parse CORS_ORIGINS from env (comma-separated)
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    ALLOWED_ORIGINS.extend([origin.strip() for origin in cors_origins_env.split(",") if origin.strip()])

# Filter out empty strings and duplicates
ALLOWED_ORIGINS = list(set([origin for origin in ALLOWED_ORIGINS if origin]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",  # Regex for Vercel domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
db = None
scheduler = None

# RabbitMQ configuration (from environment variables)
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST')
RABBITMQ_PORT = int(os.getenv('RABBITMQ_PORT', '5672'))
RABBITMQ_USER = os.getenv('RABBITMQ_USER')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS')
RABBITMQ_VHOST = os.getenv('RABBITMQ_VHOST', '/')
RABBITMQ_QUEUE = os.getenv('RABBITMQ_QUEUE', 'linkedin_profiles')
OUTREACH_QUEUE = os.getenv('OUTREACH_QUEUE', 'outreach_queue')

# Try to initialize database and scheduler, but continue without them if it fails
def init_services():
    global db, scheduler
    try:
        db = Database()
        scheduler = SchedulerService(db)
        print("✓ Database and Scheduler initialized")
        return True
    except Exception as e:
        print(f"⚠ Database initialization failed: {e}")
        print("  Running in limited mode (requirements generator only)")
        db = None
        scheduler = None
        return False

# Pydantic models
class ScheduleCreate(BaseModel):
    name: str
    start_schedule: str  # cron expression
    stop_schedule: Optional[str] = None  # cron expression
    profile_urls: List[str] = []  # URLs to crawl
    max_workers: int = 3

class ScheduleUpdate(BaseModel):
    name: Optional[str] = None
    start_schedule: Optional[str] = None
    stop_schedule: Optional[str] = None
    status: Optional[str] = None  # 'active' or 'paused'
    profile_urls: Optional[List[str]] = None
    max_workers: Optional[int] = None

class RequirementsGenerateRequest(BaseModel):
    url: Optional[str] = None
    job_description: Optional[str] = None
    position: str
    min_experience_years: Optional[int] = 1
    required_gender: Optional[str] = None
    required_location: Optional[str] = None
    required_age_range: Optional[Dict[str, int]] = None

class RequirementsSaveRequest(BaseModel):
    requirements: Dict
    filename: str

class OutreachRequest(BaseModel):
    leads: List[Dict[str, str]]  # [{"id": "...", "name": "...", "profile_url": "..."}]
    message: str
    dry_run: bool = True

class WebhookLeadInsert(BaseModel):
    """Webhook payload from Supabase trigger"""
    type: str  # 'INSERT', 'UPDATE', 'DELETE'
    table: str
    record: Dict  # New lead data
    old_record: Optional[Dict] = None

class InstantCrawlRequest(BaseModel):
    """Request to crawl single profile immediately"""
    profile_url: str
    template_id: Optional[str] = None
    requirements_id: Optional[str] = 'default'


@app.on_event("startup")
async def startup_event():
    """Initialize database and start scheduler"""
    init_services()
    if db and scheduler:
        db.init_db()
        scheduler.start()
        print("✓ Scheduler started")
    else:
        print("⚠ Running without scheduler (database not available)")

@app.on_event("shutdown")
async def shutdown_event():
    """Stop scheduler gracefully"""
    if scheduler:
        scheduler.stop()
        print("✓ Scheduler stopped")


# Health check
@app.get("/")
async def root():
    return {
        "message": "LinkedIn Crawler API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "scheduler_running": scheduler.is_running() if scheduler else False,
        "database_available": db is not None,
        "timestamp": datetime.now().isoformat()
    }


# Schedule endpoints
@app.get("/api/schedules")
async def get_schedules():
    """Get all scheduled jobs"""
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")
    schedules = db.get_all_schedules()
    return {"schedules": schedules}

@app.get("/api/schedules/{schedule_id}")
async def get_schedule(schedule_id: str):
    """Get specific schedule"""
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")
    schedule = db.get_schedule(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule

@app.post("/api/schedules")
async def create_schedule(schedule: ScheduleCreate):
    """Create new scheduled job"""
    if not db or not scheduler:
        raise HTTPException(status_code=503, detail="Scheduler not available")
    try:
        schedule_id = db.create_schedule(
            name=schedule.name,
            start_schedule=schedule.start_schedule,
            stop_schedule=schedule.stop_schedule,
            profile_urls=schedule.profile_urls,
            max_workers=schedule.max_workers
        )
        
        # Add to scheduler
        scheduler.add_job(schedule_id)
        
        return {
            "message": "Schedule created successfully",
            "schedule_id": schedule_id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/schedules/{schedule_id}")
async def update_schedule(schedule_id: str, schedule: ScheduleUpdate):
    """Update existing schedule"""
    if not db or not scheduler:
        raise HTTPException(status_code=503, detail="Scheduler not available")
    try:
        db.update_schedule(schedule_id, schedule.dict(exclude_unset=True))
        
        # Reschedule job
        scheduler.reschedule_job(schedule_id)
        
        return {"message": "Schedule updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str):
    """Delete schedule"""
    if not db or not scheduler:
        raise HTTPException(status_code=503, detail="Scheduler not available")
    try:
        scheduler.remove_job(schedule_id)
        db.delete_schedule(schedule_id)
        return {"message": "Schedule deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/schedules/{schedule_id}/toggle")
async def toggle_schedule(schedule_id: str):
    """Toggle schedule status (active/paused)"""
    if not db or not scheduler:
        raise HTTPException(status_code=503, detail="Scheduler not available")
    try:
        schedule = db.get_schedule(schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        new_status = "paused" if schedule["status"] == "active" else "active"
        db.update_schedule(schedule_id, {"status": new_status})
        
        if new_status == "active":
            scheduler.resume_job(schedule_id)
        else:
            scheduler.pause_job(schedule_id)
        
        return {
            "message": f"Schedule {new_status}",
            "status": new_status
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# REQUIREMENTS GENERATOR ENDPOINTS
# ============================================================================

def fetch_page_content(url: str) -> Optional[str]:
    """Fetch HTML content from URL"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        return response.text
    except Exception as e:
        print(f"Error fetching URL: {e}")
        return None

def extract_kualifikasi_section(html: str) -> Optional[str]:
    """Extract Kualifikasi section from HTML with improved detection"""
    soup = BeautifulSoup(html, 'html.parser')
    
    # Try multiple variations of "Kualifikasi" heading
    kualifikasi_keywords = [
        'kualifikasi', 'persyaratan', 'requirements', 'qualifications', 
        'syarat', 'kriteria', 'ketentuan', 'spesifikasi'
    ]
    
    kualifikasi_heading = None
    
    # Method 1: Find heading tags
    for heading in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b']):
        heading_text = heading.get_text().lower().strip()
        # Check if heading contains keyword and is not too long (likely a heading)
        if any(keyword in heading_text for keyword in kualifikasi_keywords) and len(heading_text) < 100:
            kualifikasi_heading = heading
            break
    
    if not kualifikasi_heading:
        # Method 2: Find div/section with kualifikasi in class or id
        for element in soup.find_all(['div', 'section', 'article']):
            class_id = ' '.join(element.get('class', [])) + ' ' + element.get('id', '')
            if any(keyword in class_id.lower() for keyword in kualifikasi_keywords):
                return element.get_text()
        
        # Method 3: Find paragraph or list that starts with keyword
        for element in soup.find_all(['p', 'ul', 'ol']):
            text = element.get_text().strip()
            if any(text.lower().startswith(keyword) for keyword in kualifikasi_keywords):
                # Get this element and all following siblings until next heading
                content = [text]
                for sibling in element.find_next_siblings():
                    if sibling.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
                        break
                    sibling_text = sibling.get_text().strip()
                    if sibling_text:
                        content.append(sibling_text)
                return '\n'.join(content)
        
        return None
    
    # Get all content after Kualifikasi until next heading
    content = []
    
    # Include the heading text itself (might contain info)
    heading_text = kualifikasi_heading.get_text().strip()
    if heading_text:
        content.append(heading_text)
    
    # Get siblings
    for sibling in kualifikasi_heading.find_next_siblings():
        if sibling.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            break
        text = sibling.get_text().strip()
        if text:
            content.append(text)
    
    # If no siblings found, try parent's next siblings
    if len(content) <= 1 and kualifikasi_heading.parent:
        for sibling in kualifikasi_heading.parent.find_next_siblings():
            if sibling.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
                break
            text = sibling.get_text().strip()
            if text:
                content.append(text)
    
    # If still nothing, try to get parent's text
    if len(content) <= 1 and kualifikasi_heading.parent:
        parent_text = kualifikasi_heading.parent.get_text().strip()
        if parent_text and len(parent_text) > len(heading_text):
            content.append(parent_text)
    
    return '\n'.join(content) if content else None

def parse_kualifikasi(text: str) -> Dict:
    """Parse kualifikasi text and extract ALL items as requirements"""
    data = {
        'gender': None,
        'age_range': None,
        'education': [],
        'location': None,
        'min_experience_years': 0,
        'experience_keywords': [],
        'skills': [],
        'all_requirements': []
    }
    
    if not text:
        return data
    
    # Split by newlines and clean
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    # Remove the heading line if it's just "Kualifikasi:"
    if lines and any(keyword in lines[0].lower() for keyword in ['kualifikasi', 'persyaratan', 'requirements']):
        lines = lines[1:]
    
    # Process each line as a requirement
    for line in lines:
        # Skip if line is too short or just punctuation
        if len(line) < 5 or line in ['•', '-', '*', '○']:
            continue
        
        # Clean bullet points
        line_clean = re.sub(r'^[•\-\*○]\s*', '', line).strip()
        
        if not line_clean:
            continue
        
        # Add to all requirements
        data['all_requirements'].append(line_clean)
        
        line_lower = line_clean.lower()
        
        # Extract specific fields for backward compatibility
        
        # Gender
        if any(word in line_lower for word in ['pria', 'wanita', 'laki-laki', 'perempuan', 'male', 'female']):
            if 'pria / wanita' in line_lower or 'pria/wanita' in line_lower:
                data['gender'] = None  # Both accepted
            elif any(word in line_lower for word in ['wanita', 'perempuan', 'female']):
                data['gender'] = 'Female'
            elif any(word in line_lower for word in ['pria', 'laki-laki', 'male']):
                data['gender'] = 'Male'
        
        # Age
        age_patterns = [
            r'usia\s+(?:maksimal\s+)?(\d+)\s*(?:-\s*(\d+))?\s*tahun',
            r'umur\s+(\d+)\s*(?:-\s*(\d+))?\s*tahun',
            r'maksimal\s+(\d+)\s+tahun'
        ]
        for pattern in age_patterns:
            age_match = re.search(pattern, line_lower)
            if age_match:
                if age_match.lastindex >= 2 and age_match.group(2):
                    data['age_range'] = {
                        'min': int(age_match.group(1)),
                        'max': int(age_match.group(2))
                    }
                else:
                    data['age_range'] = {
                        'min': 18,
                        'max': int(age_match.group(1))
                    }
                break
        
        # Education
        if any(word in line_lower for word in ['pendidikan', 'education', 'lulusan', 'ijazah', 'sma', 'smk', 'diploma', 's1', 'sarjana']):
            if any(word in line_lower for word in ['sma', 'smk', 'high school', 'slta']):
                if 'High School' not in data['education']:
                    data['education'].append('High School')
            if any(word in line_lower for word in ['diploma', 'd3', 'd-3']):
                if 'Diploma' not in data['education']:
                    data['education'].append('Diploma')
            if any(word in line_lower for word in ['sarjana', 's1', 's-1', 'bachelor']):
                if 'Bachelor' not in data['education']:
                    data['education'].append('Bachelor')
            if 'sederajat' in line_lower and not data['education']:
                data['education'] = ['High School', 'Diploma']
        
        # Location
        if any(word in line_lower for word in ['penempatan', 'lokasi', 'domisili', 'location']):
            location_match = re.search(r'(?:penempatan|lokasi|domisili|location)\s*:?\s*([A-Za-z\s]+)', line, re.IGNORECASE)
            if location_match:
                location = location_match.group(1).strip()
                location = re.sub(r'\s+(atau|or|dan|and)\s+.*', '', location, flags=re.IGNORECASE)
                if location and len(location) > 2:
                    data['location'] = location.title()
        
        # Experience years
        exp_patterns = [
            r'(?:pengalaman|experience).*?(\d+)\s*(?:tahun|years?)',
            r'minimal\s+(\d+)\s+tahun',
            r'(\d+)\+?\s+(?:tahun|years?)'
        ]
        for pattern in exp_patterns:
            exp_match = re.search(pattern, line_lower)
            if exp_match:
                years = int(exp_match.group(1))
                if years > data['min_experience_years']:
                    data['min_experience_years'] = years
                break
        
        # Experience keywords (domain specific)
        exp_keywords = [
            'desk collection', 'call collection', 'telecollection', 'penagihan',
            'debt collection', 'collection', 'telemarketing', 'outbound',
            'bpr', 'lembaga keuangan', 'perbankan', 'banking', 'finance'
        ]
        for keyword in exp_keywords:
            if keyword in line_lower and keyword not in data['experience_keywords']:
                data['experience_keywords'].append(keyword)
        
        # Skills (extract from common patterns)
        skill_keywords = [
            'komunikasi', 'communication', 'negosiasi', 'negotiation',
            'persuasi', 'persuasion', 'komputer', 'computer',
            'microsoft office', 'excel', 'aplikasi perkantoran',
            'pencatatan', 'reporting', 'sistem penagihan',
            'target', 'customer service', 'pelayanan'
        ]
        for skill in skill_keywords:
            if skill in line_lower and skill not in data['skills']:
                data['skills'].append(skill.title())
    
    return data

# ============================================================================
# SIMPLIFIED REQUIREMENTS GENERATOR - HELPER FUNCTIONS
# ============================================================================

def extract_bullet_points(text: str) -> List[str]:
    """Extract bullet points from text"""
    if not text:
        return []
    
    bullets = []
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    # Remove heading line if present
    if lines and any(keyword in lines[0].lower() for keyword in ['kualifikasi', 'persyaratan', 'requirements', 'syarat']):
        lines = lines[1:]
    
    for line in lines:
        # Skip if too short
        if len(line) < 5:
            continue
        
        # Clean bullet markers
        line_clean = re.sub(r'^[•\-\*○\d+\.\)]\s*', '', line).strip()
        
        if line_clean and len(line_clean) >= 5:
            bullets.append(line_clean)
    
    return bullets

def classify_requirement(text: str, req_id: int) -> Dict:
    """Classify a single requirement and extract structured value"""
    text_lower = text.lower()
    
    # Priority 1: Gender
    if any(word in text_lower for word in ['pria', 'wanita', 'laki-laki', 'perempuan', 'male', 'female']):
        # Determine gender value
        if 'pria / wanita' in text_lower or 'pria/wanita' in text_lower or ('pria' in text_lower and 'wanita' in text_lower):
            gender_value = 'any'
        elif any(word in text_lower for word in ['wanita', 'perempuan', 'female']):
            gender_value = 'female'
        elif any(word in text_lower for word in ['pria', 'laki-laki', 'male']):
            gender_value = 'male'
        else:
            gender_value = 'any'
        
        return {
            'id': f'req_{req_id}',
            'label': text,
            'type': 'gender',
            'value': gender_value
        }
    
    # Priority 2: Age
    if any(word in text_lower for word in ['usia', 'umur', 'age']):
        # Extract age range
        age_patterns = [
            r'(\d+)\s*-\s*(\d+)\s*tahun',
            r'(\d+)\s*sampai\s*(\d+)\s*tahun',
            r'maksimal\s*(\d+)\s*tahun',
            r'max\s*(\d+)\s*tahun'
        ]
        
        age_value = {'min': 18, 'max': 35}  # default
        
        for pattern in age_patterns:
            match = re.search(pattern, text_lower)
            if match:
                if match.lastindex >= 2:
                    age_value = {
                        'min': int(match.group(1)),
                        'max': int(match.group(2))
                    }
                else:
                    age_value = {
                        'min': 18,
                        'max': int(match.group(1))
                    }
                break
        
        return {
            'id': f'req_{req_id}',
            'label': text,
            'type': 'age',
            'value': age_value
        }
    
    # Priority 3: Education
    if any(word in text_lower for word in ['pendidikan', 'education', 'lulusan', 'ijazah', 'sma', 'smk', 'diploma', 's1', 'sarjana']):
        # Determine education level
        if any(word in text_lower for word in ['sarjana', 's1', 's-1', 'bachelor']):
            edu_value = 'bachelor'
        elif any(word in text_lower for word in ['diploma', 'd3', 'd-3']):
            edu_value = 'diploma'
        elif any(word in text_lower for word in ['sma', 'smk', 'high school', 'slta']):
            edu_value = 'high school'
        else:
            edu_value = 'high school'  # default
        
        return {
            'id': f'req_{req_id}',
            'label': text,
            'type': 'education',
            'value': edu_value
        }
    
    # Priority 4: Location
    if any(word in text_lower for word in ['penempatan', 'lokasi', 'domisili', 'location', 'ditempatkan']):
        # Extract location name
        location_match = re.search(r'(?:penempatan|lokasi|domisili|location|ditempatkan)\s*:?\s*([A-Za-z\s]+)', text, re.IGNORECASE)
        if location_match:
            location_value = location_match.group(1).strip()
            # Remove trailing words like "atau", "dan"
            location_value = re.sub(r'\s+(atau|or|dan|and)\s+.*', '', location_value, flags=re.IGNORECASE).strip()
        else:
            location_value = 'any'
        
        return {
            'id': f'req_{req_id}',
            'label': text,
            'type': 'location',
            'value': location_value.lower()
        }
    
    # Priority 5: Experience (with years)
    if any(word in text_lower for word in ['pengalaman', 'experience', 'berpengalaman']):
        # Extract years
        exp_patterns = [
            r'(?:minimal|minimum|min\.?)\s*(\d+)\s*(?:tahun|years?)',
            r'(\d+)\s*(?:tahun|years?)\s*(?:pengalaman|experience)',
            r'(\d+)\+?\s*(?:tahun|years?)'
        ]
        
        exp_value = 1  # default
        
        for pattern in exp_patterns:
            match = re.search(pattern, text_lower)
            if match:
                exp_value = int(match.group(1))
                break
        
        return {
            'id': f'req_{req_id}',
            'label': text,
            'type': 'experience',
            'value': exp_value
        }
    
    # Default: Skill
    return {
        'id': f'req_{req_id}',
        'label': text,
        'type': 'skill',
        'value': text.lower()
    }

@app.post("/api/requirements/generate")
async def generate_requirements(request: RequirementsGenerateRequest):
    """Generate requirements from URL or job description - SIMPLIFIED VERSION"""
    try:
        # STEP 1: Get text from input
        text_to_parse = ""
        
        if request.url:
            html = fetch_page_content(request.url)
            if not html:
                raise HTTPException(status_code=400, detail="Failed to fetch URL")
            
            # Try to extract Kualifikasi section
            kualifikasi = extract_kualifikasi_section(html)
            if kualifikasi:
                text_to_parse = kualifikasi
            else:
                # Fallback to full page
                soup = BeautifulSoup(html, 'html.parser')
                text_to_parse = soup.get_text()
        
        elif request.job_description:
            text_to_parse = request.job_description
        
        else:
            raise HTTPException(status_code=400, detail="Either url or job_description is required")
        
        # STEP 2: Extract bullet points
        bullets = extract_bullet_points(text_to_parse)
        
        # STEP 3: Classify each bullet point
        requirements_array = []
        for i, bullet in enumerate(bullets):
            req = classify_requirement(bullet, i + 1)
            requirements_array.append(req)
        
        # STEP 4: Add default requirements if none found
        if len(requirements_array) == 0:
            requirements_array = [
                {
                    'id': 'req_1',
                    'label': 'Minimum 1 year experience',
                    'type': 'experience',
                    'value': 1
                },
                {
                    'id': 'req_2',
                    'label': 'Education: High School',
                    'type': 'education',
                    'value': 'high school'
                }
            ]
        
        # STEP 5: Build response
        requirements = {
            'position': request.position,
            'requirements': requirements_array
        }
        
        return {
            'success': True,
            'requirements': requirements
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/requirements/save")
async def save_requirements(request: RequirementsSaveRequest):
    """Save requirements to JSON file"""
    try:
        # Ensure requirements directory exists
        requirements_dir = Path(__file__).parent.parent / "scoring" / "requirements"
        requirements_dir.mkdir(parents=True, exist_ok=True)
        
        # Clean filename
        filename = request.filename
        if not filename.endswith('.json'):
            filename += '.json'
        
        # Save to file
        filepath = requirements_dir / filename
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(request.requirements, f, indent=2, ensure_ascii=False)
        
        return {
            'success': True,
            'message': 'Requirements saved successfully',
            'filepath': str(filepath)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# AUTO-CRAWL ENDPOINTS (Webhook & Instant Crawl)
# ============================================================================

def publish_to_crawler_queue(profile_url: str, template_id: str = None, requirements_id: str = 'default'):
    """Publish profile URL to crawler queue"""
    try:
        # Create RabbitMQ connection
        credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
        parameters = pika.ConnectionParameters(
            host=RABBITMQ_HOST,
            port=RABBITMQ_PORT,
            virtual_host=RABBITMQ_VHOST,
            credentials=credentials,
            heartbeat=600,
            blocked_connection_timeout=300
        )
        
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        
        # Declare queue
        channel.queue_declare(queue=RABBITMQ_QUEUE, durable=True)
        
        # Create message
        message = {
            'url': profile_url,
            'template_id': template_id,
            'requirements_id': requirements_id,
            'timestamp': datetime.now().isoformat(),
            'trigger': 'auto'  # Mark as auto-triggered
        }
        
        # Publish message
        channel.basic_publish(
            exchange='',
            routing_key=RABBITMQ_QUEUE,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Persistent
                content_type='application/json'
            )
        )
        
        connection.close()
        return True
        
    except Exception as e:
        print(f"❌ Failed to publish to queue: {e}")
        return False


@app.post("/api/webhook/lead-inserted")
async def webhook_lead_inserted(payload: WebhookLeadInsert):
    """
    Webhook endpoint called by Supabase when new lead is inserted
    Automatically triggers crawler for the new profile
    """
    try:
        print("\n" + "="*60)
        print("🔔 WEBHOOK: New Lead Inserted")
        print("="*60)
        
        # Validate webhook type
        if payload.type != 'INSERT':
            return {"message": "Ignored: Not an INSERT event"}
        
        if payload.table != 'leads_list':
            return {"message": "Ignored: Not leads_list table"}
        
        # Extract lead data
        lead = payload.record
        profile_url = lead.get('profile_url')
        template_id = lead.get('template_id')
        lead_id = lead.get('id')
        
        if not profile_url:
            print("⚠️ No profile_url in lead data")
            return {"message": "Ignored: No profile_url"}
        
        print(f"📋 Lead ID: {lead_id}")
        print(f"🔗 Profile URL: {profile_url}")
        print(f"📁 Template ID: {template_id}")
        
        # Check if already scraped (optional - comment out to allow re-scrape)
        # if lead.get('score') is not None:
        #     print("⊘ Already scraped (has score)")
        #     return {"message": "Ignored: Already scraped"}
        
        # Determine requirements_id from template
        # TODO: Map template_id to requirements_id
        requirements_id = 'default'  # For now, use default
        
        # Publish to crawler queue
        success = publish_to_crawler_queue(
            profile_url=profile_url,
            template_id=template_id,
            requirements_id=requirements_id
        )
        
        if success:
            print("✅ Profile queued for crawling")
            return {
                "success": True,
                "message": "Profile queued for crawling",
                "lead_id": lead_id,
                "profile_url": profile_url
            }
        else:
            print("❌ Failed to queue profile")
            raise HTTPException(status_code=500, detail="Failed to queue profile")
        
    except Exception as e:
        print(f"❌ Webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/leads/crawl-instant")
async def crawl_instant(request: InstantCrawlRequest):
    """
    Manually trigger instant crawl for a single profile
    Useful for testing or manual re-crawl
    """
    try:
        print("\n" + "="*60)
        print("⚡ INSTANT CRAWL REQUEST")
        print("="*60)
        print(f"🔗 Profile URL: {request.profile_url}")
        print(f"📁 Template ID: {request.template_id}")
        print(f"📋 Requirements ID: {request.requirements_id}")
        
        # Publish to crawler queue
        success = publish_to_crawler_queue(
            profile_url=request.profile_url,
            template_id=request.template_id,
            requirements_id=request.requirements_id
        )
        
        if success:
            print("✅ Profile queued for crawling")
            return {
                "success": True,
                "message": "Profile queued for instant crawling",
                "profile_url": request.profile_url
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to queue profile")
        
    except Exception as e:
        print(f"❌ Instant crawl error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# OUTREACH ENDPOINTS (Step 2: Send to RabbitMQ)
# ============================================================================

@app.post("/api/outreach/send")
async def send_outreach(request: OutreachRequest):
    """
    Receive outreach request from frontend and send to RabbitMQ
    Step 2: Split into 1 message per lead and queue them
    """
    try:
        print("\n" + "="*60)
        print("📥 OUTREACH REQUEST RECEIVED")
        print("="*60)
        print(f"Total leads: {len(request.leads)}")
        print(f"Message template: {request.message[:50]}...")
        print(f"Dry run: {request.dry_run}")
        
        # Validate leads
        valid_leads = []
        for i, lead in enumerate(request.leads, 1):
            lead_id = lead.get('id')
            lead_name = lead.get('name')
            profile_url = lead.get('profile_url')
            
            if not lead_name or not profile_url:
                print(f"  ❌ [{i}] Invalid lead: missing name or profile_url")
                continue
            
            valid_leads.append({
                'id': lead_id,
                'name': lead_name,
                'profile_url': profile_url
            })
        
        if len(valid_leads) == 0:
            raise HTTPException(status_code=400, detail="No valid leads provided")
        
        print(f"\n✅ Valid leads: {len(valid_leads)}/{len(request.leads)}")
        
        # Connect to RabbitMQ
        print(f"\n🐰 Connecting to RabbitMQ at {RABBITMQ_HOST}:{RABBITMQ_PORT}...")
        
        try:
            credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
            parameters = pika.ConnectionParameters(
                host=RABBITMQ_HOST,
                port=RABBITMQ_PORT,
                virtual_host=RABBITMQ_VHOST,
                credentials=credentials,
                heartbeat=600,
                blocked_connection_timeout=300
            )
            
            connection = pika.BlockingConnection(parameters)
            channel = connection.channel()
            
            # Declare queue (create if not exists)
            channel.queue_declare(queue=OUTREACH_QUEUE, durable=True)
            
            print(f"✓ Connected to RabbitMQ")
            
        except Exception as e:
            print(f"✗ Failed to connect to RabbitMQ: {e}")
            raise HTTPException(
                status_code=503, 
                detail=f"RabbitMQ connection failed: {str(e)}"
            )
        
        # Send each lead as separate message
        print(f"\n📤 Sending messages to queue '{OUTREACH_QUEUE}'...")
        
        batch_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        queued_count = 0
        
        for i, lead in enumerate(valid_leads, 1):
            try:
                # Create message payload (1 message = 1 lead)
                message = {
                    'job_id': f"outreach_{batch_id}_{i}",
                    'lead_id': lead['id'],
                    'name': lead['name'],
                    'profile_url': lead['profile_url'],
                    'message': request.message,
                    'dry_run': request.dry_run,
                    'batch_id': batch_id,
                    'created_at': datetime.now().isoformat()
                }
                
                # Publish to queue
                channel.basic_publish(
                    exchange='',
                    routing_key=OUTREACH_QUEUE,
                    body=json.dumps(message),
                    properties=pika.BasicProperties(
                        delivery_mode=2,  # Make message persistent
                        content_type='application/json'
                    )
                )
                
                queued_count += 1
                print(f"  ✓ [{i}/{len(valid_leads)}] Queued: {lead['name']}")
                
            except Exception as e:
                print(f"  ✗ [{i}/{len(valid_leads)}] Failed to queue {lead['name']}: {e}")
        
        # Close connection
        connection.close()
        
        print(f"\n✅ Successfully queued {queued_count}/{len(valid_leads)} messages")
        print("="*60 + "\n")
        
        return {
            "status": "success",
            "message": "Outreach messages queued successfully",
            "total_leads": len(request.leads),
            "valid_leads": len(valid_leads),
            "queued": queued_count,
            "count": queued_count,
            "batch_id": batch_id,
            "dry_run": request.dry_run,
            "queue": OUTREACH_QUEUE
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error processing outreach request: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
