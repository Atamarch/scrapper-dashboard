"""
Common profile processing utilities
"""
import json
from datetime import datetime
from .utils import get_profile_hash


class ProfileValidator:
    """Validate profile processing requirements"""
    
    @staticmethod
    def validate_message(message):
        """Validate incoming message structure"""
        if not message:
            return False, "Empty message"
        
        url = message.get('url')
        template_id = message.get('template_id')
        
        if not url:
            return False, "No URL in message"
        
        if not template_id:
            return False, "No template_id in message"
        
        return True, "Valid"
    
    @staticmethod
    def should_skip_processing(existing_lead):
        """Determine if profile should be skipped based on existing data"""
        if not existing_lead:
            return False, "No existing data"
        
        connection_status = existing_lead.get('connection_status', '')
        profile_data = existing_lead.get('profile_data')
        scoring_data = existing_lead.get('scoring_data')
        score = existing_lead.get('score', 0)
        
        # Check if data exists
        has_profile = profile_data and profile_data not in [None, '', '{}', {}]
        has_scoring = scoring_data and scoring_data not in [None, '', '{}', {}]
        
        # RULE 1: If status is pending, always process
        if connection_status == 'pending':
            return False, "Status: pending"
        
        # RULE 2: If status is scraped, check data completeness
        elif connection_status == 'scraped':
            if not has_profile or not has_scoring:
                missing = []
                if not has_profile:
                    missing.append("profile_data")
                if not has_scoring:
                    missing.append("scoring_data")
                return False, f"Missing: {', '.join(missing)}"
            
            # If score is 0 but has scoring data = valid result
            elif score == 0 and has_scoring:
                return True, "Score: 0% but valid (candidate not suitable)"
            
            # If score > 0 and all data exists = complete
            elif score > 0 and has_profile and has_scoring:
                return True, f"Complete (Score: {score}%)"
        
        # Other cases - check data completeness
        if not has_profile or not has_scoring:
            missing = []
            if not has_profile:
                missing.append("profile_data")
            if not has_scoring:
                missing.append("scoring_data")
            return False, f"Status: {connection_status}, missing: {', '.join(missing)}"
        
        return False, f"Status: {connection_status}"


class WebhookChecker:
    """Handle webhook completion checking"""
    
    @staticmethod
    def check_and_send_webhook(supabase_client, template_id, worker_id=""):
        """Check if schedule is completed and send webhook if needed"""
        try:
            # Get schedule_id from template
            schedule_result = supabase_client.table('crawler_schedules').select('id').eq('template_id', template_id).execute()
            
            if schedule_result.data:
                schedule_id = schedule_result.data[0]['id']
                print(f"[{worker_id}] 🔔 Checking webhook for schedule {schedule_id}...")
                
                # Import webhook helper
                import sys
                from pathlib import Path
                sys.path.append(str(Path(__file__).parent.parent / "api" / "helper"))
                
                try:
                    from webhook_helper import send_completion_webhook
                    webhook_sent = send_completion_webhook(supabase_client, schedule_id)
                    if webhook_sent:
                        print(f"[{worker_id}] ✅ Webhook notification sent")
                    return webhook_sent
                except ImportError:
                    print(f"[{worker_id}] ⚠ Webhook helper not available")
                    return False
            
        except Exception as webhook_error:
            print(f"[{worker_id}] ⚠ Webhook check failed: {webhook_error}")
            return False