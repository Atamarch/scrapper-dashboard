"""
FastAPI Backend for LinkedIn Crawler Scheduler
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
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
from helper.rabbitmq_helper import queue_publisher
from helper.supabase_helper import ScheduleManager, CompanyManager, LeadsManager, ReQueueManager, supabase

# Error handling decorator
def handle_api_errors(func):
    """Decorator to handle common API errors"""
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return wrapper

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
class RequirementsGenerateRequest(BaseModel):
    url: Optional[str] = Field(
        None,
        example="https://example.com/job-posting",
        description="URL of job posting to scrape"
    )
    job_description: Optional[str] = Field(
        None,
        example="We are looking for a debt collector with 2+ years experience...",
        description="Job description text"
    )
    position: str = Field(
        ...,
        example="Debt Collector",
        description="Job position title"
    )
    min_experience_years: Optional[int] = Field(
        1,
        example=2,
        description="Minimum years of experience required"
    )
    required_gender: Optional[str] = Field(
        None,
        example="any",
        description="Required gender: 'male', 'female', or 'any'"
    )
    required_location: Optional[str] = Field(
        None,
        example="Jakarta",
        description="Required location"
    )
    required_age_range: Optional[Dict[str, int]] = Field(
        None,
        example={"min": 25, "max": 35},
        description="Required age range"
    )

class RequirementsSaveRequest(BaseModel):
    requirements: Dict = Field(
        ...,
        example={
            "position": "Debt Collector",
            "requirements": [
                {"id": "req_1", "label": "2+ years experience", "type": "experience", "value": 2}
            ]
        },
        description="Requirements data to save"
    )
    filename: str = Field(
        ...,
        example="debt_collector_requirements",
        description="Filename to save (without .json extension)"
    )

class OutreachRequest(BaseModel):
    leads: List[Dict[str, str]] = Field(
        ...,
        example=[
            {
                "id": "lead-123",
                "name": "John Doe",
                "profile_url": "https://linkedin.com/in/johndoe"
            }
        ],
        description="List of leads to send outreach messages"
    )
    message: str = Field(
        ...,
        example="Hi {name}, we have an exciting opportunity for you...",
        description="Outreach message template (use {name} for personalization)"
    )
    dry_run: bool = Field(
        True,
        example=False,
        description="If true, only simulate sending (for testing)"
    )

class WebhookLeadInsert(BaseModel):
    """Webhook payload from Supabase trigger"""
    type: str = Field(
        ...,
        example="INSERT",
        description="Database operation type"
    )
    table: str = Field(
        ...,
        example="leads_list",
        description="Table name"
    )
    record: Dict = Field(
        ...,
        example={
            "id": "lead-123",
            "name": "John Doe",
            "profile_url": "https://linkedin.com/in/johndoe",
            "template_id": "38a1699d-ad54-4f05-9483-e3d35142d35f"
        },
        description="New lead data"
    )
    old_record: Optional[Dict] = Field(
        None,
        description="Previous record data (for UPDATE operations)"
    )

class ReQueueRequest(BaseModel):
    """Request to re-queue failed leads"""
    template_id: Optional[str] = Field(
        None,
        example="38a1699d-ad54-4f05-9483-e3d35142d35f",
        description="Template ID to filter leads (optional, if not provided will check all)"
    )
    check_profile_data: bool = Field(
        True,
        example=True,
        description="Check for missing profile_data"
    )
    check_scoring_data: bool = Field(
        True,
        example=True,
        description="Check for missing scoring_data"
    )
    dry_run: bool = Field(
        False,
        example=False,
        description="If true, only show what would be re-queued (for testing)"
    )


class InstantCrawlRequest(BaseModel):
    """Request for instant crawling of a single profile"""
    profile_url: str = Field(
        ...,
        example="https://linkedin.com/in/johndoe",
        description="LinkedIn profile URL to crawl"
    )
    template_id: Optional[str] = Field(
        None,
        example="38a1699d-ad54-4f05-9483-e3d35142d35f",
        description="Template ID for scoring (optional)"
    )


class ScrapingRequest(BaseModel):
    """Simple scraping request"""
    template_id: str = Field(..., description="Template ID to scrape", example="38a1699d-ad54-4f05-9483-e3d35142d35f")


class ScrapingResponse(BaseModel):
    """Simple scraping response"""
    success: bool = Field(..., description="Request success", example=True)
    message: str = Field(..., description="Response message", example="25 leads queued for scraping")
    leads_queued: int = Field(..., description="Number of leads queued", example=25)
    batch_id: str = Field(..., description="Batch ID", example="20260305_143022")


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


# ============================================================================
# CRAWLER SCHEDULE ENDPOINTS (Direct Supabase Access)
# ============================================================================

class CrawlerScheduleCreate(BaseModel):
    name: str = Field(
        ..., 
        example="Daily Morning Crawl",
        description="Name of the schedule"
    )
    start_schedule: str = Field(
        ..., 
        example="0 9 * * *",
        description="Cron expression (e.g., '0 9 * * *' for daily at 9 AM)"
    )
    template_id: str = Field(
        ...,
        example="38a1699d-ad54-4f05-9483-e3d35142d35f",
        description="Template ID to use for scraping"
    )
    status: Optional[str] = Field(
        default='active',
        example="active",
        description="Schedule status: 'active' or 'inactive'"
    )

class CrawlerScheduleUpdate(BaseModel):
    name: Optional[str] = Field(
        None, 
        example="Updated Schedule Name",
        description="Name of the schedule"
    )
    start_schedule: Optional[str] = Field(
        None, 
        example="0 10 * * *",
        description="Cron expression (e.g., '0 10 * * *' for daily at 10 AM)"
    )
    template_id: Optional[str] = Field(
        None,
        example="38a1699d-ad54-4f05-9483-e3d35142d35f",
        description="Template ID to use for scraping"
    )
    status: Optional[str] = Field(
        None,
        example="inactive",
        description="Schedule status: 'active' or 'inactive'"
    )

@app.get("/api/schedules")
async def get_schedules():
    """Get all schedules (simple - no parameters needed)"""
    try:
        schedules = ScheduleManager.get_all_simple()
        
        return {
            "success": True,
            "count": len(schedules),
            "schedules": schedules
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/schedules/{schedule_id}")
@handle_api_errors
async def get_schedule(schedule_id: str):
    """Get specific schedule by ID"""
    schedule = ScheduleManager.get_by_id(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    return {"success": True, "schedule": schedule}


@app.post("/api/schedules")
async def create_schedule(schedule: CrawlerScheduleCreate):
    """Create new schedule"""
    try:
        # Validate template exists
        template_result = supabase.table('search_templates').select('id, position').eq('id', schedule.template_id).execute()
        if not template_result.data:
            raise HTTPException(status_code=404, detail=f"Template with ID {schedule.template_id} not found")
        
        # Create schedule with template_id
        data = {
            'name': schedule.name,
            'start_schedule': schedule.start_schedule,
            'template_id': schedule.template_id,
            'status': schedule.status,
            'created_at': datetime.now().isoformat()
        }
        
        created = ScheduleManager.create(data)
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create schedule")
        
        return {
            "success": True,
            "message": "Schedule created successfully",
            "schedule_id": created['id'],
            "schedule": created
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/schedules/{schedule_id}")
async def update_schedule(schedule_id: str, schedule: CrawlerScheduleUpdate):
    """Update existing schedule"""
    try:
        # Check if schedule exists
        if not ScheduleManager.get_by_id(schedule_id):
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Build update data
        update_data = schedule.dict(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Validate template if provided
        if 'template_id' in update_data:
            template_result = supabase.table('search_templates').select('id, position').eq('id', update_data['template_id']).execute()
            if not template_result.data:
                raise HTTPException(status_code=404, detail=f"Template with ID {update_data['template_id']} not found")
        
        # Update schedule
        updated = ScheduleManager.update(schedule_id, update_data)
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update schedule")
        
        return {
            "success": True,
            "message": "Schedule updated successfully",
            "schedule": updated
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str):
    """Delete schedule"""
    try:
        # Check if schedule exists
        schedule = ScheduleManager.get_by_id(schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Delete schedule
        success = ScheduleManager.delete(schedule_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete schedule - no rows affected")
        
        return {
            "success": True,
            "message": f"Schedule '{schedule['name']}' deleted successfully",
            "schedule_id": schedule_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete schedule: {str(e)}")


@app.patch("/api/schedules/{schedule_id}/toggle")
async def toggle_schedule(schedule_id: str):
    """Toggle schedule status between 'active' and 'inactive'"""
    try:
        # Get current schedule
        schedule = ScheduleManager.get_by_id(schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Toggle status
        current_status = schedule['status']
        new_status = 'inactive' if current_status == 'active' else 'active'
        
        # Update status
        updated = ScheduleManager.update(schedule_id, {'status': new_status})
        
        return {
            "success": True,
            "message": f"Schedule status changed to '{new_status}'",
            "schedule_id": schedule_id,
            "old_status": current_status,
            "new_status": new_status,
            "schedule": updated
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/schedules/queue/status")
async def get_queue_status():
    """Get queue status and consumer information"""
    try:
        import pika
        
        # Connect to RabbitMQ
        credentials = pika.PlainCredentials(
            os.getenv('RABBITMQ_USER'),
            os.getenv('RABBITMQ_PASS')
        )
        parameters = pika.ConnectionParameters(
            host=os.getenv('RABBITMQ_HOST'),
            port=int(os.getenv('RABBITMQ_PORT')),
            virtual_host=os.getenv('RABBITMQ_VHOST'),
            credentials=credentials
        )
        
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        
        # Check main queue
        main_queue = os.getenv('RABBITMQ_QUEUE', 'linkedin_profiles')
        main_queue_state = channel.queue_declare(queue=main_queue, durable=True, passive=True)
        main_queue_size = main_queue_state.method.message_count
        
        # Check scoring queue
        scoring_queue = os.getenv('SCORING_QUEUE', 'scoring_queue')
        try:
            scoring_queue_state = channel.queue_declare(queue=scoring_queue, durable=True, passive=True)
            scoring_queue_size = scoring_queue_state.method.message_count
        except:
            scoring_queue_size = 0
        
        # Check outreach queue
        outreach_queue = os.getenv('OUTREACH_QUEUE', 'outreach_queue')
        try:
            outreach_queue_state = channel.queue_declare(queue=outreach_queue, durable=True, passive=True)
            outreach_queue_size = outreach_queue_state.method.message_count
        except:
            outreach_queue_size = 0
        
        connection.close()
        
        # Check if consumer is running (simplified check)
        consumer_running = False
        try:
            import psutil
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    cmdline = proc.info['cmdline']
                    if cmdline and 'python' in cmdline[0] and 'crawler_consumer.py' in ' '.join(cmdline):
                        consumer_running = True
                        break
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    pass
        except ImportError:
            consumer_running = None  # Can't determine
        
        return {
            "success": True,
            "queue_status": {
                "main_queue": {
                    "name": main_queue,
                    "messages": main_queue_size
                },
                "scoring_queue": {
                    "name": scoring_queue,
                    "messages": scoring_queue_size
                },
                "outreach_queue": {
                    "name": outreach_queue,
                    "messages": outreach_queue_size
                }
            },
            "consumer_status": {
                "crawler_consumer_running": consumer_running,
                "can_check_consumer": consumer_running is not None
            },
            "environment": {
                "OUTREACH_QUEUE": outreach_queue,
                "RABBITMQ_HOST": os.getenv('RABBITMQ_HOST'),
                "RABBITMQ_VHOST": os.getenv('RABBITMQ_VHOST')
            },
            "total_pending": main_queue_size + scoring_queue_size + outreach_queue_size
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get queue status: {str(e)}")


@app.post("/api/schedules/consumer/start")
async def start_consumer():
    """Manually start crawler consumer (local only)"""
    try:
        import subprocess
        import psutil
        
        # Check if already running
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                cmdline = proc.info['cmdline']
                if cmdline and 'python' in cmdline[0] and 'crawler_consumer.py' in ' '.join(cmdline):
                    return {
                        "success": False,
                        "message": f"Crawler consumer is already running (PID: {proc.info['pid']})",
                        "pid": proc.info['pid']
                    }
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        
        # Start consumer
        crawler_dir = os.path.join(os.path.dirname(__file__), '..', 'crawler')
        consumer_path = os.path.join(crawler_dir, 'crawler_consumer.py')
        
        if not os.path.exists(consumer_path):
            raise HTTPException(status_code=404, detail="Crawler consumer script not found")
        
        process = subprocess.Popen(
            ['python', consumer_path],
            cwd=crawler_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0
        )
        
        return {
            "success": True,
            "message": "Crawler consumer started successfully",
            "pid": process.pid,
            "working_directory": crawler_dir
        }
        
    except ImportError:
        raise HTTPException(status_code=500, detail="psutil not available - cannot manage consumer")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start consumer: {str(e)}")


@app.post("/api/schedules/{schedule_id}/execute")
async def execute_schedule_manually(schedule_id: str):
    """Manually execute a specific schedule"""
    try:
        # Get schedule
        schedule = ScheduleManager.get_by_id(schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Check if template_id exists in schedule
        if 'template_id' not in schedule or not schedule['template_id']:
            raise HTTPException(status_code=400, detail="Schedule does not have a template_id configured")
        
        # Validate template exists
        template_result = supabase.table('search_templates').select('id, position').eq('id', schedule['template_id']).execute()
        if not template_result.data:
            raise HTTPException(status_code=404, detail=f"Template with ID {schedule['template_id']} not found")
        
        # Start scraping with the template_id from schedule
        scraping_request = ScrapingRequest(template_id=schedule['template_id'])
        scraping_result = await start_scraping(scraping_request)
        
        # Update last_run timestamp
        ScheduleManager.update(schedule_id, {
            'last_run': datetime.now().isoformat()
        })
        
        return {
            "success": True,
            "message": f"Schedule '{schedule['name']}' executed manually with template {schedule['template_id']}",
            "schedule_id": schedule_id,
            "schedule_name": schedule['name'],
            "template_id": schedule['template_id'],
            "scraping_result": scraping_result,
            "last_run_updated": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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

@app.get("/api/requirements/templates")
@handle_api_errors
async def get_templates():
    """Get all requirements templates"""
    try:
        result = supabase.table('search_templates').select('id, position, created_at').execute()
        return {
            "success": True,
            "templates": result.data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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

@app.post("/api/webhook/lead-inserted")
async def webhook_lead_inserted(payload: WebhookLeadInsert):
    """Webhook endpoint called by Supabase when new lead is inserted"""
    try:
        print("\n" + "="*60)
        print("🔔 WEBHOOK: New Lead Inserted")
        print("="*60)
        
        # Validate webhook type
        if payload.type != 'INSERT' or payload.table != 'leads_list':
            return {"message": "Ignored: Not a lead insert event"}
        
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
        
        # Publish to crawler queue
        success = queue_publisher.publish_crawler_job(profile_url, template_id)
        
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
    """Manually trigger instant crawl for a single profile"""
    try:
        print("\n" + "="*60)
        print("⚡ INSTANT CRAWL REQUEST")
        print("="*60)
        print(f"🔗 Profile URL: {request.profile_url}")
        print(f"📁 Template ID: {request.template_id}")
        
        # Publish to crawler queue
        success = queue_publisher.publish_crawler_job(request.profile_url, request.template_id)
        
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
# SCRAPING REQUEST ENDPOINTS
# ============================================================================

@app.post("/api/scraping/start", response_model=ScrapingResponse)
@handle_api_errors
async def start_scraping(request: ScrapingRequest):
    """Start scraping for template ID"""
    try:
        print(f"📥 Start scraping for template: {request.template_id}")
        
        if not db:
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Get leads for this template
        from helper.supabase_helper import SupabaseManager
        supabase_manager = SupabaseManager()
        leads = supabase_manager.get_leads_by_template_id(request.template_id)
        
        if not leads:
            raise HTTPException(status_code=404, detail="No leads found for template")
        
        # Filter leads that need processing
        needs_processing = [lead for lead in leads if lead['needs_processing']]
        
        if not needs_processing:
            return ScrapingResponse(
                success=True,
                message="All leads already complete",
                leads_queued=0,
                batch_id=""
            )
        
        # Queue leads
        batch_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        queued_count = 0
        
        for lead in needs_processing:
            success = queue_publisher.publish_crawler_job(
                profile_url=lead['profile_url'],
                template_id=request.template_id
            )
            if success:
                queued_count += 1
        
        return ScrapingResponse(
            success=True,
            message=f"{queued_count} leads queued for scraping",
            leads_queued=queued_count,
            batch_id=batch_id
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# OUTREACH ENDPOINTS
# ============================================================================

@app.post("/api/outreach/send")
async def send_outreach(request: OutreachRequest):
    """Send outreach request to LavinMQ queue"""
    try:
        print("\n" + "="*60)
        print("📥 OUTREACH REQUEST RECEIVED")
        print("="*60)
        print(f"Total leads: {len(request.leads)}")
        print(f"Dry run: {request.dry_run}")
        print(f"Message: {request.message}")
        
        # Debug environment variables
        outreach_queue = os.getenv('OUTREACH_QUEUE')
        rabbitmq_host = os.getenv('RABBITMQ_HOST')
        print(f"OUTREACH_QUEUE env: {outreach_queue}")
        print(f"RABBITMQ_HOST env: {rabbitmq_host}")
        
        # Validate leads
        valid_leads = [
            lead for lead in request.leads
            if lead.get('name') and lead.get('profile_url')
        ]
        
        if not valid_leads:
            raise HTTPException(status_code=400, detail="No valid leads provided")
        
        print(f"✅ Valid leads: {len(valid_leads)}/{len(request.leads)}")
        
        # Debug each lead
        for i, lead in enumerate(valid_leads[:3]):  # Show first 3 leads
            print(f"  Lead {i+1}: {lead.get('name')} - {lead.get('profile_url')}")
        
        # Send each lead as separate message
        batch_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        queued_count = 0
        failed_count = 0
        
        for lead in valid_leads:
            print(f"\n📤 Attempting to queue: {lead['name']}")
            success = queue_publisher.publish_outreach_job(
                lead=lead,
                message_text=request.message,
                dry_run=request.dry_run,
                batch_id=batch_id
            )
            
            if success:
                queued_count += 1
                print(f"  ✓ Queued: {lead['name']}")
            else:
                failed_count += 1
                print(f"  ✗ Failed: {lead['name']}")
        
        print(f"\n📊 OUTREACH SUMMARY:")
        print(f"   Total leads: {len(request.leads)}")
        print(f"   Valid leads: {len(valid_leads)}")
        print(f"   Successfully queued: {queued_count}")
        print(f"   Failed to queue: {failed_count}")
        print(f"   Batch ID: {batch_id}")
        print("="*60 + "\n")
        
        return {
            "status": "success",
            "message": "Outreach messages queued successfully",
            "total_leads": len(request.leads),
            "valid_leads": len(valid_leads),
            "queued": queued_count,
            "failed": failed_count,
            "batch_id": batch_id,
            "dry_run": request.dry_run,
            "queue": outreach_queue
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# COMPANIES & LEADS ENDPOINTS
# ============================================================================

@app.get("/api/companies")
async def get_companies(platform: Optional[str] = None):
    """Get companies data, optionally filtered by platform"""
    try:
        companies = CompanyManager.get_all(platform)
        return {
            "success": True,
            "count": len(companies),
            "platform": platform,
            "companies": companies
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/companies/{company_id}")
async def get_company_by_id(company_id: str):
    """Get single company by ID"""
    try:
        company = CompanyManager.get_by_id(company_id)
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        
        return {"success": True, "company": company}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/leads/by-platform")
async def get_leads_by_platform(
    platform: str,
    limit: Optional[int] = 100,
    offset: Optional[int] = 0
):
    """Get leads filtered by company platform"""
    try:
        result = LeadsManager.get_by_platform(platform, limit, offset)
        
        return {
            "success": True,
            "platform": platform,
            "companies_found": len(result['companies']),
            "companies": result['companies'],
            "templates_found": len(result['templates']),
            "templates": result['templates'],
            "leads_count": result['total'],
            "leads_returned": len(result['leads']),
            "limit": limit,
            "offset": offset,
            "leads": result['leads']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/leads/by-company/{company_id}")
async def get_leads_by_company(
    company_id: str,
    limit: Optional[int] = 100,
    offset: Optional[int] = 0
):
    """Get leads filtered by company ID"""
    try:
        # Get company info
        company = CompanyManager.get_by_id(company_id)
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        
        # Get leads
        result = LeadsManager.get_by_company(company_id, limit, offset)
        
        return {
            "success": True,
            "company": company,
            "templates_found": len(result['templates']),
            "templates": result['templates'],
            "leads_count": result['total'],
            "leads_returned": len(result['leads']),
            "limit": limit,
            "offset": offset,
            "leads": result['leads']
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/leads/requeue")
async def requeue_failed_leads(request: ReQueueRequest):
    """Re-queue leads that failed scraping or scoring"""
    try:
        # Get failed leads
        failed_leads = ReQueueManager.get_failed_leads(
            template_id=request.template_id,
            check_profile_data=request.check_profile_data,
            check_scoring_data=request.check_scoring_data
        )
        
        if request.dry_run:
            # Just return what would be re-queued
            return {
                "success": True,
                "dry_run": True,
                "total_failed_leads": len(failed_leads),
                "template_id": request.template_id,
                "check_profile_data": request.check_profile_data,
                "check_scoring_data": request.check_scoring_data,
                "leads_to_requeue": [
                    {
                        "id": lead.get('id'),
                        "name": lead.get('name'),
                        "profile_url": lead.get('profile_url'),
                        "template_id": lead.get('template_id'),
                        "has_profile_data": bool(lead.get('profile_data')),
                        "has_scoring_data": bool(lead.get('scoring_data'))
                    }
                    for lead in failed_leads
                ]
            }
        
        # Actually re-queue the leads
        requeued_count = 0
        failed_requeue = []
        
        for lead in failed_leads:
            profile_url = lead.get('profile_url')
            template_id = lead.get('template_id')
            
            if profile_url:
                success = queue_publisher.publish_crawler_job(profile_url, template_id)
                if success:
                    requeued_count += 1
                else:
                    failed_requeue.append({
                        "id": lead.get('id'),
                        "name": lead.get('name'),
                        "profile_url": profile_url,
                        "error": "Failed to publish to queue"
                    })
        
        return {
            "success": True,
            "dry_run": False,
            "total_failed_leads": len(failed_leads),
            "requeued_successfully": requeued_count,
            "failed_to_requeue": len(failed_requeue),
            "template_id": request.template_id,
            "check_profile_data": request.check_profile_data,
            "check_scoring_data": request.check_scoring_data,
            "failed_requeue_details": failed_requeue
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ============================================
# HEALTH CHECK & MONITORING
# ============================================

@app.get("/health")
async def health_check():
    """
    Health check endpoint for CI/CD monitoring
    Returns status of all system components
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {}
    }
    
    # Check Supabase connection
    try:
        from helper.supabase_helper import supabase
        # Simple query to test connection
        result = supabase.table('leads_list').select('id').limit(1).execute()
        health_status["services"]["database"] = {
            "status": "healthy",
            "type": "supabase",
            "message": "Connection successful"
        }
    except Exception as e:
        health_status["services"]["database"] = {
            "status": "unhealthy",
            "type": "supabase", 
            "message": f"Connection failed: {str(e)}"
        }
        health_status["status"] = "degraded"
    
    # Check LavinMQ connection
    try:
        from helper.rabbitmq_helper import RabbitMQManager
        mq = RabbitMQManager()
        if mq.connect():
            mq.disconnect()
            health_status["services"]["queue"] = {
                "status": "healthy",
                "type": "lavinmq",
                "message": "Connection successful"
            }
        else:
            raise Exception("Failed to connect")
    except Exception as e:
        health_status["services"]["queue"] = {
            "status": "unhealthy",
            "type": "lavinmq",
            "message": f"Connection failed: {str(e)}"
        }
        health_status["status"] = "degraded"
    
    # Check API endpoints
    health_status["services"]["api"] = {
        "status": "healthy",
        "endpoints": {
            "schedules": "/api/schedules",
            "leads": "/api/leads",
            "requirements": "/api/requirements"
        }
    }
    
    return health_status
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
