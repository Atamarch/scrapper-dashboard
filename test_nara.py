import requests
import json

# Test Nara endpoint di Railway
def test_nara_endpoint():
    # Ganti dengan URL Railway kamu
    base_url = "https://linkedin-api-production-0937.up.railway.app"  # UPDATE INI!
    url = f"{base_url}/api/external/schedule-scraping"
    
    payload = {
        "job_title": "Senior Backend Developer",
        "job_description": """We are looking for a Senior Backend Developer to join our team. Requirements:
• 5+ years experience in backend development
• Strong proficiency in Python and FastAPI
• Experience with PostgreSQL and Redis
• Must have Docker knowledge
• Bachelor degree in Computer Science
• Nice to have: AWS experience""",
        "schedule_date": "2026-03-15",
        "schedule_time": "09:00",
        "webhook_url": "https://nara.test.com/webhook"
    }
    
    try:
        print("🚀 Testing Nara endpoint di Railway...")
        print(f"URL: {url}")
        
        response = requests.post(url, json=payload, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            schedule_id = data["data"]["schedule_id"]
            
            # Test status endpoint
            print(f"\n🔍 Testing status endpoint...")
            status_url = f"{base_url}/api/external/status/{schedule_id}"
            status_response = requests.get(status_url, timeout=30)
            
            print(f"Status Code: {status_response.status_code}")
            print(f"Status Response: {json.dumps(status_response.json(), indent=2)}")
            
            return True
            
    except requests.exceptions.ConnectionError:
        print("❌ Error: Tidak bisa connect ke Railway. Cek URL atau deployment.")
    except requests.exceptions.Timeout:
        print("❌ Error: Request timeout. Railway mungkin cold start.")
    except Exception as e:
        print(f"❌ Error: {e}")
        
    return False

# Test health check dulu
def test_health():
    base_url = "https://linkedin-api-production-0937.up.railway.app"  # UPDATE INI!
    
    try:
        print("🏥 Testing health check...")
        response = requests.get(f"{base_url}/health", timeout=10)
        print(f"Health Status: {response.status_code}")
        print(f"Health Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("🧪 TESTING NARA INTEGRATION DI RAILWAY")
    print("=" * 50)
    
    # Test health dulu
    if test_health():
        print("\n" + "=" * 30)
        # Test Nara endpoint
        test_nara_endpoint()
    else:
        print("❌ Health check gagal, cek deployment Railway")