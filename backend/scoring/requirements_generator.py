"""
Requirements Generator - Generate Checklist Format Requirements
UPDATED: Now uses new checklist format compatible with new scoring system
Usage: python requirements_generator.py
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


def extract_bullet_points(text):
    """Extract bullet points from text"""
    if not text:
        return []
    
    bullets = []
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    # Remove heading line if present
    if lines and any(keyword in lines[0].lower() for keyword in ['kualifikasi', 'persyaratan', 'requirements', 'syarat']):
        lines = lines[1:]
    
    for line in lines:
        # Skip if too short
        if len(line) < 5:
            continue
        
        # Clean bullet markers
        line_clean = re.sub(r'^[•\-\*○\d+\.\)]\s*', '', line).strip()
        
        if line_clean and len(line_clean) >= 5:
            bullets.append(line_clean)
    
    return bullets


def classify_requirement(text, req_id):
    """Classify a single requirement and extract structured value"""
    text_lower = text.lower()
    
    # Priority 1: Gender
    if any(word in text_lower for word in ['pria', 'wanita', 'laki-laki', 'perempuan', 'male', 'female']):
        # Determine gender value
        if 'pria / wanita' in text_lower or 'pria/wanita' in text_lower or ('pria' in text_lower and 'wanita' in text_lower):
            gender_value = 'any'
        elif any(word in text_lower for word in ['wanita', 'perempuan', 'female']):
            gender_value = 'female'
        elif any(word in text_lower for word in ['pria', 'laki-laki', 'male']):
            gender_value = 'male'
        else:
            gender_value = 'any'
        
        return {
            'id': f'req_{req_id}',
            'label': text,
            'type': 'gender',
            'value': gender_value
        }
    
    # Priority 2: Age
    if any(word in text_lower for word in ['usia', 'umur', 'age']):
        # Extract age range
        age_patterns = [
            r'(\d+)\s*-\s*(\d+)\s*tahun',
            r'(\d+)\s*sampai\s*(\d+)\s*tahun',
            r'maksimal\s*(\d+)\s*tahun',
            r'max\s*(\d+)\s*tahun'
        ]
        
        age_value = {'min': 18, 'max': 35}  # default
        
        for pattern in age_patterns:
            match = re.search(pattern, text_lower)
            if match:
                if match.lastindex >= 2:
                    age_value = {
                        'min': int(match.group(1)),
                        'max': int(match.group(2))
                    }
                else:
                    age_value = {
                        'min': 18,
                        'max': int(match.group(1))
                    }
                break
        
        return {
            'id': f'req_{req_id}',
            'label': text,
            'type': 'age',
            'value': age_value
        }
    
    # Priority 3: Education
    if any(word in text_lower for word in ['pendidikan', 'education', 'lulusan', 'ijazah', 'sma', 'smk', 'diploma', 's1', 'sarjana']):
        # Determine education level
        if any(word in text_lower for word in ['sarjana', 's1', 's-1', 'bachelor']):
            edu_value = 'bachelor'
        elif any(word in text_lower for word in ['diploma', 'd3', 'd-3']):
            edu_value = 'diploma'
        elif any(word in text_lower for word in ['sma', 'smk', 'high school', 'slta']):
            edu_value = 'high school'
        else:
            edu_value = 'high school'  # default
        
        return {
            'id': f'req_{req_id}',
            'label': text,
            'type': 'education',
            'value': edu_value
        }
    
    # Priority 4: Location
    if any(word in text_lower for word in ['penempatan', 'lokasi', 'domisili', 'location', 'ditempatkan']):
        # Extract location name
        location_match = re.search(r'(?:penempatan|lokasi|domisili|location|ditempatkan)\s*:?\s*([A-Za-z\s]+)', text, re.IGNORECASE)
        if location_match:
            location_value = location_match.group(1).strip()
            # Remove trailing words like "atau", "dan"
            location_value = re.sub(r'\s+(atau|or|dan|and)\s+.*', '', location_value, flags=re.IGNORECASE).strip()
        else:
            location_value = 'any'
        
        return {
            'id': f'req_{req_id}',
            'label': text,
            'type': 'location',
            'value': location_value.lower()
        }
    
    # Priority 5: Experience (with years)
    if any(word in text_lower for word in ['pengalaman', 'experience', 'berpengalaman']):
        # Extract years
        exp_patterns = [
            r'(?:minimal|minimum|min\.?)\s*(\d+)\s*(?:tahun|years?)',
            r'(\d+)\s*(?:tahun|years?)\s*(?:pengalaman|experience)',
            r'(\d+)\+?\s*(?:tahun|years?)'
        ]
        
        exp_value = 1  # default
        
        for pattern in exp_patterns:
            match = re.search(pattern, text_lower)
            if match:
                exp_value = int(match.group(1))
                break
        
        return {
            'id': f'req_{req_id}',
            'label': text,
            'type': 'experience',
            'value': exp_value
        }
    
    # Default: Skill
    return {
        'id': f'req_{req_id}',
        'label': text,
        'type': 'skill',
        'value': text.lower()
    }


def generate_requirements_from_text(job_description, position_title):
    """Generate requirements in new checklist format"""
    
    # Extract bullet points
    bullets = extract_bullet_points(job_description)
    
    # Classify each bullet point
    requirements_array = []
    for i, bullet in enumerate(bullets):
        req = classify_requirement(bullet, i + 1)
        requirements_array.append(req)
    
    # Add default requirements if none found
    if len(requirements_array) == 0:
        requirements_array = [
            {
                'id': 'req_1',
                'label': 'Minimum 1 year experience',
                'type': 'experience',
                'value': 1
            },
            {
                'id': 'req_2',
                'label': 'Education: High School',
                'type': 'education',
                'value': 'high school'
            }
        ]
    
    # Build final output
    return {
        'position': position_title,
        'requirements': requirements_array
    }


def main():
    print("="*70)
    print("REQUIREMENTS GENERATOR - New Checklist Format")
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
    
    requirements = generate_requirements_from_text(job_description, position)
    
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
