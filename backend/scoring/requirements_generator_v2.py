"""
Requirements Generator V2 - Generate Checklist Format Requirements
Converts job description to checklist array format for new scoring system
"""
import json
import re
from pathlib import Path


def clean_html(text):
    """Remove HTML tags from text"""
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\s+', ' ', text)
    text = text.replace('&nbsp;', ' ').replace('&amp;', '&')
    text = text.replace('&lt;', '<').replace('&gt;', '>')
    text = text.replace('&quot;', '"')
    return text.strip()


def extract_gender(text):
    """Extract gender requirement"""
    text_lower = text.lower()
    if any(word in text_lower for word in ['wanita', 'perempuan', 'female', 'woman']):
        return "female"
    elif any(word in text_lower for word in ['pria', 'laki-laki', 'male', 'man']):
        return "male"
    return None


def extract_location(text):
    """Extract location requirement"""
    cities = [
        'Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Semarang', 
        'Makassar', 'Palembang', 'Tangerang', 'Depok', 'Bekasi',
        'Bogor', 'Yogyakarta', 'Malang', 'Bali', 'Denpasar'
    ]
    
    for city in cities:
        if city.lower() in text.lower():
            return city
    
    patterns = [
        r'penempatan\s+(?:di\s+)?([A-Z][a-z]+)',
        r'lokasi\s*:?\s*([A-Z][a-z]+)',
        r'location\s*:?\s*([A-Z][a-z]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    
    return None


def extract_age_range(text):
    """Extract age range requirement"""
    patterns = [
        r'usia\s+(\d+)\s*-\s*(\d+)',
        r'age\s+(\d+)\s*-\s*(\d+)',
        r'(\d+)\s*-\s*(\d+)\s+tahun',
        r'(\d+)\s*-\s*(\d+)\s+years?\s+old',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text.lower())
        if match:
            return f"{match.group(1)}-{match.group(2)}"
    
    return None


def extract_min_experience(text):
    """Extract minimum experience years"""
    patterns = [
        r'minimal\s+(\d+)\s+tahun',
        r'minimum\s+(\d+)\s+tahun',
        r'minimum\s+(\d+)\s+years?',
        r'(\d+)\+?\s+years?\s+(?:of\s+)?experience',
        r'pengalaman\s+(\d+)\s+tahun',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text.lower())
        if match:
            return int(match.group(1))
    
    return None


def extract_education(text):
    """Extract education requirement"""
    text_lower = text.lower()
    
    # Check for specific education levels
    if any(word in text_lower for word in ['s2', 'master', 'magister']):
        return "master"
    elif any(word in text_lower for word in ['s1', 'bachelor', 'sarjana']):
        return "bachelor"
    elif any(word in text_lower for word in ['d3', 'diploma']):
        return "diploma"
    elif any(word in text_lower for word in ['sma', 'smk', 'high school']):
        return "high school"
    
    return None


def extract_skills(text):
    """Extract required skills from text"""
    # Common skills keywords
    skill_keywords = [
        # Technical
        'excel', 'microsoft office', 'word', 'powerpoint',
        'computer', 'komputer', 'typing',
        
        # Soft skills
        'communication', 'komunikasi', 'negotiation', 'negosiasi',
        'customer service', 'pelayanan', 'persuasion', 'persuasi',
        'leadership', 'kepemimpinan', 'teamwork', 'kerja sama',
        
        # Domain specific
        'collection', 'penagihan', 'debt', 'kredit',
        'telemarketing', 'outbound', 'call', 'telepon',
        'sales', 'penjualan', 'marketing', 'pemasaran',
        'finance', 'keuangan', 'banking', 'perbankan',
        'accounting', 'akuntansi', 'reporting', 'laporan',
    ]
    
    found_skills = []
    text_lower = text.lower()
    
    for skill in skill_keywords:
        if skill in text_lower:
            # Capitalize properly
            skill_formatted = skill.title()
            if skill_formatted not in found_skills:
                found_skills.append(skill_formatted)
    
    return found_skills


def generate_requirements_checklist(job_description, position_title):
    """Generate requirements in checklist array format"""
    
    # Clean text
    clean_text = clean_html(job_description)
    
    # Extract all requirements
    gender = extract_gender(clean_text)
    location = extract_location(clean_text)
    age_range = extract_age_range(clean_text)
    min_exp = extract_min_experience(clean_text)
    education = extract_education(clean_text)
    skills = extract_skills(clean_text)
    
    # Build requirements array
    requirements = []
    
    # Gender
    if gender:
        requirements.append({
            "id": "gender",
            "label": f"Gender: {gender.capitalize()}",
            "type": "gender",
            "value": gender
        })
    
    # Location
    if location:
        requirements.append({
            "id": "location",
            "label": f"Location: {location}",
            "type": "location",
            "value": location.lower()
        })
    
    # Age Range
    if age_range:
        requirements.append({
            "id": "age_range",
            "label": f"Age: {age_range} years",
            "type": "age",
            "value": age_range
        })
    
    # Minimum Experience
    if min_exp:
        requirements.append({
            "id": "min_experience",
            "label": f"Minimum {min_exp} year{'s' if min_exp > 1 else ''} experience",
            "type": "experience",
            "value": min_exp
        })
    
    # Education
    if education:
        requirements.append({
            "id": "education",
            "label": f"Education: {education.replace('_', ' ').title()}",
            "type": "education",
            "value": education
        })
    
    # Skills
    for idx, skill in enumerate(skills[:10]):  # Limit to 10 skills
        skill_id = f"skill_{skill.lower().replace(' ', '_')}"
        requirements.append({
            "id": skill_id,
            "label": f"Skill: {skill}",
            "type": "skill",
            "value": skill.lower()
        })
    
    # Build final output
    output = {
        "position": position_title,
        "requirements": requirements
    }
    
    return output


def main():
    print("="*70)
    print("REQUIREMENTS GENERATOR V2 - Checklist Format")
    print("="*70)
    print("\nGenerate requirements from job description")
    print("Output format: Checklist array for new scoring system\n")
    
    # Get position title
    position = input("Position Title: ").strip()
    if not position:
        print("Error: Position title is required!")
        return
    
    # Get job description
    print("\nPaste job description (press Ctrl+D or Ctrl+Z when done):")
    print("-" * 70)
    
    lines = []
    try:
        while True:
            line = input()
            lines.append(line)
    except EOFError:
        pass
    
    job_description = '\n'.join(lines)
    
    if not job_description.strip():
        print("\nError: Job description is required!")
        return
    
    # Generate requirements
    print("\n" + "="*70)
    print("GENERATING REQUIREMENTS...")
    print("="*70)
    
    requirements = generate_requirements_checklist(job_description, position)
    
    # Display result
    print("\n" + "="*70)
    print("GENERATED REQUIREMENTS (Checklist Format)")
    print("="*70)
    print(json.dumps(requirements, indent=2, ensure_ascii=False))
    print("="*70)
    print(f"\nTotal requirements: {len(requirements['requirements'])}")
    
    # Save to file
    filename_slug = position.lower().replace(' ', '_').replace('-', '_')
    filename_slug = ''.join(c for c in filename_slug if c.isalnum() or c == '_')
    default_filename = f"{filename_slug}.json"
    
    filename = input(f"\nSave as (default: {default_filename}): ").strip()
    if not filename:
        filename = default_filename
    
    if not filename.endswith('.json'):
        filename += '.json'
    
    filepath = Path('requirements') / filename
    filepath.parent.mkdir(exist_ok=True)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(requirements, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Saved to: {filepath}")
    print("\nYou can now use this requirements file for scoring!")


if __name__ == "__main__":
    main()
