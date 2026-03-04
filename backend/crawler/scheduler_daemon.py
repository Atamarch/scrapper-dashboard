"""
Crawler Scheduler Daemon
Polls Supabase for scheduled crawl jobs and executes them
"""
import os
import time
import json
from datetime import datetime, timedelta
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
POLL_INTERVAL = int(os.getenv('POLL_INTERVAL', 300))  # 5 minutes default
DEFAULT_REQUIREMENTS_ID = os.getenv('DEFAULT_REQUIREMENTS_ID', 'desk_collection')


def get_pending_schedules():
    """Get schedules that should run now"""
    try:
        # Get active schedules
        response = supabase.table('crawler_schedules').select('*').eq('status', 'active').execute()
        schedules = response.data
        
        pending = []
        now = datetime.now()
        
        for schedule in schedules:
            last_run = schedule.get('last_run')
            
            # If never run, check if it's time
            if not last_run:
                pending.append(schedule)
                continue
            
            # Parse last run time
            last_run_time = datetime.fromisoformat(last_run.replace('Z', '+00:00'))
            
            # Check if enough time has passed based on cron schedule
            # For simplicity, we'll run if last_run was more than 1 hour ago
            # TODO: Implement proper cron parsing
            if (now - last_run_time) > timedelta(hours=1):
                pending.append(schedule)
        
        return pending
    
    except Exception as e:
        logger.error(f"Error getting pending schedules: {e}")
        return []


def get_unscraped_profiles_from_supabase(limit=100):
    """Get profile URLs from leads_list that haven't been scraped yet
    
    Criteria: profile_data is null or empty
    """
    try:
        # Get leads where profile_data is null or empty
        response = supabase.table('leads_list')\
            .select('profile_url, name')\
            .is_('profile_data', 'null')\
            .limit(limit)\
            .execute()
        
        urls = []
        if response.data:
            for lead in response.data:
                url = lead.get('profile_url')
                if url:
                    urls.append(url)
        
        logger.info(f"Found {len(urls)} unscraped profiles in Supabase")
        return urls
    
    except Exception as e:
        logger.error(f"Error getting unscraped profiles: {e}")
        return []


def execute_schedule(schedule):
    """Execute a scheduled crawl job by starting consumer to process queue"""
    schedule_id = schedule['id']
    schedule_name = schedule['name']
    
    logger.info(f"\n{'='*60}")
    logger.info(f"EXECUTING SCHEDULE: {schedule_name}")
    logger.info(f"Schedule ID: {schedule_id}")
    logger.info(f"{'='*60}\n")
    
    # Update last_run
    try:
        supabase.table('crawler_schedules').update({
            'last_run': datetime.now().isoformat()
        }).eq('id', schedule_id).execute()
    except Exception as e:
        logger.error(f"Error updating last_run: {e}")
    
    # Start consumer to process queue
    logger.info(f"🚀 Starting consumer to process queue...")
    logger.info(f"   Consumer will process all messages in queue, then exit")
    
    try:
        import subprocess
        
        # Run scheduled_consumer.py
        result = subprocess.run(
            ['python', 'scheduled_consumer.py'],
            cwd=os.path.dirname(os.path.abspath(__file__)),
            capture_output=True,
            text=True,
            timeout=3600  # 1 hour timeout
        )
        
        # Print consumer output
        if result.stdout:
            logger.info(f"\n{result.stdout}")
        
        if result.stderr:
            logger.error(f"\n{result.stderr}")
        
        if result.returncode == 0:
            logger.info(f"✓ Consumer finished successfully")
        else:
            logger.error(f"✗ Consumer exited with code: {result.returncode}")
    
    except subprocess.TimeoutExpired:
        logger.error(f"✗ Consumer timeout (exceeded 1 hour)")
    except Exception as e:
        logger.error(f"✗ Failed to start consumer: {e}")
        import traceback
        traceback.print_exc()
    
    logger.info(f"\n{'='*60}")
    logger.info(f"SCHEDULE COMPLETED: {schedule_name}")
    logger.info(f"{'='*60}\n")


def main():
    """Main daemon loop"""
    logger.info("="*60)
    logger.info("CRAWLER SCHEDULER DAEMON STARTED")
    logger.info(f"Poll Interval: {POLL_INTERVAL} seconds")
    logger.info(f"Supabase URL: {os.getenv('SUPABASE_URL')}")
    logger.info("="*60)
    
    while True:
        try:
            logger.info(f"\n[{datetime.now()}] Checking for pending schedules...")
            
            pending_schedules = get_pending_schedules()
            
            if pending_schedules:
                logger.info(f"Found {len(pending_schedules)} pending schedule(s)")
                
                for schedule in pending_schedules:
                    execute_schedule(schedule)
            else:
                logger.info("No pending schedules")
            
            logger.info(f"Sleeping for {POLL_INTERVAL} seconds...\n")
            time.sleep(POLL_INTERVAL)
        
        except KeyboardInterrupt:
            logger.info("\n\nShutting down gracefully...")
            break
        
        except Exception as e:
            logger.error(f"Error in main loop: {e}")
            logger.info(f"Retrying in {POLL_INTERVAL} seconds...")
            time.sleep(POLL_INTERVAL)


if __name__ == '__main__':
    main()
