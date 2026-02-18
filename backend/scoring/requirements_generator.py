"""
Requirements Generator - Convert Job Description to JSON Requirements
Usage: python requirements_generator.py
"""
import json
import re
from pathlib import Path


def clean_html(text):
    """Remove HTML tags from text"""
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    # Decode HTML entities
    text = text.replace('&nbsp;', ' ')
    text = text.replace('&amp;', '&')
    text = text.replace('&lt;', '<')
    text = text.replace('&gt;', '>')
    text = text.replace('&quot;', '"')
    return text.strip()


def extract_experience_years(text):
    """Extract minimum experience years from text"""
    # Pattern: "minimal X tahun", "minimum X years", "X+ years", etc.
    patterns = [
        r'minimal\s+(\d+)\s+tahun',
        r'minimum\s+(\d+)\s+tahun',
        r'minimum\s+(\d+)\s+years?',
        r'(\d+)\+?\s+years?\s+(?:of\s+)?experience',
        r'pengalaman\s+(\d+)\s+tahun',
    ]
    
    text_lower = text.lower()
    for pattern in patterns:
        match = re.search(pattern, text_lower)
        if match:
            return int(match.group(1))
    
    return 0  # Default if not found


def extract_gender(text):
    """Extract gender requirement from text"""
    text_lower = text.lower()
    
    if any(word in text_lower for word in ['wanita', 'perempuan', 'female', 'woman']):
        return "Female"
    elif any(word in text_lower for word in ['pria', 'laki-laki', 'male', 'man']):
        return "Male"
    
    return None


def extract_location(text):
    """Extract location from text"""
    # Common Indonesian cities
    cities = [
        'Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Semarang', 
        'Makassar', 'Palembang', 'Tangerang', 'Depok', 'Bekasi',
        'Bogor', 'Yogyakarta', 'Malang', 'Bali', 'Denpasar'
    ]
    
    for city in cities:
        if city.lower() in text.lower():
            return city
    
    # Try to find "penempatan di X" or "lokasi X"
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
    """Extract age range from text"""
    # Pattern: "usia 20-35 tahun", "age 20 to 35", "20-35 years old"
    patterns = [
        r'usia\s+(\d+)\s*-\s*(\d+)',
        r'age\s+(\d+)\s*-\s*(\d+)',
        r'(\d+)\s*-\s*(\d+)\s+tahun',
        r'(\d+)\s*-\s*(\d+)\s+years?\s+old',
    ]
    
    text_lower = text.lower()
    for pattern in patterns:
        match = re.search(pattern, text_lower)
        if match:
            return {
                "min": int(match.group(1)),
                "max": int(match.group(2))
            }
    
    return None


def extract_education(text):
    """Extract education requirements from text"""
    education_levels = []
    text_lower = text.lower()
    
    # Check for each education level
    if any(word in text_lower for word in ['sma', 'smk', 'high school']):
        education_levels.append("High School")
    
    if any(word in text_lower for word in ['diploma', 'd3', 'associate']):
        education_levels.append("Diploma")
    
    if any(word in text_lower for word in ['sarjana', 's1', 'bachelor']):
        education_levels.append("Bachelor")
    
    if any(word in text_lower for word in ['master', 's2', 'mba']):
        education_levels.append("Master")
    
    if any(word in text_lower for word in ['doktor', 's3', 'phd', 'doctoral']):
        education_levels.append("Doctoral")
    
    return education_levels if education_levels else ["High School", "Diploma", "Bachelor"]


def interactive_requirements_generator():
    """Interactive mode to generate requirements"""
    print("="*70)
    print("REQUIREMENTS GENERATOR - Interactive Mode")
    print("="*70)
    print("\nPaste your job description below (can be HTML/Markdown).")
    print("Press Ctrl+D (Linux/Mac) or Ctrl+Z then Enter (Windows) when done.\n")
    
    # Read multi-line input
    lines = []
    try:
        while True:
            line = input()
            lines.append(line)
    except EOFError:
        pass
    
    job_description = '\n'.join(lines)
    
    # Clean HTML
    job_description_clean = clean_html(job_description)
    
    print("\n" + "="*70)
    print("EXTRACTED INFORMATION")
    print("="*70)
    
    # Extract information
    min_exp = extract_experience_years(job_description_clean)
    gender = extract_gender(job_description_clean)
    location = extract_location(job_description_clean)
    age_range = extract_age_range(job_description_clean)
    education = extract_education(job_description_clean)
    
    print(f"\nMinimum Experience: {min_exp} years")
    print(f"Gender: {gender or 'Not specified'}")
    print(f"Location: {location or 'Not specified'}")
    print(f"Age Range: {age_range or 'Not specified'}")
    print(f"Education: {', '.join(education)}")
    
    # Interactive input
    print("\n" + "="*70)
    print("MANUAL INPUT (Press Enter to use extracted value)")
    print("="*70)
    
    position = input("\nPosition Title: ").strip()
    if not position:
        print("Error: Position title is required!")
        return
    
    # Confirm or override extracted values
    min_exp_input = input(f"Minimum Experience Years [{min_exp}]: ").strip()
    min_exp = int(min_exp_input) if min_exp_input else min_exp
    
    gender_input = input(f"Required Gender (Male/Female/None) [{gender or 'None'}]: ").strip()
    gender = gender_input if gender_input else gender
    if gender and gender.lower() == 'none':
        gender = None
    
    location_input = input(f"Required Location [{location or 'None'}]: ").strip()
    location = location_input if location_input else location
    
    age_input = input(f"Age Range (format: 20-35) [{age_range or 'None'}]: ").strip()
    if age_input and '-' in age_input:
        min_age, max_age = age_input.split('-')
        age_range = {"min": int(min_age.strip()), "max": int(max_age.strip())}
    
    # Experience keywords
    print("\n" + "-"*70)
    print("EXPERIENCE KEYWORDS")
    print("-"*70)
    print("Enter required experience keywords (one per line, empty line to finish):")
    required_exp_keywords = []
    while True:
        keyword = input("  - ").strip()
        if not keyword:
            break
        required_exp_keywords.append(keyword)
    
    print("\nEnter preferred experience keywords (one per line, empty line to finish):")
    preferred_exp_keywords = []
    while True:
        keyword = input("  - ").strip()
        if not keyword:
            break
        preferred_exp_keywords.append(keyword)
    
    # Skills
    print("\n" + "-"*70)
    print("REQUIRED SKILLS (format: skill_name weight)")
    print("Example: Python 10")
    print("-"*70)
    print("Enter required skills (empty line to finish):")
    required_skills = {}
    while True:
        skill_input = input("  - ").strip()
        if not skill_input:
            break
        parts = skill_input.rsplit(' ', 1)
        if len(parts) == 2:
            skill_name, weight = parts
            try:
                required_skills[skill_name.strip()] = int(weight.strip())
            except ValueError:
                required_skills[skill_name.strip()] = 5  # Default weight
        else:
            required_skills[skill_input.strip()] = 5  # Default weight
    
    print("\nEnter preferred skills (format: skill_name weight, empty line to finish):")
    preferred_skills = {}
    while True:
        skill_input = input("  - ").strip()
        if not skill_input:
            break
        parts = skill_input.rsplit(' ', 1)
        if len(parts) == 2:
            skill_name, weight = parts
            try:
                preferred_skills[skill_name.strip()] = int(weight.strip())
            except ValueError:
                preferred_skills[skill_name.strip()] = 5
        else:
            preferred_skills[skill_input.strip()] = 5
    
    # Build requirements JSON
    requirements = {
        "position": position,
        "job_description": job_description_clean[:500] + "..." if len(job_description_clean) > 500 else job_description_clean,
        "min_experience_years": min_exp
    }
    
    if required_exp_keywords:
        requirements["required_experience_keywords"] = required_exp_keywords
    
    if preferred_exp_keywords:
        requirements["preferred_experience_keywords"] = preferred_exp_keywords
    
    if required_skills:
        requirements["required_skills"] = required_skills
    
    if preferred_skills:
        requirements["preferred_skills"] = preferred_skills
    
    if education:
        requirements["education_level"] = education
    
    if gender:
        requirements["required_gender"] = gender
    
    if location:
        requirements["required_location"] = location
    
    if age_range:
        requirements["required_age_range"] = age_range
    
    # Save to file
    print("\n" + "="*70)
    filename_slug = position.lower().replace(' ', '_').replace('/', '_')
    filename_slug = re.sub(r'[^a-z0-9_]', '', filename_slug)
    default_filename = f"{filename_slug}.json"
    
    filename = input(f"Save as (default: {default_filename}): ").strip()
    if not filename:
        filename = default_filename
    
    if not filename.endswith('.json'):
        filename += '.json'
    
    filepath = Path('requirements') / filename
    filepath.parent.mkdir(exist_ok=True)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(requirements, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Requirements saved to: {filepath}")
    print("\nPreview:")
    print(json.dumps(requirements, indent=2, ensure_ascii=False))


def main():
    print("\n" + "="*70)
    print("REQUIREMENTS GENERATOR")
    print("="*70)
    print("\nThis tool helps you convert job descriptions to JSON requirements.")
    print("\nOptions:")
    print("  1. Interactive mode (paste job description)")
    print("  2. Exit")
    
    choice = input("\nChoose option (1-2): ").strip()
    
    if choice == '1':
        interactive_requirements_generator()
    else:
        print("Goodbye!")


if __name__ == "__main__":
    main()
