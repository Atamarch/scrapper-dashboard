"""LinkedIn Profile Scraper with Scoring Integration - Refactored with Helper Modules"""
import json
import glob
import os
import threading
import time
import hashlib
import pika
from datetime import datetime
from dotenv import load_dotenv
from crawler import LinkedInCrawler
from helper.rabbitmq_helper import RabbitMQManager, ack_message, nack_message
from helper.supabase_helper import SupabaseManager

load_dotenv()


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_profile_hash(profile_url):
    """Generate unique hash from profile URL"""
    return hashlib.md5(profile_url.encode()).hexdigest()[:8]


def check_if_already_crawled(profile_url, output_dir='data/output'):
    """Check if profile URL has already been crawled"""
    if not os.path.exists(output_dir):
        return False, None
    
    url_hash = get_profile_hash(profile_url)
    pattern = os.path.join(output_dir, f"*_{url_hash}.json")
    existing_files = glob.glob(pattern)
    
    if existing_files:
        return True, existing_files[0]
    
    all_files = glob.glob(os.path.join(output_dir, "*.json"))
    for filepath in all_files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if data.get('profile_url') == profile_url:
                    return True, filepath
        except:
            continue
    
    return False, None


def save_profile_data(profile_data, output_dir='data/output'):
    """Save profile data to JSON file (with duplicate prevention)"""
    os.makedirs(output_dir, exist_ok=True)
    
    profile_url = profile_data.get('profile_url', '')
    
    if profile_url:
        already_exists, existing_file = check_if_already_crawled(profile_url, output_dir)
        if already_exists:
            print(f"\n⚠ Profile already exists: {existing_file}")
            print(f"  Skipping save to avoid duplication")
            return existing_file
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    name = profile_data.get('name', 'unknown')
    if not name or name == 'N/A' or len(name.strip()) == 0:
        name = 'unknown'
    
    name_slug = name.replace(' ', '_').replace('/', '_').replace('\\', '_').lower()
    name_slug = ''.join(c for c in name_slug if c.isalnum() or c in ('_', '-'))
    
    url_hash = get_profile_hash(profile_url) if profile_url else 'nohash'
    filename = f"{name_slug}_{timestamp}_{url_hash}.json"
    filepath = os.path.join(output_dir, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(profile_data, indent=2, ensure_ascii=False, fp=f)
    
    print(f"\n✓ Profile data saved to: {filepath}")
    return filepath


# ============================================================================
# MAIN CONSUMER CODE
# ============================================================================

# Configuration
SCORING_QUEUE = os.getenv('SCORING_QUEUE', 'scoring_queue')
DEFAULT_REQUIREMENTS_ID = os.getenv('DEFAULT_REQUIREMENTS_ID', 'desk_collection')

# Statistics
stats = {
    'processing': 0,
    'completed': 0,
    'failed': 0,
    'skipped': 0,
    'sent_to_scoring': 0,
    'saved_to_supabase': 0,
    'supabase_failed': 0,
    'lock': threading.Lock()
}


def print_stats():
    """Print current statistics"""
    print("\n" + "="*60)
    print("STATISTICS")
    print("="*60)
    print(f"Processing: {stats['processing']}")
    print(f"Completed: {stats['completed']}")
    print(f"Failed: {stats['failed']}")
    print(f"Skipped: {stats['skipped']}")
    print(f"Sent to Scoring: {stats['sent_to_scoring']}")
    print(f"Saved to Supabase: {stats['saved_to_supabase']}")
    print(f"Supabase Failed: {stats['supabase_failed']}")
    if stats['completed'] + stats['failed'] > 0:
        success_rate = stats['completed'] / (stats['completed'] + stats['failed']) * 100
        print(f"Success Rate: {success_rate:.1f}%")
    print("="*60)


def send_to_scoring_queue(profile_data, requirements_id, mq_config):
    """Send profile data to scoring queue"""
    try:
        # Connect to RabbitMQ
        mq = RabbitMQManager()
        mq.host = mq_config['host']
        mq.port = mq_config['port']
        mq.username = mq_config['username']
        mq.password = mq_config['password']
        mq.queue_name = SCORING_QUEUE
        
        if not mq.connect():
            print(f"  ✗ Failed to connect to scoring queue")
            return False
        
        # Prepare message
        message = {
            'profile_data': profile_data,
            'requirements_id': requirements_id,
            'profile_url': profile_data.get('profile_url', '')
        }
        
        # Publish to scoring queue
        mq.channel.queue_declare(queue=SCORING_QUEUE, durable=True)
        mq.channel.basic_publish(
            exchange='',
            routing_key=SCORING_QUEUE,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Make message persistent
            )
        )
        
        mq.close()
        print(f"  📤 Sent to scoring queue: {SCORING_QUEUE}")
        return True
    
    except Exception as e:
        print(f"  ✗ Failed to send to scoring queue: {e}")
        return False


def load_crawled_urls():
    """Load all URLs that have been crawled from output folder"""
    crawled_urls = set()
    output_dir = 'data/output'
    
    if not os.path.exists(output_dir):
        return crawled_urls
    
    output_files = glob.glob(f'{output_dir}/*.json')
    
    for output_file in output_files:
        try:
            with open(output_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                url = data.get('profile_url', '')
                if url:
                    crawled_urls.add(url)
        except Exception as e:
            # Skip files that can't be read
            continue
    
    return crawled_urls


def load_urls_from_profile_folder(crawled_urls=None):
    """Load all URLs from profile/*.json files, skip already crawled ones"""
    if crawled_urls is None:
        crawled_urls = set()
    
    urls = []
    skipped = 0
    
    # Get all JSON files in profile folder
    json_files = glob.glob('profile/*.json')
    
    if not json_files:
        print("⚠ No JSON files found in profile/ folder")
        return urls, skipped
    
    print(f"→ Found {len(json_files)} JSON file(s) in profile/")
    
    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
                # Handle both array and single object
                if isinstance(data, list):
                    profiles = data
                else:
                    profiles = [data]
                
                for profile in profiles:
                    url = profile.get('profile_url', '')
                    
                    if not url:
                        continue
                    
                    # Skip URLs with "sales" in them
                    if '/sales/' in url.lower():
                        skipped += 1
                        print(f"  ⊘ Skipped (sales URL): {profile.get('name', 'Unknown')}")
                        continue
                    
                    # Skip if already crawled
                    if url in crawled_urls:
                        skipped += 1
                        print(f"  ⊘ Skipped (already crawled): {profile.get('name', 'Unknown')}")
                        continue
                    
                    urls.append(url)
                    print(f"  ✓ Added: {profile.get('name', 'Unknown')}")
        
        except Exception as e:
            print(f"  ✗ Error reading {json_file}: {e}")
            continue
    
    return urls, skipped


def worker_thread(worker_id, mq_config, requirements_id):
    """Worker thread that continuously processes messages"""
    print(f"[Worker {worker_id}] Started")
    
    # Each worker has its own RabbitMQ connection
    mq = RabbitMQManager()
    mq.host = mq_config['host']
    mq.port = mq_config['port']
    mq.username = mq_config['username']
    mq.password = mq_config['password']
    mq.queue_name = mq_config['queue_name']
    
    if not mq.connect():
        print(f"[Worker {worker_id}] Failed to connect to RabbitMQ")
        return
    
    # Initialize Supabase
    try:
        supabase = SupabaseManager()
        print(f"[Worker {worker_id}] ✓ Connected to Supabase")
    except Exception as e:
        print(f"[Worker {worker_id}] ⚠ Supabase connection failed: {e}")
        print(f"[Worker {worker_id}]   Continuing without Supabase (data won't be saved to DB)")
        supabase = None
    
    # Set QoS - only process 1 message at a time
    mq.channel.basic_qos(prefetch_count=1)
    
    def callback(ch, method, properties, body):
        """Process each message"""
        crawler = None
        
        try:
            # Parse message
            message = json.loads(body)
            url = message.get('url')
            
            if not url:
                print(f"[Worker {worker_id}] ✗ Invalid message")
                ack_message(ch, method.delivery_tag)
                return
            
            print(f"\n[Worker {worker_id}] 📥 Processing: {url}")
            
            with stats['lock']:
                stats['processing'] += 1
            
            # Create crawler and process
            crawler = LinkedInCrawler()
            
            try:
                # Login (will use cookies if available)
                crawler.login()
                
                # Scrape profile
                profile_data = crawler.get_profile(url)
                
                # Save to file
                save_profile_data(profile_data)
                
                # Save to Supabase
                if supabase:
                    print(f"[Worker {worker_id}] 💾 Saving to Supabase...")
                    if supabase.save_lead(
                        profile_url=url,
                        name=profile_data.get('name', 'Unknown'),
                        profile_data=profile_data,
                        connection_status='scraped'
                    ):
                        with stats['lock']:
                            stats['saved_to_supabase'] += 1
                        print(f"[Worker {worker_id}] ✓ Saved to Supabase")
                    else:
                        with stats['lock']:
                            stats['supabase_failed'] += 1
                        print(f"[Worker {worker_id}] ⚠ Failed to save to Supabase")
                
                # Send to scoring queue
                print(f"[Worker {worker_id}] 📤 Sending to scoring...")
                if send_to_scoring_queue(profile_data, requirements_id, mq_config):
                    with stats['lock']:
                        stats['sent_to_scoring'] += 1
                
                with stats['lock']:
                    stats['completed'] += 1
                
                print(f"[Worker {worker_id}] ✓ Completed: {profile_data.get('name', 'Unknown')}")
                
                # Print stats after completion
                print_stats()
                
                # Acknowledge message
                ack_message(ch, method.delivery_tag)
                
            except Exception as e:
                with stats['lock']:
                    stats['failed'] += 1
                
                print(f"[Worker {worker_id}] ✗ Error: {e}")
                
                # Print stats after failure
                print_stats()
                
                # Don't requeue to avoid infinite loop
                nack_message(ch, method.delivery_tag, requeue=False)
            
            finally:
                # Close browser
                if crawler:
                    crawler.close()
                
                with stats['lock']:
                    stats['processing'] -= 1
        
        except Exception as e:
            print(f"[Worker {worker_id}] ✗ Fatal error: {e}")
            nack_message(ch, method.delivery_tag, requeue=False)
    
    try:
        # Start consuming
        mq.channel.basic_consume(
            queue=mq.queue_name,
            on_message_callback=callback,
            auto_ack=False
        )
        
        print(f"[Worker {worker_id}] Waiting for messages...")
        mq.channel.start_consuming()
    
    except Exception as e:
        print(f"[Worker {worker_id}] Error: {e}")
    
    finally:
        mq.close()
        print(f"[Worker {worker_id}] Stopped")


def main():
    print("="*60)
    print("LINKEDIN SCRAPER + SCORING INTEGRATION")
    print("="*60)
    
    # Get requirements ID - list from scoring/requirements folder
    print(f"\nAvailable requirements:")
    requirements_dir = '../scoring/requirements'
    if os.path.exists(requirements_dir):
        req_files = [f.replace('.json', '') for f in os.listdir(requirements_dir) if f.endswith('.json')]
        for req in sorted(req_files):
            print(f"  - {req}")
    else:
        print("  - desk_collection (default)")
        print("  - backend_dev_senior")
        print("  - frontend_dev")
        print("  - fullstack_dev")
        print("  - data_scientist")
        print("  - devops_engineer")
    
    # Check if running in non-interactive mode (background)
    import sys
    if not sys.stdin.isatty():
        # Running in background, use default
        requirements_id = DEFAULT_REQUIREMENTS_ID
        print(f"\n→ Running in background mode, using default: {requirements_id}")
    else:
        # Interactive mode, ask user
        requirements_id = input(f"\nRequirements ID (default: {DEFAULT_REQUIREMENTS_ID}): ").strip()
        if not requirements_id:
            requirements_id = DEFAULT_REQUIREMENTS_ID
    
    print(f"→ Using requirements: {requirements_id}")
    
    # Default 3 workers
    num_workers = 3
    print(f"→ Using {num_workers} workers (default)")
    
    # Load already crawled URLs
    print("\n→ Loading already crawled URLs from data/output/...")
    crawled_urls = load_crawled_urls()
    print(f"  ✓ Found {len(crawled_urls)} already crawled profiles")
    
    # Load URLs from profile folder
    print("\n→ Loading URLs from profile/*.json files...")
    urls, skipped_count = load_urls_from_profile_folder(crawled_urls)
    
    if not urls:
        print("\n✗ No valid URLs found!")
        print("  Make sure you have JSON files in profile/ folder")
        print("  URLs with '/sales/' are automatically skipped")
        print("  Already crawled URLs are also skipped")
        return
    
    print(f"\n→ Summary:")
    print(f"  - Valid URLs: {len(urls)}")
    print(f"  - Skipped: {skipped_count}")
    print(f"  - Requirements: {requirements_id}")
    
    stats['skipped'] = skipped_count
    
    # Connect to RabbitMQ
    print("\n→ Connecting to RabbitMQ...")
    mq = RabbitMQManager()
    if not mq.connect():
        print("✗ Failed to connect to RabbitMQ. Is it running?")
        print("\nTo start RabbitMQ:")
        print("  docker-compose up -d")
        return
    
    # Publish URLs to queue
    print(f"\n→ Publishing {len(urls)} URLs to crawl queue...")
    success_count = mq.publish_urls(urls)
    
    if success_count == 0:
        print("✗ Failed to publish URLs")
        mq.close()
        return
    
    # Show queue status
    queue_size = mq.get_queue_size()
    print(f"\n→ Queue status:")
    print(f"  - Crawl queue: {queue_size} messages")
    print(f"  - Scoring queue: {SCORING_QUEUE}")
    
    # Save config for workers
    mq_config = {
        'host': mq.host,
        'port': mq.port,
        'username': mq.username,
        'password': mq.password,
        'queue_name': mq.queue_name
    }
    
    mq.close()
    
    print(f"\n→ Starting {num_workers} crawler workers...")
    print("  Workers will:")
    print("  1. Scrape LinkedIn profiles")
    print("  2. Save to data/output/")
    print("  3. Send to scoring queue")
    print("\n  Press Ctrl+C to stop")
    print(f"  Management UI: http://localhost:15672 (guest/guest)")
    
    # Start worker threads
    threads = []
    for i in range(num_workers):
        t = threading.Thread(
            target=worker_thread, 
            args=(i+1, mq_config, requirements_id), 
            daemon=True
        )
        t.start()
        threads.append(t)
        time.sleep(0.5)
    
    print(f"\n✓ All {num_workers} workers are running!")
    print("\n💡 TIP: Start scoring consumer in another terminal:")
    print("  cd ../scoring")
    print("  source venv/bin/activate")
    print("  python scoring_consumer.py")
    
    try:
        # Keep main thread alive
        while True:
            time.sleep(1)
    
    except KeyboardInterrupt:
        print("\n\n⚠ Interrupted by user. Stopping all workers...")
        print("  (Workers will finish current tasks)")
    
    finally:
        # Wait a bit for workers to finish current tasks
        time.sleep(3)
        
        # Final stats
        print("\n" + "="*60)
        print("FINAL RESULTS")
        print("="*60)
        print(f"Total URLs: {len(urls)}")
        print(f"✓ Completed: {stats['completed']}")
        print(f"✗ Failed: {stats['failed']}")
        print(f"⊘ Skipped (sales): {stats['skipped']}")
        print(f"📤 Sent to Scoring: {stats['sent_to_scoring']}")
        print(f"💾 Saved to Supabase: {stats['saved_to_supabase']}")
        print(f"⚠ Supabase Failed: {stats['supabase_failed']}")
        if stats['completed'] + stats['failed'] > 0:
            success_rate = stats['completed'] / (stats['completed'] + stats['failed']) * 100
            print(f"📊 Success Rate: {success_rate:.1f}%")
        print("="*60)
        print(f"\nCrawler output: data/output/")
        print(f"Scoring output: ../scoring/data/scores/")
        print(f"Supabase: leads_list table")


if __name__ == "__main__":
    main()
