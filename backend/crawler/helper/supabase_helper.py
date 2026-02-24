"""Supabase helper for storing crawled data"""
import os
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()


class SupabaseManager:
    def __init__(self):
        """Initialize Supabase client"""
        self.url = os.getenv('SUPABASE_URL')
        self.key = os.getenv('SUPABASE_KEY')
        
        if not self.url or not self.key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
        
        self.client: Client = create_client(self.url, self.key)
        print(f"✓ Supabase client initialized")
    
    def save_lead(self, profile_url, name, profile_data, connection_status='scraped', template_id=None):
        """
        Save crawled profile to leads_list table
        
        Args:
            profile_url: LinkedIn profile URL
            name: Person's name
            profile_data: Complete profile data as dict (will be stored in jsonb column)
            connection_status: Status (scraped, connected, message_sent, etc)
            template_id: Optional template ID for filtering
        
        Returns:
            bool: Success status
        """
        try:
            # Check if lead already exists
            existing = self.client.table('leads_list')\
                .select('id')\
                .eq('profile_url', profile_url)\
                .execute()
            
            if existing.data:
                # Update existing lead
                update_data = {
                    'name': name,
                    'profile_data': profile_data,
                    'connection_status': connection_status
                }
                
                result = self.client.table('leads_list')\
                    .update(update_data)\
                    .eq('profile_url', profile_url)\
                    .execute()
                
                print(f"  ✓ Updated existing lead: {name}")
            else:
                # Insert new lead
                insert_data = {
                    'profile_url': profile_url,
                    'name': name,
                    'profile_data': profile_data,
                    'connection_status': connection_status,
                    'date': datetime.now().date().isoformat()
                }
                
                if template_id:
                    insert_data['template_id'] = template_id
                
                result = self.client.table('leads_list')\
                    .insert(insert_data)\
                    .execute()
                
                print(f"  ✓ Saved new lead: {name}")
            
            return True
            
        except Exception as e:
            print(f"  ✗ Failed to save to Supabase: {e}")
            return False
    
    def update_connection_status(self, profile_url, status):
        """
        Update connection status for a lead
        
        Args:
            profile_url: LinkedIn profile URL
            status: New status (connection_sent, message_sent, etc)
        """
        try:
            result = self.client.table('leads_list')\
                .update({
                    'connection_status': status
                })\
                .eq('profile_url', profile_url)\
                .execute()
            
            print(f"  ✓ Updated status: {status}")
            return True
            
        except Exception as e:
            print(f"  ✗ Failed to update status: {e}")
            return False
    
    def update_outreach_status(self, profile_url, note_sent, status='success'):
        """
        Update lead after outreach (status + note)
        
        Args:
            profile_url: LinkedIn profile URL
            note_sent: The personalized message that was sent
            status: Connection status (default: 'success')
        
        Returns:
            bool: Success status
        """
        try:
            # Check if lead exists first
            lead = self.get_lead(profile_url)
            
            if not lead:
                print(f"  ⚠️  Profile not found: {profile_url}")
                return False
            
            print(f"  ✓ Found profile: {lead.get('name', 'Unknown')}")
            
            # Update both status and note
            result = self.client.table('leads_list')\
                .update({
                    'note_sent': note_sent,
                    'connection_status': status
                })\
                .eq('profile_url', profile_url)\
                .execute()
            
            print(f"  ✓ Updated outreach status: {status}")
            return True
            
        except Exception as e:
            print(f"  ✗ Failed to update outreach: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def lead_exists(self, profile_url):
        """Check if lead already exists in database"""
        try:
            result = self.client.table('leads_list')\
                .select('id')\
                .eq('profile_url', profile_url)\
                .execute()
            
            return len(result.data) > 0
            
        except Exception as e:
            print(f"  ✗ Failed to check lead existence: {e}")
            return False
    
    def get_lead(self, profile_url):
        """Get lead data from database"""
        try:
            result = self.client.table('leads_list')\
                .select('*')\
                .eq('profile_url', profile_url)\
                .execute()
            
            if result.data:
                return result.data[0]
            return None
            
        except Exception as e:
            print(f"  ✗ Failed to get lead: {e}")
            return None
    
    def get_lead_by_url(self, profile_url):
        """Get lead by profile URL (alias for get_lead)"""
        return self.get_lead(profile_url)
    
    def update_lead_after_scrape(self, profile_url, profile_data):
        """
        Update lead after scraping with profile data
        
        Args:
            profile_url: LinkedIn profile URL
            profile_data: Complete scraped profile data
        
        Returns:
            bool: Success status
        """
        try:
            # Extract relevant fields from profile_data
            update_data = {
                'name': profile_data.get('name', 'Unknown'),
                'profile_data': profile_data,
                'connection_status': 'scraped',  # ← Status jadi 'scraped' setelah crawl
                'scraped_at': datetime.now().isoformat()
            }
            
            # Update the lead
            result = self.client.table('leads_list')\
                .update(update_data)\
                .eq('profile_url', profile_url)\
                .execute()
            
            if result.data:
                print(f"  ✓ Updated lead after scrape: {update_data['name']}")
                return True
            else:
                print(f"  ⚠️  No lead found to update: {profile_url}")
                return False
            
        except Exception as e:
            print(f"  ✗ Failed to update lead after scrape: {e}")
            import traceback
            traceback.print_exc()
            return False
