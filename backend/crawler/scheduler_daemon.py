"""
Crawler Scheduler Daemon
Polls Supabase for scheduled crawl jobs and executes them
Auto-starts crawler consumer when needed
"""
import os
import time
import json
import subprocess
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client
import logging
import psutil

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
POLL_INTERVAL = int(os.getenv('POLL_INTERVAL', 60))  # 1 minute default
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
    """Execute a scheduled crawl job - Start consumer if needed"""
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
        logger.info(f"✓ Updated last_run timestamp")
    except Exception as e:
        logger.error(f"Error updating last_run: {e}")
    
    # Check queue status
    try:
        import pika
        
        credentials = pika.PlainCredentials(
            os.getenv('RABBITMQ_USER', 'guest'),
            os.getenv('RABBITMQ_PASS', 'guest')
        )
        parameters = pika.ConnectionParameters(
            host=os.getenv('RABBITMQ_HOST', 'localhost'),
            port=int(os.getenv('RABBITMQ_PORT', 5672)),
            virtual_host=os.getenv('RABBITMQ_VHOST', '/'),
            credentials=credentials
        )
        
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        
        # Check queue size
        queue_name = os.getenv('RABBITMQ_QUEUE', 'linkedin_profiles')
        queue_state = channel.queue_declare(queue=queue_name, durable=True, passive=True)
        queue_size = queue_state.method.message_count
        
        connection.close()
        
        logger.info(f"📊 Queue Status:")
        logger.info(f"   - Queue: {queue_name}")
        logger.info(f"   - Messages waiting: {queue_size}")
        
        if queue_size > 0:
            logger.info(f"✅ Queue has {queue_size} messages ready to be processed")
            
            # Auto-start crawler consumer if not running
            if not is_consumer_running():
                logger.info(f"🚀 Starting crawler consumer automatically...")
                start_crawler_consumer()
            else:
                logger.info(f"✅ Crawler consumer is already running")
        else:
            logger.info(f"ℹ️  Queue is empty - no profiles to process")
        
    except Exception as e:
        logger.error(f"✗ Failed to check queue: {e}")
    
    logger.info(f"\n{'='*60}")
    logger.info(f"SCHEDULE COMPLETED: {schedule_name}")
    logger.info(f"{'='*60}\n")


def is_consumer_running():
    """Check if crawler consumer is already running"""
    import psutil
    
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmdline = proc.info['cmdline']
            if cmdline and 'python' in cmdline[0] and 'crawler_consumer.py' in ' '.join(cmdline):
                logger.info(f"✅ Found running consumer: PID {proc.info['pid']}")
                return True
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    
    return False


def start_crawler_consumer():
    """Start crawler consumer as background process"""
    import subprocess
    import os
    
    try:
        # Get current directory (should be backend/crawler)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        consumer_path = os.path.join(current_dir, 'crawler_consumer.py')
        
        # Start consumer as background process
        process = subprocess.Popen(
            ['python', consumer_path],
            cwd=current_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0
        )
        
        logger.info(f"🚀 Crawler consumer started with PID: {process.pid}")
        logger.info(f"📁 Working directory: {current_dir}")
        logger.info(f"🐍 Command: python {consumer_path}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to start crawler consumer: {e}")
        return False


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
