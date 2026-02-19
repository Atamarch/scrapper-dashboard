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

# Add crawler to path
sys.path.append(str(Path(__file__).parent.parent / "crawler"))

from scheduler_service import SchedulerService
from database import Database

app = FastAPI(title="LinkedIn Crawler API", version="1.0.0")

# CORS - Allow Vercel and localhost
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://*.vercel.app",  # All Vercel preview deployments
    os.getenv("FRONTEND_URL", ""),  # Production frontend URL from env
]

# Filter out empty strings
ALLOWED_ORIGINS = [origin for origin in ALLOWED_ORIGINS if origin]

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

class CrawlRequest(BaseModel):
    profile_urls: List[str]
    max_workers: int = 3

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


# Manual crawl endpoint
@app.post("/api/crawl")
async def manual_crawl(request: CrawlRequest, background_tasks: BackgroundTasks):
    """Trigger manual crawl immediately"""
    if not scheduler:
        raise HTTPException(status_code=503, detail="Scheduler not available")
    try:
        # Run crawl in background
        background_tasks.add_task(
            scheduler.run_crawl_task,
            profile_urls=request.profile_urls,
            max_workers=request.max_workers
        )
        
        return {
            "message": "Crawl started",
            "profile_count": len(request.profile_urls),
            "max_workers": request.max_workers
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Stats endpoint
@app.get("/api/stats")
async def get_stats():
    """Get crawler statistics"""
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")
    stats = db.get_stats()
    return stats


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

@app.get("/api/requirements")
async def list_requirements():
    """List all available requirements files"""
    try:
        requirements_dir = Path(__file__).parent.parent / "scoring" / "requirements"
        
        if not requirements_dir.exists():
            return {'requirements': []}
        
        requirements = []
        for file in requirements_dir.glob('*.json'):
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    requirements.append({
                        'filename': file.name,
                        'position': data.get('position', 'Unknown'),
                        'min_experience_years': data.get('min_experience_years', 0)
                    })
            except:
                continue
        
        return {'requirements': requirements}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/requirements/{filename}")
async def get_requirement(filename: str):
    """Get specific requirement file"""
    try:
        requirements_dir = Path(__file__).parent.parent / "scoring" / "requirements"
        filepath = requirements_dir / filename
        
        if not filepath.exists():
            raise HTTPException(status_code=404, detail="Requirements file not found")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return data
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
