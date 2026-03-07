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
            
            # Load existing scheduless
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
        """Execute crawl task by queueing leads to RabbitMQ"""
        print(f"\n{'='*60}")
        print(f"⏰ SCHEDULED CRAWL TRIGGERED: {datetime.now()}")
        print(f"Schedule ID: {schedule_id}")
        print(f"{'='*60}")
        
        schedule = self.db.get_schedule(schedule_id)
        if not schedule:
            print(f"✗ Schedule {schedule_id} not found")
            return
        
        # Update last run timestamp
        self.db.update_last_run(schedule_id)
        
        # Get template_id from schedule
        template_id = schedule.get('template_id')
        if not template_id:
            print("⚠ No template_id configured in schedule")
            return
        
        print(f"📋 Template ID: {template_id}")
        
        # Import here to avoid circular dependency
        from helper.supabase_helper import SupabaseManager
        from helper.rabbitmq_helper import queue_publisher
        
        try:
            # Get leads for this template
            supabase_manager = SupabaseManager()
            leads = supabase_manager.get_leads_by_template_id(template_id)
            
            if not leads:
                print("⚠ No leads found for template")
                return
            
            # Filter leads that need processing
            needs_processing = [lead for lead in leads if lead.get('needs_processing', False)]
            
            if not needs_processing:
                print("✓ All leads already complete, nothing to queue")
                return
            
            print(f"📊 Found {len(needs_processing)} leads that need processing")
            
            # Queue leads to RabbitMQ
            queued_count = 0
            for lead in needs_processing:
                success = queue_publisher.publish_crawler_job(
                    profile_url=lead['profile_url'],
                    template_id=template_id
                )
                if success:
                    queued_count += 1
            
            print(f"✅ Successfully queued {queued_count}/{len(needs_processing)} leads to RabbitMQ")
            print(f"{'='*60}\n")
            
        except Exception as e:
            print(f"❌ Error executing scheduled crawl: {e}")
            import traceback
            traceback.print_exc()
            print(f"{'='*60}\n")
