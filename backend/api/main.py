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
    """Extract Kualifikasi section from HTML"""
    soup = BeautifulSoup(html, 'html.parser')
    
    # Find "Kualifikasi" heading
    kualifikasi_heading = None
    for heading in soup.find_all(['h1', 'h2', 'h3', 'h4']):
        if 'kualifikasi' in heading.get_text().lower():
            kualifikasi_heading = heading
            break
    
    if not kualifikasi_heading:
        return None
    
    # Get all content after Kualifikasi until next heading
    content = []
    for sibling in kualifikasi_heading.find_next_siblings():
        if sibling.name in ['h1', 'h2', 'h3', 'h4']:
            break
        content.append(sibling.get_text())
    
    return '\n'.join(content)

def parse_kualifikasi(text: str) -> Dict:
    """Parse kualifikasi text and extract structured data"""
    data = {
        'gender': None,
        'age_range': None,
        'education': [],
        'location': None,
        'min_experience_years': 0,
        'experience_keywords': [],
        'skills': []
    }
    
    lines = text.split('\n')
    
    for line in lines:
        line_lower = line.lower().strip()
        
        # Gender
        if 'pria' in line_lower or 'wanita' in line_lower:
            if 'pria / wanita' in line_lower or 'pria/wanita' in line_lower:
                data['gender'] = None
            elif 'wanita' in line_lower:
                data['gender'] = 'Female'
            elif 'pria' in line_lower:
                data['gender'] = 'Male'
        
        # Age
        age_match = re.search(r'usia\s+(?:maksimal\s+)?(\d+)\s*(?:-\s*(\d+))?\s*tahun', line_lower)
        if age_match:
            if age_match.group(2):
                data['age_range'] = {
                    'min': int(age_match.group(1)),
                    'max': int(age_match.group(2))
                }
            else:
                data['age_range'] = {
                    'min': 18,
                    'max': int(age_match.group(1))
                }
        
        # Education
        if 'pendidikan' in line_lower:
            if 'sma' in line_lower or 'smk' in line_lower:
                data['education'].append('High School')
            if 'diploma' in line_lower or 'd3' in line_lower:
                data['education'].append('Diploma')
            if 'sarjana' in line_lower or 's1' in line_lower or 'bachelor' in line_lower:
                data['education'].append('Bachelor')
            if 'sederajat' in line_lower and not data['education']:
                data['education'] = ['High School', 'Diploma']
        
        # Location
        if 'penempatan' in line_lower:
            location_match = re.search(r'penempatan\s*:?\s*([A-Za-z\s]+)', line, re.IGNORECASE)
            if location_match:
                data['location'] = location_match.group(1).strip()
        
        # Experience years
        exp_match = re.search(r'(?:pengalaman|experience).*?(\d+)\s*tahun', line_lower)
        if exp_match:
            data['min_experience_years'] = int(exp_match.group(1))
        
        # Experience keywords
        if 'desk collection' in line_lower or 'call collection' in line_lower or 'telecollection' in line_lower:
            if 'desk collection' in line_lower and 'Desk Collection' not in data['experience_keywords']:
                data['experience_keywords'].append('Desk Collection')
            if 'call collection' in line_lower and 'Call Collection' not in data['experience_keywords']:
                data['experience_keywords'].append('Call Collection')
            if 'telecollection' in line_lower and 'Telecollection' not in data['experience_keywords']:
                data['experience_keywords'].append('Telecollection')
        
        # Skills
        if 'komunikasi' in line_lower and 'Communication' not in data['skills']:
            data['skills'].append('Communication')
        if 'negosiasi' in line_lower and 'Negotiation' not in data['skills']:
            data['skills'].append('Negotiation')
        if 'komputer' in line_lower and 'Computer Skills' not in data['skills']:
            data['skills'].append('Computer Skills')
    
    return data

@app.post("/api/requirements/generate")
async def generate_requirements(request: RequirementsGenerateRequest):
    """Generate requirements from URL or job description"""
    try:
        text_to_parse = ""
        
        # Fetch from URL if provided
        if request.url:
            html = fetch_page_content(request.url)
            if not html:
                raise HTTPException(status_code=400, detail="Failed to fetch URL")
            
            kualifikasi = extract_kualifikasi_section(html)
            if kualifikasi:
                text_to_parse = kualifikasi
            else:
                # Fallback to full page
                soup = BeautifulSoup(html, 'html.parser')
                text_to_parse = soup.get_text()
        
        # Use job description if provided
        elif request.job_description:
            text_to_parse = request.job_description
        
        else:
            raise HTTPException(status_code=400, detail="Either url or job_description is required")
        
        # Parse kualifikasi
        parsed = parse_kualifikasi(text_to_parse)
        
        # Build requirements
        requirements = {
            'position': request.position,
            'job_description': text_to_parse[:500] + '...' if len(text_to_parse) > 500 else text_to_parse,
            'min_experience_years': request.min_experience_years or parsed['min_experience_years'] or 1
        }
        
        # Experience keywords
        if parsed['experience_keywords']:
            requirements['required_experience_keywords'] = parsed['experience_keywords']
            requirements['preferred_experience_keywords'] = [
                'BPR', 'Lembaga Keuangan', 'Banking', 'Finance'
            ]
        
        # Skills
        if parsed['skills']:
            requirements['required_skills'] = {
                skill: 10 if skill in ['Communication', 'Negotiation'] else 5
                for skill in parsed['skills']
            }
            requirements['preferred_skills'] = {
                'Problem Solving': 7,
                'Target Oriented': 7,
                'Customer Service': 6
            }
        
        # Education
        if parsed['education']:
            requirements['education_level'] = parsed['education']
        else:
            requirements['education_level'] = ['High School', 'Diploma', 'Bachelor']
        
        # Demographics - use parsed or request values
        if request.required_gender or parsed['gender']:
            requirements['required_gender'] = request.required_gender or parsed['gender']
        
        if request.required_location or parsed['location']:
            requirements['required_location'] = request.required_location or parsed['location']
        
        if request.required_age_range or parsed['age_range']:
            requirements['required_age_range'] = request.required_age_range or parsed['age_range']
        
        return {
            'success': True,
            'requirements': requirements,
            'parsed_data': parsed
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
