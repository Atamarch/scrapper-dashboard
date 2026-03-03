"""
Crawler Manager - Start/Stop Crawler Consumer Based on Schedule
Manages crawler consumer process lifecycle based on database schedules
"""
import os
import sys
import time
import signal
import subprocess
from datetime import datetime
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
            now = datetime.now()
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
        Simplified cron parser for common patterns
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
            
            # Check weekday
            if weekday != '*':
                # Parse weekday range (e.g., "1-5" for Mon-Fri)
                if '-' in weekday:
                    start_day, end_day = map(int, weekday.split('-'))
                    if not (start_day <= day <= end_day):
                        return False
                elif weekday.isdigit():
                    if int(weekday) != day:
                        return False
            
            # Check if we're past start time
            if start_hour != '*':
                start_h = int(start_hour)
                if hour < start_h:
                    return False
                if hour == start_h and start_minute != '*':
                    start_m = int(start_minute)
                    if minute < start_m:
                        return False
            
            # Check if we're before stop time (if exists)
            if stop_cron:
                stop_parts = stop_cron.split()
                if len(stop_parts) >= 2:
                    stop_minute = stop_parts[0]
                    stop_hour = stop_parts[1]
                    
                    if stop_hour != '*':
                        stop_h = int(stop_hour)
                        if hour > stop_h:
                            return False
                        if hour == stop_h and stop_minute != '*':
                            stop_m = int(stop_minute)
                            if minute >= stop_m:
                                return False
            
            return True
        
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
                        self.start_crawler(schedule['id'])
                    else:
                        logger.debug(f"Crawler running (Schedule: {self.current_schedule_id})")
                else:
                    # Should not be running
                    if self.is_running:
                        logger.info("No active schedules, stopping crawler")
                        self.stop_crawler()
                    else:
                        logger.debug("Crawler idle (no active schedules)")
                
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
