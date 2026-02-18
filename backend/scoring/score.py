"""
Optimized Scoring System - All in One
Usage: python score.py
"""
import json
import os
import csv
import re
from datetime import datetime
from rapidfuzz import fuzz


class Scorer:
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
                details['age'] = {'score': 0, 'match': False, 'value': profile_age or 'N/A', 'reason': 'unknown'}
        
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
        
        # 2. Experience (25 points) - Only relevant experience
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
            'preferred_matched': len(pref_matches),
            'preferred_total': len(preferred)
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


def batch_score(profiles_dir, requirements_id):
    """Score all profiles and save to CSV"""
    
    print("="*60)
    print("OPTIMIZED BATCH SCORING")
    print("="*60)
    
    # Load requirements
    req_file = f'requirements/{requirements_id}.json'
    if not os.path.exists(req_file):
        print(f"✗ Requirements not found: {req_file}")
        return
    
    with open(req_file, 'r') as f:
        requirements = json.load(f)
    
    print(f"\nPosition: {requirements.get('position')}")
    print(f"Profiles: {profiles_dir}")
    
    # Get profiles
    files = [f for f in os.listdir(profiles_dir) if f.endswith('.json')]
    if not files:
        print(f"✗ No JSON files found")
        return
    
    print(f"Found: {len(files)} profiles")
    print(f"\nScoring weights:")
    print(f"  - Demographics: 40 points (Gender: 15, Location: 15, Age: 10)")
    print(f"  - Experience: 25 points (Dynamic based on position requirements)")
    print(f"  - Skills: 25 points (18 required + 7 preferred)")
    print(f"  - Education: 10 points")
    print(f"  - Fuzzy threshold: 70-80% (flexible)\n")
    
    # Score each profile
    results = []
    scorer = Scorer(requirements)
    
    for i, filename in enumerate(files, 1):
        try:
            with open(os.path.join(profiles_dir, filename), 'r') as f:
                profile = json.load(f)
            
            # Get name
            name = profile.get('name', '').strip()
            if not name or name == 'N/A':
                url = profile.get('profile_url', '')
                if '/in/' in url:
                    name = url.split('/in/')[-1].split('/')[0].split('?')[0]
                    name = name.replace('-', ' ').title()
                else:
                    name = filename.replace('.json', '').replace('_', ' ').title()
            
            # Score
            score_result = scorer.score(profile)
            
            # Get breakdown
            demo_breakdown = score_result['breakdown'].get('demographics', {})
            demo_details = demo_breakdown.get('details', {})
            skills_breakdown = score_result['breakdown'].get('skills', {})
            exp_breakdown = score_result['breakdown'].get('experience', {})
            
            results.append({
                'name': name,
                'profile_url': profile.get('profile_url', ''),
                'score': score_result['percentage'],
                'gender': demo_details.get('gender', {}).get('value', 'N/A'),
                'location': demo_details.get('location', {}).get('value', 'N/A'),
                'age': demo_details.get('age', {}).get('value', 'N/A'),
                'relevant_exp': f"{exp_breakdown.get('relevant_years', 0)} yrs",
                'skills_matched': f"{skills_breakdown.get('required_matched', 0)}/{skills_breakdown.get('required_total', 0)}"
            })
            
            print(f"[{i}/{len(files)}] {name}: {score_result['percentage']}% (Demo: {demo_breakdown.get('score', 0)}/40, Exp: {exp_breakdown.get('relevant_years', 0)}y)")
            
        except Exception as e:
            print(f"[{i}/{len(files)}] Error: {e}")
    
    # Sort by score
    results.sort(key=lambda x: x['score'], reverse=True)
    
    # Save CSV
    os.makedirs('data/scores', exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    csv_file = f'data/scores/scores_{requirements_id}_{timestamp}.csv'
    
    with open(csv_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['rank', 'name', 'profile_url', 'score', 'gender', 'location', 'age', 'relevant_exp', 'skills_matched'])
        writer.writeheader()
        for rank, result in enumerate(results, 1):
            writer.writerow({
                'rank': rank,
                'name': result['name'],
                'profile_url': result['profile_url'],
                'score': result['score'],
                'gender': result['gender'],
                'location': result['location'],
                'age': result['age'],
                'relevant_exp': result['relevant_exp'],
                'skills_matched': result['skills_matched']
            })
    
    print(f"\n{'='*60}")
    print(f"✓ Saved: {csv_file}")
    print(f"{'='*60}")
    print(f"\nTop 10:")
    for i, r in enumerate(results[:10], 1):
        print(f"  {i}. {r['name']}: {r['score']}%")
        print(f"     Gender: {r['gender']}, Location: {r['location']}, Age: {r['age']}")
        print(f"     Exp: {r['relevant_exp']}, Skills: {r['skills_matched']}")
    print()


def main():
    print("Available requirements:")
    reqs = [f.replace('.json', '') for f in os.listdir('requirements') if f.endswith('.json')]
    for r in reqs:
        print(f"  - {r}")
    
    req_id = input(f"\nRequirements ID (default: desk_collection): ").strip()
    if not req_id:
        req_id = 'desk_collection'
    
    profiles_dir = input(f"Profiles directory (default: ../crawler/data/output): ").strip()
    if not profiles_dir:
        profiles_dir = '../crawler/data/output'
    
    if not os.path.exists(profiles_dir):
        print(f"✗ Directory not found: {profiles_dir}")
        return
    
    batch_score(profiles_dir, req_id)


if __name__ == "__main__":
    main()
