"""
Common RabbitMQ connection utilities
"""
import os
import pika
from dotenv import load_dotenv

load_dotenv()

# Configuration
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'localhost')
RABBITMQ_PORT = int(os.getenv('RABBITMQ_PORT', 5672))
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'guest')
RABBITMQ_PASSWORD = os.getenv('RABBITMQ_PASS', 'guest')
RABBITMQ_VHOST = os.getenv('RABBITMQ_VHOST', '/')


def create_rabbitmq_connection():
    """Create standardized RabbitMQ connection"""
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
    parameters = pika.ConnectionParameters(
        host=RABBITMQ_HOST,
        port=RABBITMQ_PORT,
        virtual_host=RABBITMQ_VHOST,
        credentials=credentials,
        heartbeat=600,
        blocked_connection_timeout=300
    )
    return pika.BlockingConnection(parameters)


def create_rabbitmq_channel(queue_name, durable=True):
    """Create RabbitMQ channel with queue declaration"""
    connection = create_rabbitmq_connection()
    channel = connection.channel()
    channel.queue_declare(queue=queue_name, durable=durable)
    return connection, channel