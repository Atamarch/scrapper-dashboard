"""
Scoring Daemon
Automatically scores profiles from Supabase leads_list table
"""
import os
import time
import json
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from score import calculate_score
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
POLL_INTERVAL = int(os.getenv('POLL_INTERVAL', 60))  # 1 minute default
DEFAULT_REQUIREMENTS_ID = os.getenv('DEFAULT_REQUIREMENTS_ID', 'desk_collection')


def load_requirements(requirements_id):
    """Load requirements from JSON file"""
    requirements_file = f"requirements/{requirements_id}.json"
    
    if not os.path.exists(requirements_file):
        logger.error(f"Requirements file not found: {requirements_file}")
        return None
    
    with open(requirements_file, 'r') as f:
        return json.load(f)


def get_unscored_profiles():
    """Get profiles that haven't been scored yet"""
    try:
        response = supabase.table('leads_list')\
            .select('*')\
            .is_('score', 'null')\
            .eq('connection_status', 'scraped')\
            .execute()
        
        return response.data
    
    except Exception as e:
        logger.error(f"Error getting unscored profiles: {e}")
        return []


def score_profile(profile, requirements):
    """Score a single profile"""
    profile_id = profile['id']
    profile_url = profile.get('profile_url', 'Unknown')
    profile_data = profile.get('profile_data', {})
    name = profile.get('name', 'Unknown')
    
    try:
        logger.info(f"Scoring: {name} - {profile_url}")
        
        # Calculate score
        score_result = calculate_score(profile_data, requirements)
        
        # Update leads_list with score
        supabase.table('leads_list').update({
            'score': score_result['total_score'],
            'scored_at': datetime.now().date().isoformat()
        }).eq('id', profile_id).execute()
        
        logger.info(f"✓ Scored: {name} - Score: {score_result['total_score']:.2f}")
        
        return True
    
    except Exception as e:
        logger.error(f"✗ Failed to score {name}: {e}")
        return False


def main():
    """Main daemon loop"""
    logger.info("="*60)
    logger.info("SCORING DAEMON STARTED")
    logger.info(f"Poll Interval: {POLL_INTERVAL} seconds")
    logger.info(f"Requirements: {DEFAULT_REQUIREMENTS_ID}")
    logger.info(f"Supabase URL: {os.getenv('SUPABASE_URL')}")
    logger.info("="*60)
    
    # Load requirements
    requirements = load_requirements(DEFAULT_REQUIREMENTS_ID)
    if not requirements:
        logger.error("Failed to load requirements. Exiting.")
        return
    
    while True:
        try:
            logger.info(f"\n[{datetime.now()}] Checking for unscored profiles...")
            
            unscored_profiles = get_unscored_profiles()
            
            if unscored_profiles:
                logger.info(f"Found {len(unscored_profiles)} unscored profile(s)")
                
                success_count = 0
                failed_count = 0
                
                for profile in unscored_profiles:
                    if score_profile(profile, requirements):
                        success_count += 1
                    else:
                        failed_count += 1
                
                logger.info(f"\n{'='*60}")
                logger.info(f"SCORING BATCH COMPLETED")
                logger.info(f"✓ Success: {success_count}")
                logger.info(f"✗ Failed: {failed_count}")
                logger.info(f"{'='*60}\n")
            else:
                logger.info("No unscored profiles")
            
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
