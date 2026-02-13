"""
Scheduler service using APScheduler
Handles cron-based job scheduling
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
import sys
import os
from pathlib import Path
import queue
import threading

# Add crawler to path
sys.path.append(str(Path(__file__).parent.parent / "crawler"))

from crawler import LinkedInCrawler


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
        """Execute crawl task"""
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
        max_workers = schedule.get('max_workers', 3)
        
        if not profile_urls:
            print("⚠ No profile URLs configured")
            return
        
        # Run crawl
        self.run_crawl_task(profile_urls, max_workers, schedule_id)
    
    def run_crawl_task(
        self,
        profile_urls: list,
        max_workers: int = 3,
        schedule_id: str = None
    ):
        """Run crawl task with multiple workers"""
        print(f"\n→ Starting crawl with {max_workers} workers")
        print(f"→ Total profiles: {len(profile_urls)}")
        
        # Create queue
        url_queue = queue.Queue()
        for url in profile_urls:
            url_queue.put(url)
        
        # Statistics
        stats = {
            'processing': 0,
            'completed': 0,
            'failed': 0,
            'skipped': 0
        }
        
        # Worker function
        def worker(worker_id):
            print(f"[Worker {worker_id}] Started")
            
            crawler = None
            
            while True:
                try:
                    url = url_queue.get(timeout=2)
                    
                    print(f"\n[Worker {worker_id}] Processing: {url}")
                    
                    # Add to history
                    history_id = self.db.add_crawl_history(
                        profile_url=url,
                        status='processing',
                        schedule_id=schedule_id
                    )
                    
                    stats['processing'] += 1
                    
                    crawler = LinkedInCrawler()
                    
                    try:
                        # Login
                        crawler.login()
                        
                        # Scrape
                        profile_data = crawler.get_profile(url)
                        
                        # Save
                        from main import save_profile_data
                        output_file = save_profile_data(profile_data)
                        
                        # Update history
                        self.db.update_crawl_history(history_id, {
                            'status': 'completed',
                            'output_file': output_file
                        })
                        
                        stats['completed'] += 1
                        print(f"[Worker {worker_id}] ✓ Completed")
                        
                    except Exception as e:
                        stats['failed'] += 1
                        
                        # Update history
                        self.db.update_crawl_history(history_id, {
                            'status': 'failed',
                            'error_message': str(e)
                        })
                        
                        print(f"[Worker {worker_id}] ✗ Error: {e}")
                    
                    finally:
                        if crawler:
                            crawler.close()
                            crawler = None
                        url_queue.task_done()
                        stats['processing'] -= 1
                
                except queue.Empty:
                    if url_queue.empty():
                        print(f"[Worker {worker_id}] No more URLs, stopping")
                        break
        
        # Start workers
        threads = []
        for i in range(max_workers):
            t = threading.Thread(target=worker, args=(i+1,))
            t.daemon = True
            t.start()
            threads.append(t)
        
        # Wait for completion
        url_queue.join()
        
        # Print final stats
        print(f"\n{'='*60}")
        print("CRAWL COMPLETED")
        print(f"{'='*60}")
        print(f"Total: {len(profile_urls)}")
        print(f"✓ Completed: {stats['completed']}")
        print(f"✗ Failed: {stats['failed']}")
        print(f"⊘ Skipped: {stats['skipped']}")
        print(f"{'='*60}\n")
