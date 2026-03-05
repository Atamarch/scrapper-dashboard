"""
Simple health check tests for CI/CD
"""
import requests
import json
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

def test_health_endpoint():
    """Test health check endpoint"""
    try:
        # This would test against running server
        # For now, just test the function directly
        from main import health_check
        import asyncio
        
        # Run async function
        result = asyncio.run(health_check())
        
        assert 'status' in result
        assert 'timestamp' in result
        assert 'services' in result
        
        print("✅ Health check endpoint structure is valid")
        return True
        
    except Exception as e:
        print(f"❌ Health check test failed: {e}")
        return False

def test_requirements_templates():
    """Test that all requirements templates are valid"""
    import glob
    
    requirements_dir = Path(__file__).parent.parent.parent / "scoring" / "requirements"
    template_files = glob.glob(str(requirements_dir / "*.json"))
    
    if not template_files:
        print("❌ No requirements templates found")
        return False
    
    for file_path in template_files:
        try:
            with open(file_path, 'r') as f:
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
            
            print(f"✅ {Path(file_path).name} is valid")
            
        except Exception as e:
            print(f"❌ {Path(file_path).name} validation failed: {e}")
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
        
        # Check if file has basic required variables
        content = env_file.read_text()
        
        if "crawler" in str(env_file):
            required_vars = ["SUPABASE_URL", "RABBITMQ_HOST", "DB_CHECK_INTERVAL"]
        elif "scoring" in str(env_file):
            required_vars = ["SUPABASE_URL", "RABBITMQ_HOST"]
        else:  # api
            required_vars = ["SUPABASE_URL", "SUPABASE_KEY"]
        
        for var in required_vars:
            if var not in content:
                print(f"❌ Missing {var} in {env_file}")
                return False
        
        print(f"✅ {env_file.name} is valid")
    
    return True

if __name__ == "__main__":
    print("🧪 Running API Health Tests...")
    
    tests = [
        ("Health Endpoint", test_health_endpoint),
        ("Requirements Templates", test_requirements_templates), 
        ("Environment Files", test_environment_files)
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