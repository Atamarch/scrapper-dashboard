"""LinkedIn authentication helper"""
import os
import json
from pathlib import Path
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from dotenv import load_dotenv
from helper.browser_helper import human_delay


COOKIES_FILE = "data/cookie/.linkedin_cookies.json"


def save_cookies(driver):
    """Save cookies to JSON file for session persistence"""
    try:
        Path("data/cookie").mkdir(parents=True, exist_ok=True)
        cookies = driver.get_cookies()
        with open(COOKIES_FILE, 'w') as f:
            json.dump(cookies, f, indent=2)
        print("✓ Cookies saved for future sessions")
    except Exception as e:
        print(f"⚠ Could not save cookies: {e}")


def load_cookies(driver):
    """Load cookies from JSON file"""
    try:
        if not os.path.exists(COOKIES_FILE):
            return False
        
        driver.get('https://www.linkedin.com')
        human_delay(2, 3)  # Increased back
        
        with open(COOKIES_FILE, 'r') as f:
            cookies = json.load(f)
        
        for cookie in cookies:
            try:
                driver.add_cookie(cookie)
            except:
                pass
        
        # Refresh to apply cookies
        driver.refresh()
        human_delay(2, 3)  # Increased back
        
        # Check if logged in
        current_url = driver.current_url
        if 'feed' in current_url or 'mynetwork' in current_url:
            print("✓ Logged in using saved session!")
            return True
        
        return False
    except Exception as e:
        print(f"⚠ Could not load cookies: {e}")
        return False


def login(driver):
    """Login to LinkedIn with automatic verification detection"""
    load_dotenv()
    
    # Try to use saved cookies first
    print("Checking for saved session...")
    if load_cookies(driver):
        return
    
    # No saved session, do normal login
    email = os.getenv('LINKEDIN_EMAIL')
    password = os.getenv('LINKEDIN_PASSWORD')
    
    if not email or not password:
        raise ValueError("LinkedIn credentials not found in .env file")
    
    print("Attempting automatic login...")
    driver.get('https://www.linkedin.com/login')
    human_delay(2, 3)
    
    try:
        wait = WebDriverWait(driver, 10)
        
        print("Filling email...")
        email_field = wait.until(EC.presence_of_element_located((By.ID, 'username')))
        email_field.clear()
        email_field.send_keys(email)
        human_delay(0.5, 1.0)
        
        print("Filling password...")
        password_field = driver.find_element(By.ID, 'password')
        password_field.clear()
        password_field.send_keys(password)
        human_delay(0.5, 1.0)
        
        print("Clicking login button...")
        login_button = driver.find_element(By.XPATH, "//button[@type='submit']")
        login_button.click()
        
        print("Checking login status...")
        human_delay(3, 5)
        
        current_url = driver.current_url
        
        # Check for verification
        verification_indicators = [
            'checkpoint/challenge',
            'challenge',
            'verify',
            'captcha',
            '/uas/login-submit',
            'phone',  # Phone verification
        ]
        
        needs_verification = any(indicator in current_url for indicator in verification_indicators)
        
        if needs_verification:
            print("\n" + "="*60)
            print("⚠ VERIFICATION REQUIRED!")
            print("="*60)
            
            # Detect type of verification
            page_text = driver.page_source.lower()
            if 'phone' in page_text or 'number' in page_text:
                print("Type: PHONE VERIFICATION")
                print("LinkedIn meminta verifikasi nomor telepon.")
            elif 'captcha' in page_text or 'puzzle' in page_text:
                print("Type: CAPTCHA/PUZZLE")
            elif 'pin' in page_text or 'code' in page_text:
                print("Type: PIN/CODE (check your email)")
            else:
                print("Type: SECURITY CHECK")
            
            print("\nSilakan selesaikan verifikasi di browser:")
            print("  - Masukkan nomor telepon (jika diminta)")
            print("  - Selesaikan CAPTCHA/Puzzle")
            print("  - Masukkan PIN dari email")
            print("\nSetelah berhasil login dan masuk ke feed/homepage,")
            print("kembali ke terminal dan tekan ENTER untuk lanjut scraping")
            print("="*60 + "\n")
            
            input("Tekan ENTER setelah verifikasi selesai dan Anda sudah login...")
            
            current_url = driver.current_url
            if 'feed' in current_url or 'mynetwork' in current_url or '/in/' in current_url:
                print("✓ Login berhasil!")
                # Save cookies for next time
                save_cookies(driver)
            else:
                print("⚠ Warning: Sepertinya belum berhasil login.")
                retry = input("Lanjutkan scraping? (y/n): ")
                if retry.lower() != 'y':
                    raise Exception("Login dibatalkan")
        else:
            if 'feed' in current_url or 'mynetwork' in current_url or '/in/' in current_url:
                print("✓ Login otomatis berhasil tanpa verifikasi!")
                # Save cookies for next time
                save_cookies(driver)
            else:
                print(f"⚠ Login status tidak jelas. Current URL: {current_url}")
                input("Tekan ENTER jika sudah login di browser...")
                save_cookies(driver)
    
    except Exception as e:
        print(f"\nError during login: {e}")
        import traceback
        traceback.print_exc()
        print("\nSilakan login manual di browser yang terbuka...")
        input("Tekan ENTER setelah berhasil login...")
        save_cookies(driver)
