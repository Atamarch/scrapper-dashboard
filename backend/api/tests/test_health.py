"""
Simple health check tests for CI/CD
"""
import json
import os
import sys
import glob
from pathlib import Path

def test_requirements_templates():
    """Test that all requirements templates are valid"""
    requirements_dir = Path(__file__).parent.parent.parent / "scoring" / "requirements"
    template_files = list(requirements_dir.glob("*.json"))
    
    if not template_files:
        print("❌ No requirements templates found")
        return False
    
    print(f"Found {len(template_files)} requirement templates")
    
    for file_path in template_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Validate structure
            assert 'position' in data, f"Missing 'position' in {file_path}"
            assert 'requirements' in data, f"Missing 'requirements' in {file_path}"
            assert isinstance(data['requirements'], list), f"'requirements' must be list in {file_path}"
            
            # Validate each requirement
            for req in data['requirements']:
                assert 'id' in req, f"Missing 'id' in requirement in {file_path}"
                assert 'label' in req, f"Missing 'label' in requirement in {file_path}"
                assert 'type' in req, f"Missing 'type' in requirement in {file_path}"
                assert 'value' in req, f"Missing 'value' in requirement in {file_path}"
            
            print(f"✅ {file_path.name} is valid")
            
        except Exception as e:
            print(f"❌ {file_path.name} validation failed: {e}")
            return False
    
    print(f"✅ All {len(template_files)} requirements templates are valid")
    return True

def test_environment_files():
    """Test that all .env.example files exist and are valid"""
    env_files = [
        Path(__file__).parent.parent / ".env.example",
        Path(__file__).parent.parent.parent / "crawler" / ".env.example", 
        Path(__file__).parent.parent.parent / "scoring" / ".env.example"
    ]
    
    for env_file in env_files:
        if not env_file.exists():
            print(f"❌ Missing {env_file}")
            return False
        
        print(f"✅ {env_file.name} exists")
    
    return True

def test_health_endpoint_structure():
    """Test health check endpoint structure"""
    try:
        # Test import only (no actual server start in CI)
        sys.path.append(str(Path(__file__).parent.parent))
        from main import app
        print("✅ Health check endpoint can be imported")
        return True
        
    except Exception as e:
        print(f"❌ Health check import failed: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Running API Health Tests...")
    
    tests = [
        ("Requirements Templates", test_requirements_templates),
        ("Environment Files", test_environment_files),
        ("Health Endpoint Structure", test_health_endpoint_structure)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n📋 Testing: {test_name}")
        if test_func():
            passed += 1
        else:
            print(f"❌ {test_name} failed")
    
    print(f"\n📊 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed!")
        exit(0)
    else:
        print("💥 Some tests failed!")
        exit(1)