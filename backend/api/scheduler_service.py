"""
Scheduler service using APScheduler
Handles cron-based job scheduling
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
import json


class SchedulerService:
    def __init__(self, database):
        self.db = database
        self.scheduler = BackgroundScheduler()
        self.running = False
    
    def start(self):
        """Start the scheduler"""
        if not self.running:
            self.scheduler.start()
            self.running = True
            
            # Load existing schedules
            self._load_schedules()
    
    def stop(self):
        """Stop the scheduler"""
        if self.running:
            self.scheduler.shutdown()
            self.running = False
    
    def is_running(self):
        """Check if scheduler is running"""
        return self.running
    
    def _load_schedules(self):
        """Load all active schedules from database"""
        schedules = self.db.get_active_schedules()
        for schedule in schedules:
            try:
                self.add_job(schedule['id'])
                print(f"✓ Loaded schedule: {schedule['name']}")
            except Exception as e:
                print(f"✗ Failed to load schedule {schedule['name']}: {e}")
    
    def add_job(self, schedule_id: str):
        """Add job to scheduler"""
        schedule = self.db.get_schedule(schedule_id)
        if not schedule:
            raise ValueError(f"Schedule {schedule_id} not found")
        
        if schedule['status'] != 'active':
            return
        
        # Parse cron expression
        cron_parts = schedule['start_schedule'].split()
        if len(cron_parts) != 5:
            raise ValueError(f"Invalid cron expression: {schedule['start_schedule']}")
        
        minute, hour, day, month, day_of_week = cron_parts
        
        # Create trigger
        trigger = CronTrigger(
            minute=minute,
            hour=hour,
            day=day,
            month=month,
            day_of_week=day_of_week
        )
        
        # Add job
        self.scheduler.add_job(
            func=self._execute_crawl,
            trigger=trigger,
            id=schedule_id,
            args=[schedule_id],
            replace_existing=True,
            name=schedule['name']
        )
        
        print(f"✓ Added job: {schedule['name']} ({schedule['start_schedule']})")
    
    def remove_job(self, schedule_id: str):
        """Remove job from scheduler"""
        try:
            self.scheduler.remove_job(schedule_id)
            print(f"✓ Removed job: {schedule_id}")
        except Exception as e:
            print(f"✗ Failed to remove job {schedule_id}: {e}")
    
    def pause_job(self, schedule_id: str):
        """Pause job"""
        try:
            self.scheduler.pause_job(schedule_id)
            print(f"✓ Paused job: {schedule_id}")
        except Exception as e:
            print(f"✗ Failed to pause job {schedule_id}: {e}")
    
    def resume_job(self, schedule_id: str):
        """Resume job"""
        try:
            self.scheduler.resume_job(schedule_id)
            print(f"✓ Resumed job: {schedule_id}")
        except Exception as e:
            print(f"✗ Failed to resume job {schedule_id}: {e}")
    
    def reschedule_job(self, schedule_id: str):
        """Reschedule job (remove and add again)"""
        self.remove_job(schedule_id)
        self.add_job(schedule_id)
    
    def _execute_crawl(self, schedule_id: str):
        """Execute crawl task by sending to queue"""
        print(f"\n{'='*60}")
        print(f"SCHEDULED CRAWL STARTED: {datetime.now()}")
        print(f"Schedule ID: {schedule_id}")
        print(f"{'='*60}")
        
        schedule = self.db.get_schedule(schedule_id)
        if not schedule:
            print(f"✗ Schedule {schedule_id} not found")
            return
        
        # Update last run
        self.db.update_last_run(schedule_id)
        
        # Get profile URLs
        profile_urls = schedule.get('profile_urls', [])
        
        if not profile_urls:
            print("⚠ No profile URLs configured")
            return
        
        # Send to queue (implement queue logic here)
        # For now, just log
        print(f"→ Sending {len(profile_urls)} profiles to crawler queue")
        
        # TODO: Implement queue sending
        # Example:
        # for url in profile_urls:
        #     queue.send_message('crawler_queue', {'url': url, 'schedule_id': schedule_id})
        
        print(f"✓ Sent {len(profile_urls)} profiles to queue")
        print(f"{'='*60}\n")
