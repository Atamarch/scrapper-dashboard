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
from crawler import LinkedInCrawler
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
    """Execute a scheduled crawl job"""
    schedule_id = schedule['id']
    schedule_name = schedule['name']
    file_id = schedule.get('file_id')
    profile_urls = schedule.get('profile_urls', [])
    
    # Priority 1: If JSON file is linked, get URLs from there
    if file_id:
        try:
            json_response = supabase.table('crawler_jobs').select('*').eq('id', file_id).execute()
            if json_response.data and len(json_response.data) > 0:
                json_data = json_response.data[0].get('value', [])
                profile_urls = [item.get('profile_url') or item.get('url') for item in json_data if item.get('profile_url') or item.get('url')]
                logger.info(f"Loaded {len(profile_urls)} URLs from JSON file: {schedule.get('file_name')}")
        except Exception as e:
            logger.error(f"Error loading JSON file: {e}")
    
    # Priority 2: If no file_id and no profile_urls, get from Supabase unscraped profiles
    if not profile_urls:
        logger.info(f"No JSON file linked, checking for unscraped profiles in Supabase...")
        profile_urls = get_unscraped_profiles_from_supabase(limit=100)
        
        if profile_urls:
            logger.info(f"Found {len(profile_urls)} unscraped profiles to process")
        else:
            logger.warning(f"Schedule {schedule_name} has no profile URLs to process")
            return
    
    logger.info(f"\n{'='*60}")
    logger.info(f"EXECUTING SCHEDULE: {schedule_name}")
    logger.info(f"Schedule ID: {schedule_id}")
    logger.info(f"Profile URLs: {len(profile_urls)}")
    logger.info(f"{'='*60}\n")
    
    # Update last_run
    try:
        supabase.table('crawler_schedules').update({
            'last_run': datetime.now().isoformat()
        }).eq('id', schedule_id).execute()
    except Exception as e:
        logger.error(f"Error updating last_run: {e}")
    
    # Initialize crawler
    crawler = None
    success_count = 0
    failed_count = 0
    skipped_count = 0
    
    try:
        crawler = LinkedInCrawler()
        crawler.login()
        
        for idx, url in enumerate(profile_urls, 1):
            logger.info(f"[{idx}/{len(profile_urls)}] Processing: {url}")
            
            try:
                # Check if already scraped (has profile_data)
                existing = supabase.table('leads_list')\
                    .select('profile_data')\
                    .eq('profile_url', url)\
                    .execute()
                
                if existing.data and len(existing.data) > 0:
                    existing_profile_data = existing.data[0].get('profile_data')
                    if existing_profile_data and existing_profile_data != {}:
                        logger.info(f"⊘ Skipped (already scraped): {url}")
                        skipped_count += 1
                        continue
                
                # Scrape profile
                profile_data = crawler.get_profile(url)
                
                # Extract name from profile data
                name = profile_data.get('name', 'Unknown')
                
                # Check if lead exists
                if existing.data and len(existing.data) > 0:
                    # Update existing lead
                    supabase.table('leads_list').update({
                        'name': name,
                        'profile_data': profile_data,
                        'connection_status': 'scraped'
                    }).eq('profile_url', url).execute()
                    logger.info(f"✓ Updated: {name} - {url}")
                else:
                    # Insert new lead
                    supabase.table('leads_list').insert({
                        'profile_url': url,
                        'name': name,
                        'profile_data': profile_data,
                        'connection_status': 'scraped',
                        'date': datetime.now().date().isoformat()
                    }).execute()
                    logger.info(f"✓ Inserted: {name} - {url}")
                
                success_count += 1
                
            except Exception as e:
                failed_count += 1
                logger.error(f"✗ Failed: {url} - {e}")
    
    finally:
        if crawler:
            crawler.close()
    
    logger.info(f"\n{'='*60}")
    logger.info(f"SCHEDULE COMPLETED: {schedule_name}")
    logger.info(f"✓ Success: {success_count}")
    logger.info(f"⊘ Skipped: {skipped_count}")
    logger.info(f"✗ Failed: {failed_count}")
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
