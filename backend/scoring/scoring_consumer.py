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
RABBITMQ_VHOST = os.getenv('RABBITMQ_VHOST', '/')
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
    """Optimized Scorer - Focus on demographics first"""
    def __init__(self, requirements):
        self.requirements = requirements
        self.breakdown = {}
    
    def _score_demographics(self, profile):
        """Score demographics (40 points) - PRIORITAS TERTINGGI
        - Gender: 15 points
        - Location: 15 points
        - Age: 10 points
        """
        total = 0
        details = {}
        
        # 1. Gender (15 points)
        required_gender = self.requirements.get('required_gender', '').lower()
        profile_gender = profile.get('gender', '').lower()
        
        if required_gender and profile_gender:
            if required_gender in profile_gender or profile_gender in required_gender:
                gender_score = 15
                details['gender'] = {'score': 15, 'match': True, 'value': profile_gender}
            else:
                gender_score = 0
                details['gender'] = {'score': 0, 'match': False, 'value': profile_gender}
        else:
            gender_score = 0
            details['gender'] = {'score': 0, 'match': False, 'value': profile_gender or 'N/A'}
        
        total += gender_score
        
        # 2. Location (15 points)
        required_location = self.requirements.get('required_location', '').lower()
        profile_location = profile.get('location', '').lower()
        
        if required_location and profile_location:
            # Exact match
            if required_location in profile_location or profile_location in required_location:
                location_score = 15
                details['location'] = {'score': 15, 'match': True, 'value': profile_location}
            # Partial match using fuzzy
            else:
                ratio = fuzz.partial_ratio(required_location, profile_location)
                if ratio >= 80:
                    location_score = 15 * (ratio / 100)
                    details['location'] = {'score': round(location_score, 2), 'match': 'partial', 'value': profile_location}
                else:
                    location_score = 0
                    details['location'] = {'score': 0, 'match': False, 'value': profile_location}
        else:
            location_score = 0
            details['location'] = {'score': 0, 'match': False, 'value': profile_location or 'N/A'}
        
        total += location_score
        
        # 3. Age (10 points)
        age_range = self.requirements.get('required_age_range', {})
        
        # Try multiple sources for age with fallback
        profile_age = None
        age_source = "N/A"
        
        # Priority 1: Direct 'age' field
        if profile.get('age'):
            profile_age = profile.get('age')
            age_source = "direct"
        # Priority 2: estimated_age object (from crawler)
        elif profile.get('estimated_age'):
            estimated = profile.get('estimated_age', {})
            if isinstance(estimated, dict):
                profile_age = estimated.get('estimated_age')
                age_source = f"estimated ({estimated.get('based_on', 'unknown')})"
            else:
                profile_age = estimated
                age_source = "estimated"
        
        if age_range and profile_age:
            min_age = age_range.get('min', 0)
            max_age = age_range.get('max', 100)
            
            try:
                age = int(profile_age)
                if min_age <= age <= max_age:
                    age_score = 10
                    details['age'] = {'score': 10, 'match': True, 'value': age, 'range': f"{min_age}-{max_age}", 'source': age_source}
                else:
                    # Partial score if close to range
                    if age < min_age:
                        diff = min_age - age
                        age_score = max(0, 10 - (diff * 2))  # -2 points per year below
                    else:
                        diff = age - max_age
                        age_score = max(0, 10 - (diff * 2))  # -2 points per year above
                    details['age'] = {'score': round(age_score, 2), 'match': False, 'value': age, 'range': f"{min_age}-{max_age}", 'source': age_source}
            except:
                age_score = 0
                details['age'] = {'score': 0, 'match': False, 'value': profile_age, 'range': f"{min_age}-{max_age}", 'source': age_source}
        else:
            age_score = 0
            # Store N/A with reason
            if not age_range:
                details['age'] = {'score': 0, 'match': False, 'value': 'N/A', 'reason': 'no age requirement'}
            elif not profile_age:
                details['age'] = {'score': 0, 'match': False, 'value': 'N/A', 'reason': 'age not found in profile'}
            else:
                details['age'] = {'score': 0, 'match': False, 'value': 'N/A', 'reason': 'unknown'}
            details['age'] = {'score': 0, 'match': False, 'value': profile_age or 'N/A'}
        
        total += age_score
        
        self.breakdown['demographics'] = {
            'score': round(total, 2),
            'details': details
        }
        
        return total
    
    def score(self, profile):
        """Calculate total score - PRIORITAS: Demographics > Experience > Skills > Education"""
        total = 0
        
        # 1. Demographics (40 points) - PRIORITAS TERTINGGI
        demo_score = self._score_demographics(profile)
        total += demo_score
        
        # 2. Experience (25 points)
        exp_score = self._score_experience(profile.get('experiences', []))
        total += exp_score
        
        # 3. Skills (25 points)
        skills_score = self._score_skills(profile.get('skills', []))
        total += skills_score
        
        # 4. Education (10 points)
        edu_score = self._score_education(profile.get('education', []))
        total += edu_score
        
        percentage = (total / 100) * 100
        
        return {
            'total_score': round(total, 2),
            'percentage': round(percentage, 2),
            'breakdown': self.breakdown
        }
    
    def _score_skills(self, profile_skills):
        """Score skills (25 points) - Required: 18, Preferred: 7"""
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
        
        # Score required (18 points)
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
                    
                    if final_ratio >= 70:
                        if final_ratio > best_ratio:
                            best_ratio = final_ratio
                            matched = True
                
                if matched:
                    points = (weight / total_weight) * 18 * (best_ratio / 100)
                    req_score += points
                    req_matches.append(skill)
                else:
                    req_missing.append(skill)
        
        # Score preferred (7 points)
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
                    points = (weight / total_weight) * 7 * (best_ratio / 100)
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
        """Score experience (25 points) - Dynamic based on requirements"""
        min_years = self.requirements.get('min_experience_years', 0)
        
        # Priority 1: Use explicit experience keywords if provided
        required_exp_keywords = self.requirements.get('required_experience_keywords', [])
        preferred_exp_keywords = self.requirements.get('preferred_experience_keywords', [])
        
        experience_keywords = []
        
        if required_exp_keywords:
            # Use explicit required experience keywords
            experience_keywords.extend([kw.lower() for kw in required_exp_keywords])
        
        if preferred_exp_keywords:
            # Add preferred experience keywords (for bonus matching)
            experience_keywords.extend([kw.lower() for kw in preferred_exp_keywords])
        
        # Priority 2: Fallback to skills if no explicit experience keywords
        if not experience_keywords:
            # Get keywords from required_skills and preferred_skills
            required_skills = self.requirements.get('required_skills', {})
            if required_skills:
                experience_keywords.extend([skill.lower() for skill in required_skills.keys()])
            
            preferred_skills = self.requirements.get('preferred_skills', {})
            if preferred_skills:
                experience_keywords.extend([skill.lower() for skill in preferred_skills.keys()])
            
            # Add position name as keyword
            position = self.requirements.get('position', '')
            if position:
                position_words = position.lower().split()
                experience_keywords.extend(position_words)
        
        # Remove duplicates and filter out common words
        common_words = ['and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', '-']
        experience_keywords = list(set([kw for kw in experience_keywords if kw not in common_words and len(kw) > 2]))
        
        if not experience_keywords:
            # Fallback: if no keywords, count all experience
            print("  ⚠ No experience keywords found, counting all experience")
            experience_keywords = ['']  # Empty string will match everything
        
        # Calculate relevant experience
        relevant_months = 0
        relevant_experiences = []
        
        for exp in experiences:
            if not isinstance(exp, dict):
                continue
            
            # Check if experience is relevant
            title = exp.get('title', '').lower()
            company = exp.get('company', '').lower()
            description = exp.get('description', '').lower()
            
            # Combine all text for matching
            exp_text = f"{title} {company} {description}"
            
            # Check if any keyword matches
            is_relevant = False
            matched_keywords = []
            
            for keyword in experience_keywords:
                # Direct substring match
                if keyword in exp_text:
                    is_relevant = True
                    matched_keywords.append(keyword)
                else:
                    # Fuzzy match for typos/variations
                    for word_chunk in exp_text.split():
                        ratio = fuzz.ratio(keyword, word_chunk)
                        if ratio >= 80:  # Threshold for matching
                            is_relevant = True
                            matched_keywords.append(keyword)
                            break
            
            # If relevant, count the duration
            if is_relevant:
                duration = exp.get('duration', '')
                if duration:
                    years = 0
                    months = 0
                    year_match = re.search(r'(\d+)\s*yr', duration)
                    if year_match:
                        years = int(year_match.group(1))
                    month_match = re.search(r'(\d+)\s*mo', duration)
                    if month_match:
                        months = int(month_match.group(1))
                    
                    exp_months = (years * 12) + months
                    relevant_months += exp_months
                    
                    relevant_experiences.append({
                        'title': exp.get('title', 'N/A'),
                        'company': exp.get('company', 'N/A'),
                        'duration': duration,
                        'months': exp_months,
                        'matched_keywords': list(set(matched_keywords))
                    })
        
        relevant_years = relevant_months / 12
        
        # Scoring based on experience
        if relevant_years >= min_years:
            score = 25
        else:
            # Give partial credit only if close (within 1 year)
            if relevant_years >= (min_years - 1) and relevant_years > 0:
                score = (relevant_years / min_years) * 25
            else:
                score = 0
        
        self.breakdown['experience'] = {
            'score': round(score, 2),
            'relevant_years': round(relevant_years, 1),
            'required_years': min_years,
            'relevant_experiences': relevant_experiences,
            'total_experiences': len(experiences),
            'meets_requirement': relevant_years >= min_years,
            'keywords_used': experience_keywords[:10]  # Show first 10 keywords used
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


def load_requirements(template_id):
    """Load requirements from Supabase templates table"""
    if not supabase:
        print("⚠ Supabase not configured")
        return None
    
    try:
        print(f"📥 Loading requirements from Supabase (template_id: {template_id})...")
        
        response = supabase.table('templates').select('requirements').eq('id', template_id).execute()
        
        if not response.data or len(response.data) == 0:
            print(f"⚠ Template not found: {template_id}")
            return None
        
        requirements = response.data[0].get('requirements')
        
        if not requirements:
            print(f"⚠ No requirements found in template: {template_id}")
            return None
        
        print(f"✓ Requirements loaded from Supabase")
        return requirements
    
    except Exception as e:
        print(f"✗ Error loading requirements from Supabase: {e}")
        import traceback
        traceback.print_exc()
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


def update_supabase_score(profile_url, total_score, profile_data=None):
    """Update score and profile data in Supabase leads_list table
    
    ALWAYS overwrites existing score with new score and updates scored_at to current date
    """
    try:
        print(f"📤 Updating Supabase...")
        
        # Check if lead exists first
        existing = supabase.table('leads_list').select('id, profile_data, score').eq('profile_url', profile_url).execute()
        
        # Prepare update data - ALWAYS update score and scored_at
        update_data = {
            'score': total_score,
            'scored_at': datetime.now().date().isoformat()
        }
        
        # Add profile data if provided and not already in database
        if profile_data:
            # Update name if available
            if profile_data.get('name'):
                update_data['name'] = profile_data.get('name')
            
            # If profile_data doesn't exist in DB yet, save it
            if existing.data and len(existing.data) > 0:
                existing_profile_data = existing.data[0].get('profile_data')
                if not existing_profile_data or existing_profile_data == {}:
                    # No profile data yet, save it
                    update_data['profile_data'] = profile_data
                    print(f"  → Adding profile_data to existing lead")
            else:
                # Lead doesn't exist, will be created with profile data
                update_data['profile_data'] = profile_data
                update_data['date'] = datetime.now().date().isoformat()
                update_data['connection_status'] = 'scored'
        
        # Update or insert
        if existing.data and len(existing.data) > 0:
            # Update existing lead - OVERWRITE score
            old_score = existing.data[0].get('score')
            response = supabase.table('leads_list').update(update_data).eq('profile_url', profile_url).execute()
            
            if response.data:
                if old_score is not None:
                    print(f"✓ Supabase updated: {profile_url} → score: {old_score} → {total_score} (overwritten)")
                else:
                    print(f"✓ Supabase updated: {profile_url} → score: {total_score} (new)")
                return True
            else:
                print(f"⚠ Failed to update Supabase")
                return False
        else:
            # Insert new lead (shouldn't happen if crawler ran first, but handle it)
            insert_data = {
                'profile_url': profile_url,
                'score': total_score,
                'scored_at': datetime.now().date().isoformat(),
                'date': datetime.now().date().isoformat(),
                'connection_status': 'scored'
            }
            
            if profile_data:
                insert_data['name'] = profile_data.get('name', 'Unknown')
                insert_data['profile_data'] = profile_data
            
            response = supabase.table('leads_list').insert(insert_data).execute()
            
            if response.data:
                print(f"✓ Supabase inserted: {profile_url} → score: {total_score}")
                return True
            else:
                print(f"⚠ Failed to insert to Supabase")
                return False
    
    except Exception as e:
        print(f"✗ Failed to update Supabase: {e}")
        import traceback
        traceback.print_exc()
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
        template_id = message_data.get('template_id')
        requirements_id = message_data.get('requirements_id')  # Keep for backward compatibility
        profile_url = profile_data.get('profile_url', '') if profile_data else ''
        
        if not profile_data:
            print("✗ No profile data in message")
            return False
        
        # Use template_id if available, fallback to requirements_id
        req_id = template_id or requirements_id
        
        if not req_id:
            print("✗ No template_id or requirements_id in message")
            return False
        
        name = profile_data.get('name', 'Unknown')
        print(f"\n📥 Processing: {name}")
        print(f"   Template ID: {req_id}")
        
        # Check if already scored
        if profile_url:
            already_exists, existing_file = check_if_already_scored(profile_url, req_id)
            if already_exists:
                print(f"⊘ Already scored: {existing_file}")
                with stats['lock']:
                    stats['skipped'] += 1
                return True  # Return True to ack message
        
        # Load requirements from Supabase templates table
        requirements = load_requirements(req_id)
        
        if not requirements:
            print(f"✗ Failed to load requirements from Supabase: {req_id}")
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
        demo_breakdown = breakdown.get('demographics', {})
        demo_details = demo_breakdown.get('details', {})
        skills_breakdown = breakdown.get('skills', {})
        exp_breakdown = breakdown.get('experience', {})
        
        print(f"\nBreakdown:")
        print(f"  - Demographics: {demo_breakdown.get('score', 0)}/40")
        print(f"    • Gender: {demo_details.get('gender', {}).get('score', 0)}/15 ({demo_details.get('gender', {}).get('value', 'N/A')})")
        print(f"    • Location: {demo_details.get('location', {}).get('score', 0)}/15 ({demo_details.get('location', {}).get('value', 'N/A')})")
        print(f"    • Age: {demo_details.get('age', {}).get('score', 0)}/10 ({demo_details.get('age', {}).get('value', 'N/A')})")
        print(f"  - Experience: {exp_breakdown.get('score', 0)}/25 (Relevant: {exp_breakdown.get('relevant_years', 0)}/{exp_breakdown.get('required_years', 0)} years)")
        if exp_breakdown.get('meets_requirement'):
            print(f"    ✓ Meets requirement")
        else:
            print(f"    ✗ Does NOT meet requirement (needs {exp_breakdown.get('required_years', 0)} years)")
        if exp_breakdown.get('relevant_experiences'):
            print(f"    Relevant positions:")
            for rel_exp in exp_breakdown.get('relevant_experiences', [])[:3]:  # Show top 3
                print(f"      • {rel_exp.get('title')} at {rel_exp.get('company', 'N/A')} - {rel_exp.get('duration')}")
        print(f"  - Skills: {skills_breakdown.get('score', 0)}/25 (Matched: {skills_breakdown.get('required_matched', 0)}/{skills_breakdown.get('required_total', 0)})")
        print(f"  - Education: {breakdown.get('education', {}).get('score', 0)}/10")
        print(f"{'='*60}")
        
        # Save result
        save_score_result(profile_data, score_result, req_id)
        
        # Update Supabase
        if supabase:
            profile_url = profile_data.get('profile_url', '')
            total_score = score_result.get('total_score', 0)
            if profile_url:
                if update_supabase_score(profile_url, total_score, profile_data):
                    with stats['lock']:
                        stats['supabase_updated'] += 1
                else:
                    with stats['lock']:
                        stats['supabase_failed'] += 1
        else:
            print("⚠ Supabase not configured, skipping database update")
        
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
            virtual_host=RABBITMQ_VHOST,
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
    
    # Check Supabase connection
    if not supabase:
        print("\n✗ Supabase not configured!")
        print("  Please set SUPABASE_URL and SUPABASE_KEY in .env")
        return
    
    print(f"\n✓ Supabase connected")
    print(f"  Requirements will be loaded from 'templates' table")
    
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
            virtual_host=RABBITMQ_VHOST,
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
