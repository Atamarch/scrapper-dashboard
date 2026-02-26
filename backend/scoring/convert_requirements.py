"""
Convert old requirements format to new checklist format
"""
import json

def convert_old_to_new_format(old_requirements):
    """Convert old point-based format to new checklist format"""
    
    new_requirements = {
        "position": old_requirements.get("position", "Unknown Position"),
        "requirements": []
    }
    
    # Gender
    if old_requirements.get("required_gender"):
        new_requirements["requirements"].append({
            "id": "gender",
            "label": f"Gender: {old_requirements['required_gender']}",
            "type": "gender",
            "value": old_requirements["required_gender"].lower()
        })
    
    # Location
    if old_requirements.get("required_location"):
        new_requirements["requirements"].append({
            "id": "location",
            "label": f"Location: {old_requirements['required_location']}",
            "type": "location",
            "value": old_requirements["required_location"].lower()
        })
    
    # Age Range
    if old_requirements.get("required_age_range"):
        age_range = old_requirements["required_age_range"]
        min_age = age_range.get("min", 20)
        max_age = age_range.get("max", 35)
        new_requirements["requirements"].append({
            "id": "age_range",
            "label": f"Age: {min_age}-{max_age} years",
            "type": "age",
            "value": f"{min_age}-{max_age}"
        })
    
    # Minimum Experience
    if old_requirements.get("min_experience_years"):
        years = old_requirements["min_experience_years"]
        new_requirements["requirements"].append({
            "id": "min_experience",
            "label": f"Minimum {years} year{'s' if years > 1 else ''} experience",
            "type": "experience",
            "value": years
        })
    
    # Required Skills
    if old_requirements.get("required_skills"):
        for skill_name in old_requirements["required_skills"].keys():
            skill_id = f"skill_{skill_name.lower().replace(' ', '_')}"
            new_requirements["requirements"].append({
                "id": skill_id,
                "label": f"Skill: {skill_name}",
                "type": "skill",
                "value": skill_name.lower()
            })
    
    # Education Level
    if old_requirements.get("education_level"):
        edu_levels = old_requirements["education_level"]
        if edu_levels:
            # Use the highest education level
            edu_map = {
                "High School": "high school",
                "Diploma": "diploma",
                "Bachelor": "bachelor",
                "Master": "master",
                "Doctoral": "doctoral"
            }
            highest = edu_levels[-1]  # Assume last is highest
            new_requirements["requirements"].append({
                "id": "education",
                "label": f"Education: {highest}",
                "type": "education",
                "value": edu_map.get(highest, highest.lower())
            })
    
    return new_requirements


if __name__ == "__main__":
    # Example: Convert the Desk Collection requirements
    old_format = {
        "position": "Desk Collection - BPR KS Bandung",
        "education_level": ["High School", "Diploma", "Bachelor"],
        "job_description": "Posisi Desk Collection bertanggung jawab melakukan penagihan kredit bermasalah melalui telepon (outbound call) kepada debitur. Kandidat harus terbiasa bekerja dengan target penagihan harian dan bulanan, mampu menghadapi debitur dengan berbagai karakter dalam situasi sulit, serta melakukan pencatatan hasil penagihan ke dalam sistem dengan teliti. Pengalaman di BPR atau lembaga keuangan menjadi nilai tambah. Penempatan di Bandung.",
        "required_gender": "Female",
        "required_skills": {
            "Communication": 1,
            "Customer Service": 1,
            "Debt Collection": 1,
            "Desk Collection": 1,
            "Negotiation": 1,
            "Persuasion": 1,
            "Outbound Call": 1,
            "Microsoft Office": 1
        },
        "required_location": "Bandung",
        "required_age_range": {
            "max": 35,
            "min": 20
        },
        "min_experience_years": 3
    }
    
    new_format = convert_old_to_new_format(old_format)
    
    print("="*60)
    print("CONVERTED REQUIREMENTS (New Checklist Format)")
    print("="*60)
    print(json.dumps(new_format, indent=2, ensure_ascii=False))
    print("="*60)
    print(f"\nTotal requirements: {len(new_format['requirements'])}")
    print("\nCopy this JSON and update your template in Supabase!")
