"""LinkedIn Automated Outreach - Connection Request with Note"""
import json
import os
import time
import random
import pika
from datetime import datetime
from dotenv import load_dotenv
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from helper.rabbitmq_helper import RabbitMQManager, ack_message, nack_message
from helper.supabase_helper import SupabaseManager
from helper.browser_helper import create_driver, human_delay
from helper.auth_helper import login

load_dotenv()

# Configuration
OUTREACH_QUEUE = os.getenv('OUTREACH_QUEUE', 'outreach_queue')


def type_like_human(element, text):
    """Type text character by character with human-like behavior"""
    print(f"  ⌨️  Typing message ({len(text)} chars)...")
    
    for i, char in enumerate(text):
        element.send_keys(char)
        
        # Variable typing speed
        if char == ' ':
            # Longer pause at spaces
            delay = random.uniform(0.1, 0.3)
        elif char in ',.!?':
            # Longer pause at punctuation
            delay = random.uniform(0.2, 0.5)
        else:
            # Normal typing speed
            delay = random.uniform(0.05, 0.15)
        
        time.sleep(delay)
        
        # Occasional typo simulation (5% chance)
        if random.random() < 0.05 and i < len(text) - 1:
            # Type wrong character
            wrong_char = random.choice('abcdefghijklmnopqrstuvwxyz')
            element.send_keys(wrong_char)
            time.sleep(random.uniform(0.1, 0.2))
            # Backspace to delete
            element.send_keys('\b')
            time.sleep(random.uniform(0.1, 0.2))
        
        # Progress indicator every 20 chars
        if (i + 1) % 20 == 0:
            print(f"    Progress: {i + 1}/{len(text)} chars")
    
    print(f"  ✓ Typing completed!")


def send_connection_request(driver, profile_url, lead_name, message_template, dry_run=True):
    """
    Navigate to profile, click Connect, add note, type message
    
    Args:
        driver: Selenium WebDriver
        profile_url: LinkedIn profile URL
        lead_name: Name of the lead (for personalization)
        message_template: Message template with {lead_name} placeholder
        dry_run: If True, don't click Send button (for testing)
    
    Returns:
        dict: Result with status and details
    """
    result = {
        'status': 'failed',
        'profile_url': profile_url,
        'lead_name': lead_name,
        'error': None,
        'screenshot': None
    }
    
    try:
        print(f"\n{'='*60}")
        print(f"🎯 Target: {lead_name}")
        print(f"🔗 URL: {profile_url}")
        print(f"{'='*60}\n")
        
        # Navigate to profile
        print("1️⃣  Opening profile...")
        driver.get(profile_url)
        human_delay(3, 5)
        
        # Scroll to top to ensure buttons are visible
        print("  Scrolling to top...")
        driver.execute_script("window.scrollTo(0, 0);")
        human_delay(1, 2)
        
        # Wait for page to fully load
        wait = WebDriverWait(driver, 20)
        
        # Wait for profile section to load
        try:
            wait.until(EC.presence_of_element_located((By.TAG_NAME, "main")))
        except:
            pass
        
        human_delay(2, 3)
        
        # Check if already connected
        page_source = driver.page_source.lower()
        if 'message' in page_source and 'pending' not in page_source:
            # Double check - look for Message button
            try:
                driver.find_element(By.XPATH, "//button[contains(., 'Message')]")
                print("  ⚠️  Already connected!")
                result['status'] = 'already_connected'
                result['error'] = 'Already connected'
                return result
            except:
                pass
        
        # Find and click Connect button
        print("2️⃣  Looking for Connect button...")
        
        # Try multiple selectors for Connect button
        connect_button = None
        selectors = [
            # Simple text match
            "//button[text()='Connect']",
            "//button[contains(text(), 'Connect')]",
            # With span
            "//button[.//span[text()='Connect']]",
            "//button[.//*[text()='Connect']]",
            # Aria label
            "//button[contains(@aria-label, 'Invite')]",
            # Class based
            "//button[contains(@class, 'artdeco-button--secondary') and contains(., 'Connect')]",
        ]
        
        for i, selector in enumerate(selectors):
            try:
                print(f"  Trying selector {i+1}/{len(selectors)}: {selector[:50]}...")
                buttons = driver.find_elements(By.XPATH, selector)
                if buttons:
                    # Filter visible buttons only
                    for btn in buttons:
                        if btn.is_displayed() and btn.is_enabled():
                            connect_button = btn
                            print(f"  ✓ Found Connect button with selector {i+1}")
                            break
                if connect_button:
                    break
            except Exception as e:
                print(f"  Selector {i+1} failed: {e}")
                continue
        
        if not connect_button:
            print("  ✗ Connect button not found!")
            print("  Taking screenshot for debugging...")
            try:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                screenshot_dir = 'data/output/outreach_screenshots'
                os.makedirs(screenshot_dir, exist_ok=True)
                screenshot_path = f"{screenshot_dir}/debug_no_connect_{timestamp}.png"
                driver.save_screenshot(screenshot_path)
                print(f"  📸 Debug screenshot: {screenshot_path}")
                result['screenshot'] = screenshot_path
                
                # Also save page source for debugging
                html_path = f"{screenshot_dir}/debug_page_source_{timestamp}.html"
                with open(html_path, 'w', encoding='utf-8') as f:
                    f.write(driver.page_source)
                print(f"  📄 Page source: {html_path}")
            except:
                pass
            result['error'] = 'Connect button not found'
            return result
        
        print("  ✓ Found Connect button")
        human_delay(1, 2)
        
        # Click Connect
        print("3️⃣  Clicking Connect...")
        connect_button.click()
        human_delay(2, 3)
        
        # Wait for modal to appear
        print("4️⃣  Waiting for 'Add a note' modal...")
        
        # Click "Add a note" button in the modal
        try:
            add_note_button = wait.until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(@aria-label, 'Add a note')]"))
            )
            print("  ✓ Found 'Add a note' button")
            human_delay(1, 2)
            add_note_button.click()
            human_delay(2, 3)
        except:
            print("  ⚠️  'Add a note' button not found, checking if note field is already visible...")
        
        # Find the note textarea
        print("5️⃣  Looking for note textarea...")
        note_field = None
        textarea_selectors = [
            "//textarea[@name='message']",
            "//textarea[@id='custom-message']",
            "//textarea[contains(@placeholder, 'Add a note')]",
            "//textarea[contains(@aria-label, 'Add a note')]",
        ]
        
        for selector in textarea_selectors:
            try:
                note_field = wait.until(
                    EC.presence_of_element_located((By.XPATH, selector))
                )
                break
            except:
                continue
        
        if not note_field:
            print("  ✗ Note textarea not found!")
            result['error'] = 'Note textarea not found'
            return result
        
        print("  ✓ Found note textarea")
        human_delay(1, 2)
        
        # Personalize message
        personalized_message = message_template.replace('{lead_name}', lead_name)
        
        # Check character limit (LinkedIn allows 300 chars)
        if len(personalized_message) > 300:
            print(f"  ⚠️  Message too long ({len(personalized_message)} chars), truncating to 300...")
            personalized_message = personalized_message[:297] + '...'
        
        print(f"6️⃣  Typing message...")
        print(f"  Message preview: {personalized_message[:50]}...")
        print(f"  Length: {len(personalized_message)} chars")
        
        # Click on textarea to focus
        note_field.click()
        human_delay(0.5, 1)
        
        # Type message like human
        type_like_human(note_field, personalized_message)
        
        human_delay(2, 3)
        
        # Take screenshot for verification
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        screenshot_dir = 'data/output/outreach_screenshots'
        os.makedirs(screenshot_dir, exist_ok=True)
        
        name_slug = lead_name.replace(' ', '_').lower()
        screenshot_path = f"{screenshot_dir}/{name_slug}_{timestamp}.png"
        driver.save_screenshot(screenshot_path)
        print(f"  📸 Screenshot saved: {screenshot_path}")
        
        result['screenshot'] = screenshot_path
        
        if dry_run:
            print("\n" + "="*60)
            print("🧪 DRY RUN MODE - NOT SENDING")
            print("="*60)
            print("Message typed successfully!")
            print("Screenshot saved for verification")
            print("Set dry_run=False to actually send")
            print("="*60 + "\n")
            
            result['status'] = 'dry_run_success'
            
            # Close modal (click X or Cancel)
            try:
                close_button = driver.find_element(By.XPATH, "//button[@aria-label='Dismiss']")
                close_button.click()
                print("  ✓ Closed modal")
            except:
                try:
                    cancel_button = driver.find_element(By.XPATH, "//button[contains(., 'Cancel')]")
                    cancel_button.click()
                    print("  ✓ Cancelled connection request")
                except:
                    print("  ⚠️  Could not close modal, continuing...")
        else:
            # Find and click Send button
            print("7️⃣  Looking for Send button...")
            send_button = wait.until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(@aria-label, 'Send') or contains(., 'Send')]"))
            )
            
            print("  ✓ Found Send button")
            human_delay(1, 2)
            
            print("8️⃣  Clicking Send...")
            send_button.click()
            human_delay(2, 3)
            
            print("\n" + "="*60)
            print("✅ CONNECTION REQUEST SENT!")
            print("="*60 + "\n")
            
            result['status'] = 'sent'
        
        return result
    
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        
        result['error'] = str(e)
        
        # Try to take screenshot on error
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            screenshot_dir = 'data/output/outreach_screenshots'
            os.makedirs(screenshot_dir, exist_ok=True)
            screenshot_path = f"{screenshot_dir}/error_{timestamp}.png"
            driver.save_screenshot(screenshot_path)
            result['screenshot'] = screenshot_path
            print(f"  📸 Error screenshot: {screenshot_path}")
        except:
            pass
        
        return result


def process_outreach_job(message_data, dry_run=True):
    """Process a single outreach job"""
    driver = None
    
    try:
        # Parse message
        lead_name = message_data.get('name', 'Unknown')
        profile_url = message_data.get('profile_url')
        message_template = message_data.get('message')
        
        if not profile_url or not message_template:
            print("✗ Invalid job data: missing profile_url or message")
            return {'status': 'invalid', 'error': 'Missing required fields'}
        
        # Create browser
        print("🌐 Starting browser...")
        driver = create_driver(mobile_mode=False)
        
        # Login
        print("🔐 Logging in...")
        login(driver)
        
        # Send connection request
        result = send_connection_request(
            driver, 
            profile_url, 
            lead_name, 
            message_template,
            dry_run=dry_run
        )
        
        return result
    
    finally:
        if driver:
            print("🔒 Closing browser...")
            driver.quit()


def worker():
    """Worker that consumes from outreach_queue"""
    print("="*60)
    print("LINKEDIN AUTOMATED OUTREACH WORKER")
    print("="*60)
    print(f"Queue: {OUTREACH_QUEUE}")
    print("="*60 + "\n")
    
    # Connect to RabbitMQ
    mq = RabbitMQManager()
    mq.queue_name = OUTREACH_QUEUE
    
    if not mq.connect():
        print("✗ Failed to connect to RabbitMQ")
        return
    
    # Initialize Supabase
    try:
        supabase = SupabaseManager()
        print("✓ Connected to Supabase\n")
    except Exception as e:
        print(f"✗ Failed to connect to Supabase: {e}")
        print("  Make sure SUPABASE_URL and SUPABASE_KEY are set in .env")
        print("  Continuing without Supabase (data won't be saved)...\n")
        supabase = None
    
    # Set QoS - process 1 at a time
    mq.channel.basic_qos(prefetch_count=1)
    
    def callback(ch, method, properties, body):
        """Process each outreach job"""
        try:
            print("\n" + "="*60)
            print("📥 NEW JOB RECEIVED")
            print("="*60)
            
            # Parse message
            message_data = json.loads(body)
            
            # Get dry_run flag from message (default True for safety)
            dry_run = message_data.get('dry_run', True)
            
            print(f"Job ID: {message_data.get('job_id', 'N/A')}")
            print(f"Lead: {message_data.get('name', 'Unknown')}")
            print(f"URL: {message_data.get('profile_url', 'N/A')}")
            print(f"Mode: {'🧪 DRY RUN (testing)' if dry_run else '🔴 LIVE (real send)'}")
            print("="*60)
            
            # Process job
            result = process_outreach_job(message_data, dry_run=dry_run)
            
            # Save to Supabase if available
            if supabase and result['status'] in ['sent', 'dry_run_success', 'already_connected']:
                print("\n→ Saving to Supabase...")
                
                # Prepare profile data
                profile_data = {
                    'profile_url': message_data.get('profile_url'),
                    'name': message_data.get('name', 'Unknown'),
                    'message_template': message_data.get('message'),
                    'job_id': message_data.get('job_id'),
                    'dry_run': dry_run,
                    'timestamp': datetime.now().isoformat(),
                    'result': result
                }
                
                # Determine connection status based on result
                if result['status'] == 'already_connected':
                    connection_status = 'already_connected'
                elif result['status'] == 'dry_run_success':
                    connection_status = 'test_run'
                elif result['status'] == 'sent':
                    connection_status = 'connection_sent'
                else:
                    connection_status = 'failed'
                
                # Save to database
                if supabase.save_lead(
                    profile_url=message_data.get('profile_url'),
                    name=message_data.get('name', 'Unknown'),
                    profile_data=profile_data,
                    connection_status=connection_status
                ):
                    print("✓ Saved to database")
                else:
                    print("⚠ Failed to save to database")
            
            # Log result
            print("\n" + "="*60)
            print("📊 JOB RESULT")
            print("="*60)
            print(f"Status: {result['status']}")
            if result.get('error'):
                print(f"Error: {result['error']}")
            if result.get('screenshot'):
                print(f"Screenshot: {result['screenshot']}")
            print("="*60 + "\n")
            
            # Acknowledge message
            ack_message(ch, method.delivery_tag)
            
            # Rate limiting: wait before next job (3 minutes)
            delay = 180  # 3 minutes
            print(f"⏳ Waiting 3 minutes before next job (rate limiting)...")
            time.sleep(delay)
        
        except Exception as e:
            print(f"\n✗ Fatal error processing job: {e}")
            import traceback
            traceback.print_exc()
            
            # Don't requeue to avoid infinite loop
            nack_message(ch, method.delivery_tag, requeue=False)
    
    try:
        print("✓ Worker started, waiting for jobs...")
        print("  Press Ctrl+C to stop\n")
        
        mq.channel.basic_consume(
            queue=OUTREACH_QUEUE,
            on_message_callback=callback,
            auto_ack=False
        )
        
        mq.channel.start_consuming()
    
    except KeyboardInterrupt:
        print("\n\n⚠ Interrupted by user")
    
    finally:
        mq.close()
        print("✓ Worker stopped")


if __name__ == "__main__":
    worker()
