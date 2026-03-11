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
        # Determine gender v