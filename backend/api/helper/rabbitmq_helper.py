"""
RabbitMQ Helper for API
Centralized queue management
"""
import os
import json
import pika
from datetime import datetime
from typing import Dict, Optional

# LavinMQ Configuration
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST')
RABBITMQ_PORT = int(os.getenv('RABBITMQ_PORT', '5672'))
RABBITMQ_USER = os.getenv('RABBITMQ_USER')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS')
RABBITMQ_VHOST = os.getenv('RABBITMQ_VHOST')
RABBITMQ_QUEUE = os.getenv('RABBITMQ_QUEUE')
OUTREACH_QUEUE = os.getenv('OUTREACH_QUEUE')


class QueuePublisher:
    """Simplified queue publisher for LavinMQ"""
    
    def __init__(self):
        self.credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
        
        # SSL/TLS support for port 5671
        if RABBITMQ_PORT == 5671:
            import ssl
            ssl_options = pika.SSLOptions(ssl.create_default_context())
            self.parameters = pika.ConnectionParameters(
                host=RABBITMQ_HOST,
                port=RABBITMQ_PORT,
                virtual_host=RABBITMQ_VHOST,
                credentials=self.credentials,
                ssl_options=ssl_options,
                heartbeat=600,
                blocked_connection_timeout=300
            )
        else:
            self.parameters = pika.ConnectionParameters(
                host=RABBITMQ_HOST,
                port=RABBITMQ_PORT,
                virtual_host=RABBITMQ_VHOST,
                credentials=self.credentials,
                heartbeat=600,
                blocked_connection_timeout=300
            )
    
    def publish(self, queue_name: str, message: Dict) -> bool:
        """Publish message to queue"""
        try:
            connection = pika.BlockingConnection(self.parameters)
            channel = connection.channel()
            
            # Declare queue
            channel.queue_declare(queue=queue_name, durable=True)
            
            # Publish message
            channel.basic_publish(
                exchange='',
                routing_key=queue_name,
                body=json.dumps(message),
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Persistent
                    content_type='application/json'
                )
            )
            
            connection.close()
            return True
            
        except Exception as e:
            print(f"❌ Queue publish failed: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def publish_crawler_job(self, profile_url: str, template_id: Optional[str] = None) -> bool:
        """Publish crawler job to queue"""
        message = {
            'url': profile_url,
            'template_id': template_id,
            'timestamp': datetime.now().isoformat(),
            'trigger': 'api'
        }
        return self.publish(RABBITMQ_QUEUE, message)
    
    def publish_outreach_job(self, lead: Dict, message_text: str, dry_run: bool = True, batch_id: str = None) -> bool:
        """Publish outreach job to queue"""
        message = {
            'job_id': f"outreach_{batch_id}_{lead.get('id', 'unknown')}",
            'lead_id': lead.get('id'),
            'name': lead.get('name'),
            'profile_url': lead.get('profile_url'),
            'message': message_text,
            'dry_run': dry_run,
            'batch_id': batch_id,
            'created_at': datetime.now().isoformat()
        }
        return self.publish(OUTREACH_QUEUE, message)


# Global instance
queue_publisher = QueuePublisher()
