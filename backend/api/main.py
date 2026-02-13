"""
FastAPI Backend for LinkedIn Crawler Scheduler
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import os
import sys
from pathlib import Path

# Add crawler to path
sys.path.append(str(Path(__file__).parent.parent / "crawler"))

from scheduler_service import SchedulerService
from database import Database

app = FastAPI(title="LinkedIn Crawler API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
db = Database()
scheduler = SchedulerService(db)

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


@app.on_event("startup")
async def startup_event():
    """Initialize database and start scheduler"""
    db.init_db()
    scheduler.start()
    print("✓ Scheduler started")

@app.on_event("shutdown")
async def shutdown_event():
    """Stop scheduler gracefully"""
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
        "scheduler_running": scheduler.is_running(),
        "timestamp": datetime.now().isoformat()
    }


# Schedule endpoints
@app.get("/api/schedules")
async def get_schedules():
    """Get all scheduled jobs"""
    schedules = db.get_all_schedules()
    return {"schedules": schedules}

@app.get("/api/schedules/{schedule_id}")
async def get_schedule(schedule_id: str):
    """Get specific schedule"""
    schedule = db.get_schedule(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule

@app.post("/api/schedules")
async def create_schedule(schedule: ScheduleCreate):
    """Create new scheduled job"""
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
    try:
        scheduler.remove_job(schedule_id)
        db.delete_schedule(schedule_id)
        return {"message": "Schedule deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/schedules/{schedule_id}/toggle")
async def toggle_schedule(schedule_id: str):
    """Toggle schedule status (active/paused)"""
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
    stats = db.get_stats()
    return stats


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
