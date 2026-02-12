"""
Scoring Consumer - Process profiles from RabbitMQ and calculate scores
OPTIMIZED VERSION
"""
import json
import os
import threading
import time
import re
import hashlib
import glob
from datetime import datetime
import pika
from dotenv import load_dotenv
from rapidfuzz import fuzz
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Configuration
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'localhost')
RABBITMQ_PORT = int(os.getenv('RABBITMQ_PORT', 5672))
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'guest')
RABBITMQ_PASSWORD = os.getenv('RABBITMQ_PASSWORD', 'guest')
SCORING_QUEUE = os.getenv('SCORING_QUEUE', 'scoring_queue')

# Supabase Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

OUTPUT_DIR = 'data/scores'
REQUIREMENTS_DIR = 'requirements'

# Initialize Supabase client (only if credentials provided)
supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✓ Supabase connected")
    except Exception as e:
        print(f"⚠ Supabase connection failed: {e}")
else:
    print("⚠ Supabase credentials not found in .env")

# Statistics
stats = {
    'processing': 0,
    'completed': 0,
    'failed': 0,
    'skipped': 0,
    'supabase_updated': 0,
    'supabase_failed': 0,
    'lock': threading.Lock()
}


class OptimizedScorer:
    """Optimized Scorer - Focus on skills"""
    def __init__(self, requirements):
        self.requirements = requirements
        self.breakdown = {}
    
    def score(self, profile):
        """Calculate total score - OPTIMIZED"""
        total = 0
        
        # 1. Skills (70 points) - PRIORITAS UTAMA
        skills_score = self._score_skills(profile.get('skills', []))
        total += skills_score
        
        # 2. Experience (20 points)
        exp_score = self._score_experience(profile.get('experiences', []))
        total += exp_score
        
        # 3. Education (10 points)
        edu_score = self._score_education(profile.get('education', []))
        total += edu_score
        
        percentage = (total / 100) * 100
        
        return {
            'total_score': round(total, 2),
            'percentage': round(percentage, 2),
            'breakdown': self.breakdown
        }
    
    def _score_skills(self, profile_skills):
        """Score skills (70 points) - OPTIMIZED"""
        required = self.requirements.get('required_skills', {})
        preferred = self.requirements.get('preferred_skills', {})
        
        # Normalize skills
        skills_list = []
        if isinstance(profile_skills, list):
            for s in profile_skills:
                if isinstance(s, dict):
                    name = s.get('name', '')
                    if name and name != 'N/A':
                        skills_list.append(name.lower().strip())
                elif isinstance(s, str) and s and s != 'N/A':
                    skills_list.append(s.lower().strip())
        
        # Score required (50 points)
        req_score = 0
        req_matches = []
        req_missing = []
        
        if required:
            total_weight = sum(required.values())
            
            for skill, weight in required.items():
                skill_lower = skill.lower()
                best_ratio = 0
                matched = False
                
                for profile_skill in skills_list:
                    ratio = fuzz.ratio(skill_lower, profile_skill)
                    partial_ratio = fuzz.partial_ratio(skill_lower, profile_skill)
                    final_ratio = max(ratio, partial_ratio)
                    
                    if final_ratio >= 70:  # LOWERED threshold
                        if final_ratio > best_ratio:
                            best_ratio = final_ratio
                            matched = True
                
                if matched:
                    points = (weight / total_weight) * 50 * (best_ratio / 100)
                    req_score += points
                    req_matches.append(skill)
                else:
                    req_missing.append(skill)
        
        # Score preferred (20 points)
        pref_score = 0
        pref_matches = []
        
        if preferred:
            total_weight = sum(preferred.values())
            
            for skill, weight in preferred.items():
                skill_lower = skill.lower()
                best_ratio = 0
                matched = False
                
                for profile_skill in skills_list:
                    ratio = fuzz.ratio(skill_lower, profile_skill)
                    partial_ratio = fuzz.partial_ratio(skill_lower, profile_skill)
                    final_ratio = max(ratio, partial_ratio)
                    
                    if final_ratio >= 70:
                        if final_ratio > best_ratio:
                            best_ratio = final_ratio
                            matched = True
                
                if matched:
                    points = (weight / total_weight) * 20 * (best_ratio / 100)
                    pref_score += points
                    pref_matches.append(skill)
        
        total = req_score + pref_score
        
        self.breakdown['skills'] = {
            'score': round(total, 2),
            'required_matched': len(req_matches),
            'required_total': len(required),
            'required_missing': req_missing,
            'preferred_matched': len(pref_matches)
        }
        
        return total
    
    def _score_experience(self, experiences):
        """Score experience (20 points)"""
        min_years = self.requirements.get('min_experience_years', 0)
        
        total_months = 0
        for exp in experiences:
            if not isinstance(exp, dict):
                continue
            duration = exp.get('duration', '')
            if not duration:
                continue
            
            years = 0
            months = 0
            year_match = re.search(r'(\d+)\s*yr', duration)
            if year_match:
                years = int(year_match.group(1))
            month_match = re.search(r'(\d+)\s*mo', duration)
            if month_match:
                months = int(month_match.group(1))
            
            total_months += (years * 12) + months
        
        total_years = total_months / 12
        
        if total_years >= min_years:
            score = 20
        else:
            score = (total_years / min_years) * 20 if min_years > 0 else 0
        
        self.breakdown['experience'] = {
            'score': round(score, 2),
            'years': round(total_years, 1)
        }
        
        return score
    
    def _score_education(self, education):
        """Score education (10 points)"""
        required = self.requirements.get('education_level', [])
        if not required:
            self.breakdown['education'] = {'score': 10}
            return 10
        
        if not education:
            self.breakdown['education'] = {'score': 0}
            return 0
        
        levels = {
            'high school': 1, 'sma': 1, 'smk': 1,
            'diploma': 2, 'associate': 2, 'd3': 2,
            'bachelor': 3, 's1': 3, 'sarjana': 3,
            'master': 4, 's2': 4, 'mba': 4,
            'doctoral': 5, 'phd': 5, 's3': 5
        }
        
        highest = 0
        for edu in education:
            if not isinstance(edu, dict):
                continue
            degree = edu.get('degree', '').lower()
            if not degree:
                continue
            for level_name, level_val in levels.items():
                if level_name in degree and level_val > highest:
                    highest = level_val
        
        required_level = 0
        for req in required:
            for level_name, level_val in levels.items():
                if level_name in req.lower() and level_val > required_level:
                    required_level = level_val
        
        if highest >= required_level:
            score = 10
        elif highest > 0:
            score = (highest / required_level) * 10 if required_level > 0 else 0
        else:
            score = 0
        
        self.breakdown['education'] = {'score': round(score, 2)}
        return score


def load_requirements(requirements_id):
    """Load requirements JSON file"""
    filepath = os.path.join(REQUIREMENTS_DIR, f"{requirements_id}.json")
    
    if not os.path.exists(filepath):
        print(f"⚠ Requirements file not found: {filepath}")
        return None
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"✗ Error loading requirements: {e}")
        return None


def get_profile_hash(profile_url):
    """Generate unique hash from profile URL"""
    return hashlib.md5(profile_url.encode()).hexdigest()[:8]


def check_if_already_scored(profile_url, requirements_id, output_dir=OUTPUT_DIR):
    """Check if profile has already been scored for this requirement"""
    if not os.path.exists(output_dir):
        return False, None
    
    url_hash = get_profile_hash(profile_url)
    
    # Search for existing files with this URL hash and requirements_id
    pattern = os.path.join(output_dir, f"*_{requirements_id}_*_{url_hash}_score.json")
    existing_files = glob.glob(pattern)
    
    if existing_files:
        return True, existing_files[0]
    
    # Fallback: check by reading all score JSON files
    all_files = glob.glob(os.path.join(output_dir, "*_score.json"))
    for filepath in all_files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                profile = data.get('profile', {})
                req_id = data.get('requirements_id', '')
                if profile.get('profile_url') == profile_url and req_id == requirements_id:
                    return True, filepath
        except:
            continue
    
    return False, None


def save_score_result(profile_data, score_result, requirements_id):
    """Save scoring result to JSON file (with duplicate prevention)"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    profile_url = profile_data.get('profile_url', '')
    
    # Check if already scored
    if profile_url:
        already_exists, existing_file = check_if_already_scored(profile_url, requirements_id)
        if already_exists:
            print(f"⚠ Score already exists: {existing_file}")
            print(f"  Skipping save to avoid duplication")
            return existing_file
    
    # Create filename with hash
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    name = profile_data.get('name', 'unknown')
    
    if not name or name == 'N/A' or len(name.strip()) == 0:
        name = 'unknown'
    
    # Clean name for filename
    name_slug = name.replace(' ', '_').replace('/', '_').replace('\\', '_').lower()
    name_slug = ''.join(c for c in name_slug if c.isalnum() or c in ('_', '-'))
    
    # Add URL hash to filename for uniqueness
    url_hash = get_profile_hash(profile_url) if profile_url else 'nohash'
    filename = f"{name_slug}_{requirements_id}_{timestamp}_{url_hash}_score.json"
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    # Prepare output
    output = {
        'profile': profile_data,
        'requirements_id': requirements_id,
        'score': score_result,
        'scored_at': datetime.now().isoformat()
    }
    
    # Save to file
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"💾 Score saved to: {filepath}")
    return filepath


def update_supabase_score(profile_url, total_score):
    """Update score in Supabase leads_list table"""
    try:
        print(f"📤 Updating Supabase...")
        
        # Update score in leads_list table where profile_url matches
        response = supabase.table('leads_list').update({
            'score': total_score
        }).eq('profile_url', profile_url).execute()
        
        # Check if update was successful
        if response.data:
            print(f"✓ Supabase updated: {profile_url} → score: {total_score}")
            return True
        else:
            print(f"⚠ No matching profile_url found in Supabase: {profile_url}")
            return False
    
    except Exception as e:
        print(f"✗ Failed to update Supabase: {e}")
        return False


def print_stats():
    """Print current statistics"""
    print("\n" + "="*60)
    print("SCORING STATISTICS")
    print("="*60)
    print(f"Processing: {stats['processing']}")
    print(f"Completed: {stats['completed']}")
    print(f"Failed: {stats['failed']}")
    print(f"Skipped (duplicates): {stats['skipped']}")
    print(f"Supabase Updated: {stats['supabase_updated']}")
    print(f"Supabase Failed: {stats['supabase_failed']}")
    if stats['completed'] + stats['failed'] > 0:
        success_rate = stats['completed'] / (stats['completed'] + stats['failed']) * 100
        print(f"Success Rate: {success_rate:.1f}%")
    print("="*60)


def process_message(message_data):
    """Process a single scoring message"""
    try:
        profile_data = message_data.get('profile_data')
        requirements_id = message_data.get('requirements_id', 'default')
        profile_url = profile_data.get('profile_url', '') if profile_data else ''
        
        if not profile_data:
            print("✗ No profile data in message")
            return False
        
        name = profile_data.get('name', 'Unknown')
        print(f"\n📥 Processing: {name}")
        print(f"   Requirements: {requirements_id}")
        
        # Check if already scored
        if profile_url:
            already_exists, existing_file = check_if_already_scored(profile_url, requirements_id)
            if already_exists:
                print(f"⊘ Already scored: {existing_file}")
                with stats['lock']:
                    stats['skipped'] += 1
                return True  # Return True to ack message
        
        # Load requirements
        requirements = load_requirements(requirements_id)
        
        if not requirements:
            print(f"✗ Failed to load requirements: {requirements_id}")
            return False
        
        # Calculate score
        print(f"🔢 Calculating score...")
        scorer = OptimizedScorer(requirements)
        score_result = scorer.score(profile_data)
        
        # Print result
        print(f"\n{'='*60}")
        print(f"SCORE RESULT: {name}")
        print(f"{'='*60}")
        print(f"Total Score: {score_result['total_score']}/100")
        print(f"Percentage: {score_result['percentage']}%")
        
        breakdown = score_result.get('breakdown', {})
        skills_breakdown = breakdown.get('skills', {})
        print(f"\nBreakdown:")
        print(f"  - Skills: {skills_breakdown.get('score', 0)}/70 (Matched: {skills_breakdown.get('required_matched', 0)}/{skills_breakdown.get('required_total', 0)})")
        print(f"  - Experience: {breakdown.get('experience', {}).get('score', 0)}/20")
        print(f"  - Education: {breakdown.get('education', {}).get('score', 0)}/10")
        print(f"{'='*60}")
        
        # Save result
        save_score_result(profile_data, score_result, requirements_id)
        
        # Update Supabase
        profile_url = profile_data.get('profile_url', '')
        total_score = score_result.get('total_score', 0)
        if profile_url:
            if update_supabase_score(profile_url, total_score):
                with stats['lock']:
                    stats['supabase_updated'] += 1
            else:
                with stats['lock']:
                    stats['supabase_failed'] += 1
        
        print(f"✓ Completed: {name} - Score: {score_result['percentage']}%")
        
        return True
    
    except Exception as e:
        print(f"✗ Error processing message: {e}")
        import traceback
        traceback.print_exc()
        return False


def worker_thread(worker_id):
    """Worker thread that continuously processes messages from RabbitMQ"""
    print(f"[Worker {worker_id}] Started")
    
    # Connect to RabbitMQ
    try:
        credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
        parameters = pika.ConnectionParameters(
            host=RABBITMQ_HOST,
            port=RABBITMQ_PORT,
            credentials=credentials,
            heartbeat=600,
            blocked_connection_timeout=300
        )
        
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        
        # Declare queue
        channel.queue_declare(queue=SCORING_QUEUE, durable=True)
        
        # Set QoS - only process 1 message at a time
        channel.basic_qos(prefetch_count=1)
        
        print(f"[Worker {worker_id}] Connected to RabbitMQ")
        print(f"[Worker {worker_id}] Listening to queue: {SCORING_QUEUE}")
        
    except Exception as e:
        print(f"[Worker {worker_id}] Failed to connect to RabbitMQ: {e}")
        return
    
    def callback(ch, method, properties, body):
        """Process each message"""
        try:
            with stats['lock']:
                stats['processing'] += 1
            
            # Parse message
            message_data = json.loads(body)
            
            # Process
            success = process_message(message_data)
            
            if success:
                with stats['lock']:
                    stats['completed'] += 1
                ch.basic_ack(delivery_tag=method.delivery_tag)
            else:
                with stats['lock']:
                    stats['failed'] += 1
                # Don't requeue to avoid infinite loop
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
            
            # Print stats
            print_stats()
        
        except Exception as e:
            print(f"[Worker {worker_id}] Fatal error: {e}")
            with stats['lock']:
                stats['failed'] += 1
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        
        finally:
            with stats['lock']:
                stats['processing'] -= 1
    
    try:
        # Start consuming
        channel.basic_consume(
            queue=SCORING_QUEUE,
            on_message_callback=callback,
            auto_ack=False
        )
        
        print(f"[Worker {worker_id}] Waiting for messages...")
        channel.start_consuming()
    
    except KeyboardInterrupt:
        print(f"\n[Worker {worker_id}] Interrupted")
    except Exception as e:
        print(f"[Worker {worker_id}] Error: {e}")
    finally:
        try:
            connection.close()
        except:
            pass
        print(f"[Worker {worker_id}] Stopped")


def main():
    print("="*60)
    print("PROFILE SCORING CONSUMER")
    print("="*60)
    
    # Check requirements directory
    if not os.path.exists(REQUIREMENTS_DIR):
        print(f"\n⚠ Requirements directory not found: {REQUIREMENTS_DIR}")
        print("Creating directory...")
        os.makedirs(REQUIREMENTS_DIR, exist_ok=True)
        print("✓ Please add requirements JSON files to this directory")
    
    # List available requirements
    req_files = [f for f in os.listdir(REQUIREMENTS_DIR) if f.endswith('.json')]
    if req_files:
        print(f"\n✓ Found {len(req_files)} requirements file(s):")
        for f in req_files:
            print(f"  - {f}")
    else:
        print(f"\n⚠ No requirements files found in {REQUIREMENTS_DIR}/")
        print("  Please add at least one requirements JSON file")
    
    # Get number of workers
    try:
        num_workers = int(input("\nNumber of workers (default 2): ").strip() or "2")
        if num_workers < 1:
            num_workers = 2
    except:
        num_workers = 2
    
    print(f"\n→ Configuration:")
    print(f"  - RabbitMQ: {RABBITMQ_HOST}:{RABBITMQ_PORT}")
    print(f"  - Queue: {SCORING_QUEUE}")
    print(f"  - Workers: {num_workers}")
    print(f"  - Output: {OUTPUT_DIR}/")
    
    # Test RabbitMQ connection
    print(f"\n→ Testing RabbitMQ connection...")
    try:
        credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
        parameters = pika.ConnectionParameters(
            host=RABBITMQ_HOST,
            port=RABBITMQ_PORT,
            credentials=credentials
        )
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        
        # Declare queue
        result = channel.queue_declare(queue=SCORING_QUEUE, durable=True, passive=True)
        queue_size = result.method.message_count
        
        print(f"✓ Connected to RabbitMQ")
        print(f"  - Messages in queue: {queue_size}")
        
        connection.close()
    except Exception as e:
        print(f"✗ Failed to connect to RabbitMQ: {e}")
        print("\nMake sure RabbitMQ is running:")
        print("  docker-compose up -d")
        return
    
    # Start workers
    print(f"\n→ Starting {num_workers} workers...")
    print("  Press Ctrl+C to stop")
    
    threads = []
    for i in range(num_workers):
        t = threading.Thread(target=worker_thread, args=(i+1,), daemon=True)
        t.start()
        threads.append(t)
        time.sleep(0.5)
    
    print(f"\n✓ All {num_workers} workers are running!")
    print("  Waiting for messages from crawler...")
    
    try:
        # Keep main thread alive
        while True:
            time.sleep(1)
    
    except KeyboardInterrupt:
        print("\n\n⚠ Interrupted by user. Stopping all workers...")
        print("  (Workers will finish current tasks)")
    
    finally:
        # Wait for workers to finish
        time.sleep(2)
        
        # Final stats
        print("\n" + "="*60)
        print("FINAL RESULTS")
        print("="*60)
        print(f"✓ Completed: {stats['completed']}")
        print(f"✗ Failed: {stats['failed']}")
        print(f"⊘ Skipped (duplicates): {stats['skipped']}")
        if stats['completed'] + stats['failed'] > 0:
            success_rate = stats['completed'] / (stats['completed'] + stats['failed']) * 100
            print(f"📊 Success Rate: {success_rate:.1f}%")
        print("="*60)


if __name__ == "__main__":
    main()
