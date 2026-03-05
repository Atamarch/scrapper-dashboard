"""
Crawler Manager - Start/Stop Crawler Consumer Based on Schedule
Manages crawler consumer process lifecycle based on database schedules
"""
import os
import sys
import time
import signal
import subprocess
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client, Client
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment
load_dotenv()

# Supabase client
supabase: Client = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_KEY')
)

# Config
POLL_INTERVAL = int(os.getenv('POLL_INTERVAL', 60))  # Check every 1 minute
CRAWLER_SCRIPT = 'crawler_consumer.py'
PYTHON_PATH = sys.executable  # Use same Python as manager


class CrawlerManager:
    def __init__(self):
        self.crawler_process = None
        self.is_running = False
        self.current_schedule_id = None
    
    def get_active_schedules(self):
        """Get schedules that should be running now"""
        try:
            # Get all active schedules
            response = supabase.table('crawler_schedules')\
                .select('*')\
                .eq('status', 'active')\
                .execute()
            
            schedules = response.data or []
            
            # Check which schedules should be running now
            now = datetime.now(timezone.utc)  # Use UTC timezone
            current_hour = now.hour
            current_minute = now.minute
            current_day = now.weekday()  # 0=Monday, 6=Sunday
            
            running_schedules = []
            
            for schedule in schedules:
                start_schedule = schedule.get('start_schedule', '')
                stop_schedule = schedule.get('stop_schedule', '')
                
                # Parse cron expressions (simplified)
                should_run = self._should_run_now(
                    start_schedule, 
                    stop_schedule, 
                    current_hour, 
                    current_minute, 
                    current_day
                )
                
                if should_run:
                    running_schedules.append(schedule)
            
            return running_schedules
        
        except Exception as e:
            logger.error(f"Error getting schedules: {e}")
            return []
    
    def _should_run_now(self, start_cron, stop_cron, hour, minute, day):
        """
        Check if crawler should be running based on cron expressions
        Improved cron parser with proper time range checking
        """
        try:
            # Parse start cron: "minute hour day month weekday"
            # Example: "0 9 * * *" = every day at 9:00
            # Example: "0 9 * * 1-5" = weekdays at 9:00
            
            if not start_cron:
                return False
            
            parts = start_cron.split()
            if len(parts) < 5:
                return False
            
            start_minute = parts[0]
            start_hour = parts[1]
            # day_of_month = parts[2]  # Not used for now
            # month = parts[3]  # Not used for now
            weekday = parts[4]
            
            # Check weekday first
            if weekday != '*':
                # Parse weekday range (e.g., "1-5" for Mon-Fri)
                if '-' in weekday:
                    start_day, end_day = map(int, weekday.split('-'))
                    if not (start_day <= day <= end_day):
                        logger.debug(f"Not running - wrong weekday: {day} not in {start_day}-{end_day}")
                        return False
                elif weekday.isdigit():
                    if int(weekday) != day:
                        logger.debug(f"Not running - wrong weekday: {day} != {weekday}")
                        return False
            
            # Parse start time
            if start_hour == '*':
                start_h = 0
            else:
                start_h = int(start_hour)
            
            if start_minute == '*':
                start_m = 0
            else:
                start_m = int(start_minute)
            
            # Parse stop time (if exists)
            stop_h = 23
            stop_m = 59
            
            if stop_cron:
                stop_parts = stop_cron.split()
                if len(stop_parts) >= 2:
                    if stop_parts[1] != '*':
                        stop_h = int(stop_parts[1])
                    if stop_parts[0] != '*':
                        stop_m = int(stop_parts[0])
            
            # Convert current time and schedule times to minutes for easier comparison
            current_minutes = hour * 60 + minute
            start_minutes = start_h * 60 + start_m
            stop_minutes = stop_h * 60 + stop_m
            
            # Check if current time is within the scheduled range
            if start_minutes <= stop_minutes:
                # Normal case: start and stop on same day (e.g., 9:00 to 17:00)
                is_in_range = start_minutes <= current_minutes <= stop_minutes
            else:
                # Overnight case: start late, stop early next day (e.g., 22:00 to 06:00)
                is_in_range = current_minutes >= start_minutes or current_minutes <= stop_minutes
            
            if is_in_range:
                logger.debug(f"Should run - time {hour:02d}:{minute:02d} is within {start_h:02d}:{start_m:02d} to {stop_h:02d}:{stop_m:02d}")
                return True
            else:
                logger.debug(f"Not running - time {hour:02d}:{minute:02d} is outside {start_h:02d}:{start_m:02d} to {stop_h:02d}:{stop_m:02d}")
                return False
        
        except Exception as e:
            logger.error(f"Error parsing cron: {e}")
            return False
    
    def start_crawler(self, schedule_id):
        """Start crawler consumer process"""
        if self.is_running:
            logger.info("Crawler already running")
            return
        
        try:
            logger.info(f"Starting crawler consumer for schedule: {schedule_id}")
            
            # Start crawler_consumer.py as subprocess
            self.crawler_process = subprocess.Popen(
                [PYTHON_PATH, CRAWLER_SCRIPT],
                cwd=os.path.dirname(os.path.abspath(__file__)),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            self.is_running = True
            self.current_schedule_id = schedule_id
            
            logger.info(f"✓ Crawler consumer started (PID: {self.crawler_process.pid})")
        
        except Exception as e:
            logger.error(f"Failed to start crawler: {e}")
            self.is_running = False
    
    def stop_crawler(self):
        """Stop crawler consumer process"""
        if not self.is_running or not self.crawler_process:
            logger.info("Crawler not running")
            return
        
        try:
            logger.info("Stopping crawler consumer...")
            
            # Send SIGTERM (graceful shutdown)
            self.crawler_process.terminate()
            
            # Wait up to 30 seconds for graceful shutdown
            try:
                self.crawler_process.wait(timeout=30)
            except subprocess.TimeoutExpired:
                # Force kill if not stopped
                logger.warning("Crawler didn't stop gracefully, forcing kill...")
                self.crawler_process.kill()
                self.crawler_process.wait()
            
            self.is_running = False
            self.current_schedule_id = None
            
            logger.info("✓ Crawler consumer stopped")
        
        except Exception as e:
            logger.error(f"Error stopping crawler: {e}")
    
    def check_crawler_health(self):
        """Check if crawler process is still alive"""
        if self.is_running and self.crawler_process:
            poll = self.crawler_process.poll()
            if poll is not None:
                # Process died
                logger.warning(f"Crawler process died with code: {poll}")
                self.is_running = False
                self.current_schedule_id = None
                return False
        return True
    
    def run(self):
        """Main loop"""
        logger.info("="*60)
        logger.info("CRAWLER MANAGER STARTED")
        logger.info(f"Poll Interval: {POLL_INTERVAL} seconds")
        logger.info(f"Python: {PYTHON_PATH}")
        logger.info(f"Crawler Script: {CRAWLER_SCRIPT}")
        logger.info("="*60)
        
        try:
            while True:
                # Check crawler health
                self.check_crawler_health()
                
                # Get schedules that should be running
                running_schedules = self.get_active_schedules()
                
                if running_schedules:
                    # Should be running
                    if not self.is_running:
                        # Start crawler
                        schedule = running_schedules[0]  # Use first schedule
                        logger.info(f"Schedule active: {schedule['name']}")
                        logger.info(f"  Start: {schedule.get('start_schedule', 'N/A')}")
                        logger.info(f"  Stop: {schedule.get('stop_schedule', 'N/A')}")
                        self.start_crawler(schedule['id'])
                    else:
                        logger.debug(f"Crawler running (Schedule: {self.current_schedule_id})")
                else:
                    # Should not be running
                    if self.is_running:
                        logger.info("No active schedules, stopping crawler")
                        self.stop_crawler()
                    else:
                        # Show debug info about why no schedules are active
                        now = datetime.now(timezone.utc)
                        logger.debug(f"Crawler idle - no active schedules at {now.strftime('%H:%M')} UTC (weekday: {now.weekday()})")
                        
                        # Show active schedules for debugging (less frequent)
                        if time.time() % 300 < POLL_INTERVAL:  # Every 5 minutes
                            try:
                                response = supabase.table('crawler_schedules').select('name, start_schedule, stop_schedule, status').eq('status', 'active').execute()
                                if response.data:
                                    logger.info("Active schedules:")
                                    for schedule in response.data:
                                        logger.info(f"  - {schedule['name']}: {schedule.get('start_schedule', 'N/A')} to {schedule.get('stop_schedule', 'N/A')}")
                                else:
                                    logger.info("No active schedules found in database")
                            except Exception as e:
                                logger.error(f"Error fetching schedules for debug: {e}")
                
                # Sleep
                time.sleep(POLL_INTERVAL)
        
        except KeyboardInterrupt:
            logger.info("\n\nShutting down gracefully...")
            if self.is_running:
                self.stop_crawler()
        
        except Exception as e:
            logger.error(f"Fatal error: {e}")
            if self.is_running:
                self.stop_crawler()


def main():
    manager = CrawlerManager()
    manager.run()


if __name__ == '__main__':
    main()
