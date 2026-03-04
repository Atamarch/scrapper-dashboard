"""
Supabase Helper for API
Centralized database operations
"""
from typing import Dict, List, Optional
from supabase import create_client, Client
import os

# Supabase client
supabase: Client = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_KEY')
)


class ScheduleManager:
    """Manage crawler schedules in Supabase"""
    
    @staticmethod
    def get_all_simple() -> List[Dict]:
        """Get all schedules with template names (using FK relationship)"""
        try:
            response = supabase.table('crawler_schedules').select('''
                *,
                search_templates (
                    id,
                    name
                )
            ''').order('created_at', desc=True).execute()
            
            return response.data or []
            
        except Exception as e:
            print(f"Error getting schedules with JOIN: {e}")
            # Fallback: get without template names if FK not ready yet
            response = supabase.table('crawler_schedules')\
                .select('*')\
                .order('created_at', desc=True)\
                .execute()
            
            return response.data or []
    
    @staticmethod
    def get_by_id(schedule_id: str) -> Optional[Dict]:
        """Get schedule by ID"""
        response = supabase.table('crawler_schedules').select('''
            *,
            search_templates (
                id,
                name
            )
        ''').eq('id', schedule_id).execute()
        
        return response.data[0] if response.data else None
    
    @staticmethod
    def create(data: Dict) -> Dict:
        """Create new schedule"""
        response = supabase.table('crawler_schedules').insert(data).execute()
        return response.data[0] if response.data else None
    
    @staticmethod
    def update(schedule_id: str, data: Dict) -> Dict:
        """Update schedule"""
        response = supabase.table('crawler_schedules').update(data).eq('id', schedule_id).execute()
        return response.data[0] if response.data else None
    
    @staticmethod
    def delete(schedule_id: str) -> bool:
        """Delete schedule"""
        supabase.table('crawler_schedules').delete().eq('id', schedule_id).execute()
        return True
    
    @staticmethod
    def template_exists(template_id: str) -> bool:
        """Check if template exists"""
        response = supabase.table('search_templates').select('id').eq('id', template_id).execute()
        return bool(response.data)


class CompanyManager:
    """Manage companies in Supabase"""
    
    @staticmethod
    def get_all(platform: Optional[str] = None) -> List[Dict]:
        """Get all companies, optionally filtered by platform"""
        query = supabase.table('companies').select('*')
        
        if platform:
            query = query.ilike('platform', f'%{platform}%')
        
        response = query.order('created_at', desc=True).execute()
        return response.data or []
    
    @staticmethod
    def get_by_id(company_id: str) -> Optional[Dict]:
        """Get company by ID"""
        response = supabase.table('companies').select('*').eq('id', company_id).execute()
        return response.data[0] if response.data else None


class LeadsManager:
    """Manage leads in Supabase"""
    
    @staticmethod
    def get_by_platform(platform: str, limit: int = 100, offset: int = 0) -> Dict:
        """Get leads by platform"""
        # Get companies by platform
        companies = supabase.table('companies').select('id, name, code, platform')\
            .ilike('platform', f'%{platform}%').execute()
        
        if not companies.data:
            return {'companies': [], 'templates': [], 'leads': [], 'total': 0}
        
        company_ids = [c['id'] for c in companies.data]
        
        # Get templates by company_ids
        templates = supabase.table('search_templates').select('id, name, company_id')\
            .in_('company_id', company_ids).execute()
        
        if not templates.data:
            return {
                'companies': companies.data,
                'templates': [],
                'leads': [],
                'total': 0
            }
        
        template_ids = [t['id'] for t in templates.data]
        
        # Get leads by template_ids
        leads = supabase.table('leads_list').select('*')\
            .in_('template_id', template_ids)\
            .order('date', desc=True)\
            .range(offset, offset + limit - 1).execute()
        
        # Get total count
        count = supabase.table('leads_list').select('id', count='exact')\
            .in_('template_id', template_ids).execute()
        
        return {
            'companies': companies.data,
            'templates': templates.data,
            'leads': leads.data or [],
            'total': count.count or 0
        }
    
    @staticmethod
    def get_by_company(company_id: str, limit: int = 100, offset: int = 0) -> Dict:
        """Get leads by company ID"""
        # Get templates by company_id
        templates = supabase.table('search_templates').select('id, name, company_id')\
            .eq('company_id', company_id).execute()
        
        if not templates.data:
            return {'templates': [], 'leads': [], 'total': 0}
        
        template_ids = [t['id'] for t in templates.data]
        
        # Get leads by template_ids
        leads = supabase.table('leads_list').select('*')\
            .in_('template_id', template_ids)\
            .order('date', desc=True)\
            .range(offset, offset + limit - 1).execute()
        
        # Get total count
        count = supabase.table('leads_list').select('id', count='exact')\
            .in_('template_id', template_ids).execute()
        
        return {
            'templates': templates.data,
            'leads': leads.data or [],
            'total': count.count or 0
        }
