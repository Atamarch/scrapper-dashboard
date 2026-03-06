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

# Configuration
SCORING_QUEUE = os.getenv('SCORING_QUEUE', 'scoring_queue')
REQUIREMENTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'scoring', 'requirements')
DB_CHECK_INTERVAL = int(os.getenv('DB_CHECK_INTERVAL', '60'))  # 1 minute default


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

# Statistics
stats = {
    'processing': 0,
    'completed': 0,
    'failed': 0,
    'skipped': 0,
    'sent_to_scoring': 0,
    'saved_to_supabase': 0,
    'supabase_failed': 0,
    'requeued_from_db': 0,
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
    print(f"Re-queued from DB: {stats['requeued_from_db']}")
    if stats['completed'] + stats['failed'] > 0:
        success_rate = stats['completed'] / (stats['completed'] + stats['failed']) * 100
        print(f"Success Rate: {success_rate:.1f}%")
    print("="*60)


# ============================================================================
# TEMPLATE-BASED QUEUE MANAGEMENT FUNCTIONS
# ============================================================================

def check_template_has_requirements(template_id):
    """Check if template has requirements file"""
    if not template_id:
        return False
    
    # Method 1: Check if requirements file exists by template_id
    requirements_file = os.path.join(REQUIREMENTS_DIR, f"{template_id}.json")
    if os.path.exists(requirements_file):
        return True
    
    # Method 2: Check common template names
    common_templates = ['desk_collection', 'backend_dev_senior', 'frontend_dev', 'fullstack_dev', 'data_scientist', 'devops_engineer']
    for template_name in common_templates:
        requirements_file = os.path.join(REQUIREMENTS_DIR, f"{template_name}.json")
        if os.path.exists(requirements_file):
            return True
    
    # Method 3: Try to get template name from database (with error handling)
    try:
        supabase = SupabaseManager()
        template = supabase.get_template_by_id(template_id)
        if template and template.get('name'):
            template_name = template['name'].lower().replace(' ', '_')
            requirements_file = os.path.join(REQUIREMENTS_DIR, f"{template_name}.json")
            return os.path.exists(requirements_file)
    except Exception as e:
        print(f"⚠ Warning: Could not check template in database: {e}")
        # Continue with file-based check only
    
    return False


def select_template_interactive():
    """Interactive template selection for crawler"""
    try:
        supabase = SupabaseManager()
        templates = supabase.get_all_templates()
        
        if not templates:
            print("❌ No templates found in database")
            return None
        
        print("\n" + "="*60)
        print("📋 TEMPLATE SELECTION")
        print("="*60)
        print("Available templates:")
        
        for i, template in enumerate(templates, 1):
            print(f"  {i}. {template['name']} (ID: {template['id']})")
        
        print(f"  0. Exit")
        print("="*60)
        
        while True:
            try:
                choice = input("\nSelect template number: ").strip()
                
                if choice == '0':
                    print("Exiting...")
                    return None
                
                choice_num = int(choice)
                if 1 <= choice_num <= len(templates):
                    selected_template = templates[choice_num - 1]
                    print(f"\n✓ Selected: {selected_template['name']}")
                    return selected_template['id']
                else:
                    print(f"❌ Invalid choice. Please select 1-{len(templates)} or 0 to exit")
            
            except ValueError:
                print("❌ Please enter a valid number")
            except KeyboardInterrupt:
                print("\n\nExiting...")
                return None
    
    except Exception as e:
        print(f"❌ Error selecting template: {e}")
        return None


def queue_leads_by_template(template_id, mq_config):
    """Queue leads that need processing for specific template_id"""
    try:
        print(f"\n🔍 Analyzing leads for template: {template_id}")
        
        supabase = SupabaseManager()
        leads = supabase.get_leads_by_template_id(template_id)
        
        if not leads:
            print(f"❌ No leads found for template: {template_id}")
            return 0
        
        # Filter leads that need processing
        needs_processing = [lead for lead in leads if lead['needs_processing']]
        already_complete = [lead for lead in leads if not lead['needs_processing']]
        
        print(f"\n📊 Lead Analysis Results:")
        print(f"   Total leads: {len(leads)}")
        print(f"   Need processing: {len(needs_processing)}")
        print(f"   Already complete: {len(already_complete)}")
        
        if already_complete:
            print(f"\n✅ Complete leads (will be skipped):")
            for lead in already_complete[:5]:  # Show first 5
                print(f"   - {lead['name']} (Score: {lead['score_percentage']}%)")
            if len(already_complete) > 5:
                print(f"   ... and {len(already_complete) - 5} more")
        
        if not needs_processing:
            print(f"\n🎉 All leads for this template are already complete!")
            return 0
        
        print(f"\n📤 Queueing {len(needs_processing)} leads that need processing:")
        
        # Connect to RabbitMQ
        mq = RabbitMQManager()
        mq.host = mq_config['host']
        mq.port = mq_config['port']
        mq.username = mq_config['username']
        mq.password = mq_config['password']
        mq.queue_name = mq_config['queue_name']
        
        if not mq.connect():
            print("❌ Failed to connect to RabbitMQ for queueing")
            return 0
        
        queued_count = 0
        
        try:
            for lead in needs_processing:
                message = {
                    'url': lead['profile_url'],
                    'template_id': template_id,
                    'timestamp': datetime.now().isoformat(),
                    'trigger': 'template_selection',
                    'lead_id': lead['id'],
                    'reason': ', '.join(lead['status_reason'])
                }
                
                try:
                    mq.channel.basic_publish(
                        exchange='',
                        routing_key=mq.queue_name,
                        body=json.dumps(message),
                        properties=pika.BasicProperties(
                            delivery_mode=2,  # Persistent
                            content_type='application/json'
                        )
                    )
                    queued_count += 1
                    print(f"   ✓ Queued: {lead['name']} ({', '.join(lead['status_reason'])})")
                    
                except Exception as e:
                    print(f"   ❌ Failed to queue {lead['name']}: {e}")
            
            print(f"\n✅ Successfully queued {queued_count}/{len(needs_processing)} leads")
            
            with stats['lock']:
                stats['requeued_from_db'] += queued_count
            
        finally:
            mq.close()
        
        return queued_count
    
    except Exception as e:
        print(f"❌ Error queueing leads by template: {e}")
        return 0


def send_to_scoring_queue(profile_data, template_id, mq_config):
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
            'template_id': template_id,  # Use template_id instead of requirements_id
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





def worker_thread(worker_id, mq_config):
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
            template_id = message.get('template_id')
            
            if not url:
                print(f"[Worker {worker_id}] ✗ Invalid message: no URL")
                ack_message(ch, method.delivery_tag)
                return
            
            if not template_id:
                print(f"[Worker {worker_id}] ✗ Invalid message: no template_id")
                ack_message(ch, method.delivery_tag)
                return
            
            print(f"\n[Worker {worker_id}] 📥 Processing: {url}")
            print(f"[Worker {worker_id}] 📁 Template ID: {template_id}")
            
            with stats['lock']:
                stats['processing'] += 1
            
            # Check if already scraped in Supabase - IMPROVED VALIDATION
            if supabase:
                existing_lead = supabase.get_lead_by_url(url)
                if existing_lead:
                    profile_data = existing_lead.get('profile_data')
                    scoring_data = existing_lead.get('scoring_data')
                    
                    # Check if profile data is complete (has required fields)
                    has_complete_profile = False
                    if profile_data and profile_data not in [None, '', '{}', {}]:
                        if isinstance(profile_data, dict):
                            required_fields = ['name', 'headline', 'location']
                            has_complete_profile = all(profile_data.get(field) for field in required_fields)
                        elif isinstance(profile_data, str):
                            try:
                                parsed_data = json.loads(profile_data)
                                required_fields = ['name', 'headline', 'location']
                                has_complete_profile = all(parsed_data.get(field) for field in required_fields)
                            except:
                                has_complete_profile = False
                    
                    # Check if scoring data is complete (has results array)
                    has_complete_scoring = False
                    score_percentage = 0
                    if scoring_data and scoring_data not in [None, '', '{}', {}]:
                        try:
                            if isinstance(scoring_data, dict):
                                score_percentage = scoring_data.get('percentage', 0)
                                has_complete_scoring = 'results' in scoring_data and len(scoring_data.get('results', [])) > 0
                            elif isinstance(scoring_data, str):
                                parsed_data = json.loads(scoring_data)
                                score_percentage = parsed_data.get('percentage', 0)
                                has_complete_scoring = 'results' in parsed_data and len(parsed_data.get('results', [])) > 0
                        except:
                            has_complete_scoring = False
                            score_percentage = 0
                    
                    # Skip only if BOTH profile and scoring are complete
                    if has_complete_profile and has_complete_scoring:
                        print(f"[Worker {worker_id}] ⊘ Already complete (Profile: ✓, Scoring: ✓, Score: {score_percentage}%)")
                        with stats['lock']:
                            stats['skipped'] += 1
                            stats['processing'] -= 1
                        ack_message(ch, method.delivery_tag)
                        return
                    else:
                        # Log what's missing
                        missing = []
                        if not has_complete_profile:
                            missing.append("incomplete profile")
                        if not has_complete_scoring:
                            missing.append("missing/incomplete scoring")
                        print(f"[Worker {worker_id}] 🔄 Re-processing ({', '.join(missing)})")
            
            # Create crawler and process
            crawler = LinkedInCrawler()
            
            try:
                # Login (will use cookies if available)
                crawler.login()
                
                # Scrape profile
                profile_data = crawler.get_profile(url)
                
                # Add template_id to profile data
                profile_data['template_id'] = template_id
                
                # Save to file (DISABLED - data saved to Supabase instead)
                # save_profile_data(profile_data)
                
                # Update Supabase with scraped data
                if supabase:
                    print(f"[Worker {worker_id}] 💾 Updating Supabase...")
                    if supabase.update_lead_after_scrape(
                        profile_url=url,
                        profile_data=profile_data
                    ):
                        with stats['lock']:
                            stats['saved_to_supabase'] += 1
                        print(f"[Worker {worker_id}] ✓ Updated Supabase")
                    else:
                        with stats['lock']:
                            stats['supabase_failed'] += 1
                        print(f"[Worker {worker_id}] ⚠ Failed to update Supabase")
                
                # Send to scoring queue
                print(f"[Worker {worker_id}] 📤 Sending to scoring...")
                if send_to_scoring_queue(profile_data, template_id, mq_config):
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
    print("LINKEDIN CRAWLER CONSUMER")
    print("="*60)
    print("Template-based LinkedIn Profile Scraper")
    print("="*60)
    
    # Step 1: Template Selection
    template_id = select_template_interactive()
    if not template_id:
        print("No template selected. Exiting...")
        return
    
    # Number of workers
    num_workers = int(os.getenv('MAX_WORKERS', '3'))
    print(f"\n→ Number of workers: {num_workers}")
    
    # Connect to RabbitMQ
    print("\n→ Connecting to LavinMQ...")
    mq = RabbitMQManager()
    if not mq.connect():
        print("✗ Failed to connect to LavinMQ")
        print("\nCheck your .env file:")
        print("  RABBITMQ_HOST=leopard.lmq.cloudamqp.com")
        print("  RABBITMQ_PORT=5672")
        print("  RABBITMQ_USER=fexihtwb")
        print("  RABBITMQ_PASS=...")
        print("  RABBITMQ_VHOST=fexihtwb")
        return
    
    print(f"✓ Connected to LavinMQ: {mq.host}")
    
    # Save config for workers
    mq_config = {
        'host': mq.host,
        'port': mq.port,
        'username': mq.username,
        'password': mq.password,
        'queue_name': mq.queue_name
    }
    
    # Check current queue size
    queue_size = mq.get_queue_size()
    print(f"\n→ Current queue status:")
    print(f"  - Queue: {mq.queue_name}")
    print(f"  - Messages waiting: {queue_size}")
    print(f"  - Scoring queue: {SCORING_QUEUE}")
    
    mq.close()
    
    # Step 2: Queue leads for selected template
    queued_count = queue_leads_by_template(template_id, mq_config)
    
    if queued_count == 0:
        print("\n🎉 No leads need processing for this template!")
        print("All leads are already complete (have profile data and scoring > 0%)")
        return
    
    print(f"\n→ Starting {num_workers} crawler workers...")
    print("  Workers will:")
    print("  1. Listen to LavinMQ queue")
    print("  2. Scrape LinkedIn profiles")
    print("  3. Update Supabase")
    print("  4. Send to scoring queue")
    print(f"\n  Template: {template_id}")
    print(f"  Queued leads: {queued_count}")
    print("\n  Press Ctrl+C to stop")
    print(f"  LavinMQ Dashboard: https://leopard.lmq.cloudamqp.com")
    
    # Start worker threads
    threads = []
    for i in range(num_workers):
        t = threading.Thread(
            target=worker_thread, 
            args=(i+1, mq_config), 
            daemon=True
        )
        t.start()
        threads.append(t)
        time.sleep(0.5)
    
    print(f"\n✓ All {num_workers} workers are running!")
    print("\n💡 How it works:")
    print("  1. Selected template leads → Queued for processing")
    print("  2. Crawler workers → Scrape profiles")
    print("  3. Supabase → Updated with profile data")
    print("  4. Scoring service → Calculates scores")
    print("  5. Complete → Profile data + scoring data")
    
    try:
        # Keep main thread alive and monitor progress
        last_stats_time = time.time()
        
        while True:
            time.sleep(10)  # Check every 10 seconds
            
            # Print stats periodically
            current_time = time.time()
            if current_time - last_stats_time >= 30:  # Every 30 seconds
                print_stats()
                last_stats_time = current_time
                
                # Check if all work is done
                if stats['processing'] == 0:
                    # Check queue size
                    mq_temp = RabbitMQManager()
                    mq_temp.host = mq_config['host']
                    mq_temp.port = mq_config['port']
                    mq_temp.username = mq_config['username']
                    mq_temp.password = mq_config['password']
                    mq_temp.queue_name = mq_config['queue_name']
                    
                    if mq_temp.connect():
                        remaining_queue = mq_temp.get_queue_size()
                        mq_temp.close()
                        
                        if remaining_queue == 0:
                            print(f"\n🎉 All work completed!")
                            print(f"   Queue is empty and no workers are processing")
                            break
    
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
        print(f"✓ Completed: {stats['completed']}")
        print(f"✗ Failed: {stats['failed']}")
        print(f"⊘ Skipped: {stats['skipped']}")
        print(f"📤 Sent to Scoring: {stats['sent_to_scoring']}")
        print(f"💾 Updated Supabase: {stats['saved_to_supabase']}")
        print(f"⚠ Supabase Failed: {stats['supabase_failed']}")
        print(f"🔄 Re-queued from DB: {stats['requeued_from_db']}")
        if stats['completed'] + stats['failed'] > 0:
            success_rate = stats['completed'] / (stats['completed'] + stats['failed']) * 100
            print(f"📊 Success Rate: {success_rate:.1f}%")
        print("="*60)
        print(f"\nCrawler output: data/output/")
        print(f"Supabase: leads_list table")


if __name__ == "__main__":
    main()
