#!/usr/bin/env python3
"""
Test script to verify the status field fix for Nara external schedules
"""

import requests
import json

# Use Railway URL as mentioned by user
BASE_URL = "https://linkedin-api-production-0937.up.railway.app"

# Test the external schedule creation endpoint
def test_external_schedule_creation():
    url = f"{BASE_URL}/api/external/schedule-scraping"
    
    payload = {
        "job_title": "Test Status Fix",
        "job_description": "This is a test to verify that external schedules show as active by default",
        "schedule_date": "2026-03-15",
        "schedule_time": "09:00",
        "timezone": "Asia/Jakarta",
        "external_source": "nara"
    }
    
    print("🧪 Testing external schedule creation...")
    print(f"📤 POST {url}")
    print(f"📊 Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload)
        print(f"📥 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Response: {json.dumps(data, indent=2)}")
            
            # Check if status field is present and correct
            if 'data' in data and 'status' in data['data']:
                status = data['data']['status']
                print(f"✅ Status field found: {status}")
                if status == 'active':
                    print("✅ Status is correctly set to 'active'")
                else:
                    print(f"❌ Status is '{status}', expected 'active'")
            else:
                print("❌ Status field not found in response")
                
        else:
            print(f"❌ Request failed: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

# Test the schedules list endpoint
def test_schedules_list():
    url = f"{BASE_URL}/api/schedules?external_source=nara"
    
    print("\n🧪 Testing schedules list for Nara...")
    print(f"📤 GET {url}")
    
    try:
        response = requests.get(url)
        print(f"📥 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            schedules = data.get('schedules', [])
            print(f"✅ Found {len(schedules)} Nara schedules")
            
            for i, schedule in enumerate(schedules[:3]):  # Show first 3
                print(f"\n📋 Schedule {i+1}:")
                print(f"   Name: {schedule.get('name')}")
                print(f"   Status: {schedule.get('status')}")
                print(f"   Schedule Status: {schedule.get('schedule_status')}")
                print(f"   External Source: {schedule.get('external_source')}")
                
                # Check status field
                if 'status' in schedule:
                    status = schedule['status']
                    if status == 'active':
                        print(f"   ✅ Status correctly shows as 'active'")
                    else:
                        print(f"   ❌ Status shows as '{status}', expected 'active'")
                else:
                    print(f"   ❌ Status field missing")
                    
        else:
            print(f"❌ Request failed: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("🚀 Testing Nara Status Fix")
    print("=" * 50)
    
    # Test creation
    test_external_schedule_creation()
    
    # Test listing
    test_schedules_list()
    
    print("\n✅ Test completed")