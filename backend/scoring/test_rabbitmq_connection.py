"""
Test RabbitMQ/LavinMQ connection
Use this to debug connection issues
"""
import os
import pika
from dotenv import load_dotenv

load_dotenv()

RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'localhost')
RABBITMQ_PORT = int(os.getenv('RABBITMQ_PORT', 5672))
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'guest')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'guest')
RABBITMQ_VHOST = os.getenv('RABBITMQ_VHOST', '/')
SCORING_QUEUE = os.getenv('SCORING_QUEUE', 'scoring_queue')

print("="*60)
print("TESTING RABBITMQ CONNECTION")
print("="*60)
print(f"Host: {RABBITMQ_HOST}")
print(f"Port: {RABBITMQ_PORT}")
print(f"User: {RABBITMQ_USER}")
print(f"VHost: {RABBITMQ_VHOST}")
print(f"Queue: {SCORING_QUEUE}")
print("="*60)

try:
    print("\n1. Creating credentials...")
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
    print("   ✓ Credentials created")
    
    print("\n2. Creating connection parameters...")
    parameters = pika.ConnectionParameters(
        host=RABBITMQ_HOST,
        port=RABBITMQ_PORT,
        virtual_host=RABBITMQ_VHOST,
        credentials=credentials,
        heartbeat=600,
        blocked_connection_timeout=300
    )
    print("   ✓ Parameters created")
    
    print("\n3. Connecting to RabbitMQ...")
    connection = pika.BlockingConnection(parameters)
    print("   ✓ Connected!")
    
    print("\n4. Creating channel...")
    channel = connection.channel()
    print("   ✓ Channel created")
    
    print("\n5. Declaring queue...")
    result = channel.queue_declare(queue=SCORING_QUEUE, durable=True, passive=True)
    queue_size = result.method.message_count
    print(f"   ✓ Queue declared")
    print(f"   → Messages in queue: {queue_size}")
    
    print("\n6. Closing connection...")
    connection.close()
    print("   ✓ Connection closed")
    
    print("\n" + "="*60)
    print("✓ ALL TESTS PASSED!")
    print("="*60)
    print(f"\nQueue '{SCORING_QUEUE}' has {queue_size} message(s) waiting")
    
except Exception as e:
    print(f"\n✗ CONNECTION FAILED!")
    print(f"Error: {e}")
    print("\n" + "="*60)
    import traceback
    traceback.print_exc()
