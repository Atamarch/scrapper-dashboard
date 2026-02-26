"""
Re-score a profile with updated requirements
Reads profile JSON from file and publishes to LavinMQ scoring queue
"""
import json
import os
import pika
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# LavinMQ Configuration
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'localhost')
RABBITMQ_PORT = int(os.getenv('RABBITMQ_PORT', 5672))
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'guest')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'guest')
RABBITMQ_VHOST = os.getenv('RABBITMQ_VHOST', '/')
SCORING_QUEUE = os.getenv('SCORING_QUEUE', 'scoring_queue')


def publish_to_scoring_queue(profile_data, template_id):
    """Publish profile to LavinMQ scoring queue"""
    try:
        print(f"📤 Connecting to LavinMQ...")
        print(f"   Host: {RABBITMQ_HOST}")
        print(f"   User: {RABBITMQ_USER}")
        print(f"   VHost: {RABBITMQ_VHOST}")
        print(f"   Queue: {SCORING_QUEUE}")
        
        # Create credentials
        credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
        
        # Create connection parameters
        parameters = pika.ConnectionParameters(
            host=RABBITMQ_HOST,
            port=RABBITMQ_PORT,
            virtual_host=RABBITMQ_VHOST,
            credentials=credentials,
            heartbeat=600,
            blocked_connection_timeout=300
        )
        
        # Connect to RabbitMQ
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        
        # Declare queue (make sure it exists)
        channel.queue_declare(queue=SCORING_QUEUE, durable=True)
        
        # Prepare message
        message = {
            'profile_data': profile_data,
            'template_id': template_id,
            'profile_url': profile_data.get('profile_url', '')
        }
        
        # Publish message
        channel.basic_publish(
            exchange='',
            routing_key=SCORING_QUEUE,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Make message persistent
            )
        )
        
        print(f"✓ Published to queue: {SCORING_QUEUE}")
        print(f"  Profile: {profile_data.get('name', 'Unknown')}")
        print(f"  Template ID: {template_id}")
        
        # Close connection
        connection.close()
        
        return True
        
    except Exception as e:
        print(f"✗ Failed to publish to queue: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    print("="*60)
    print("RE-SCORE PROFILE")
    print("="*60)
    
    # Profile file path
    profile_file = "data/scores/zulia_puspita_ningrum_38a1699d-ad54-4f05-9483-e3d35142d35f_20260225_150437_4454dd94_score.json"
    
    # Check if file exists
    if not os.path.exists(profile_file):
        print(f"✗ Profile file not found: {profile_file}")
        return
    
    # Load profile data
    print(f"\n📥 Loading profile from: {profile_file}")
    with open(profile_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    profile_data = data.get('profile', {})
    template_id = data.get('requirements_id', '')
    
    if not profile_data:
        print("✗ No profile data found in file")
        return
    
    if not template_id:
        print("✗ No template_id found in file")
        return
    
    print(f"✓ Profile loaded: {profile_data.get('name', 'Unknown')}")
    print(f"✓ Template ID: {template_id}")
    
    # Confirm
    print(f"\n⚠ This will re-score the profile with updated requirements")
    print(f"  Make sure you have updated the requirements in Supabase first!")
    confirm = input("\nContinue? (y/n): ").strip().lower()
    
    if confirm != 'y':
        print("Cancelled.")
        return
    
    # Publish to queue
    print(f"\n📤 Publishing to scoring queue...")
    success = publish_to_scoring_queue(profile_data, template_id)
    
    if success:
        print(f"\n✓ Profile queued for re-scoring!")
        print(f"  The scoring consumer will process it shortly.")
        print(f"  Check the scoring consumer logs to see the results.")
    else:
        print(f"\n✗ Failed to queue profile for re-scoring")


if __name__ == "__main__":
    main()
