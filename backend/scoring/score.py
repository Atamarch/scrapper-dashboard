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
        """
        Score skills (70 points) - OPTIMIZED
        - Required: 50 points
        - Preferred: 20 points
        - Lower fuzzy threshold untuk lebih flexible
        """
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
                    # OPTIMIZED: Lower threshold from 80% to 70%
                    ratio = fuzz.ratio(skill_lower, profile_skill)
                    
                    # Also check partial match
                    partial_ratio = fuzz.partial_ratio(skill_lower, profile_skill)
                    
                    # Use best of both
                    final_ratio = max(ratio, partial_ratio)
                    
                    if final_ratio >= 70:  # LOWERED threshold
                        if final_ratio > best_ratio:
                            best_ratio = final_ratio
                            matched = True
                
                if matched:
                    # Award points based on weight and match quality
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
            'preferred_matched': len(pref_matches),
            'preferred_total': len(preferred)
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
            'years': round(total_years, 1),
            'required': min_years
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
    print(f"  - Skills: 70 points (50 required + 20 preferred)")
    print(f"  - Experience: 20 points")
    print(f"  - Education: 10 points")
    print(f"  - Fuzzy threshold: 70% (more flexible)\n")
    
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
            skills_breakdown = score_result['breakdown'].get('skills', {})
            exp_breakdown = score_result['breakdown'].get('experience', {})
            
            results.append({
                'name': name,
                'profile_url': profile.get('profile_url', ''),
                'score': score_result['percentage'],
                'skills_matched': f"{skills_breakdown.get('required_matched', 0)}/{skills_breakdown.get('required_total', 0)}"
            })
            
            print(f"[{i}/{len(files)}] {name}: {score_result['percentage']}% (Skills: {skills_breakdown.get('required_matched', 0)}/{skills_breakdown.get('required_total', 0)})")
            
        except Exception as e:
            print(f"[{i}/{len(files)}] Error: {e}")
    
    # Sort by score
    results.sort(key=lambda x: x['score'], reverse=True)
    
    # Save CSV
    os.makedirs('data/scores', exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    csv_file = f'data/scores/scores_{requirements_id}_{timestamp}.csv'
    
    with open(csv_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['rank', 'name', 'profile_url', 'score', 'skills_matched'])
        writer.writeheader()
        for rank, result in enumerate(results, 1):
            writer.writerow({
                'rank': rank,
                'name': result['name'],
                'profile_url': result['profile_url'],
                'score': result['score'],
                'skills_matched': result['skills_matched']
            })
    
    print(f"\n{'='*60}")
    print(f"✓ Saved: {csv_file}")
    print(f"{'='*60}")
    print(f"\nTop 10:")
    for i, r in enumerate(results[:10], 1):
        print(f"  {i}. {r['name']}: {r['score']}% (Skills: {r['skills_matched']})")
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
