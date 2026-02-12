"""Browser setup and utility functions"""
import time
import random
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.support.ui import WebDriverWait


# Load delay configuration from environment
try:
    MIN_DELAY = float(os.getenv('MIN_DELAY', '0.5'))
    MAX_DELAY = float(os.getenv('MAX_DELAY', '1.0'))
except:
    MIN_DELAY = 0.5
    MAX_DELAY = 1.0


def create_driver():
    """Create and configure Chrome driver with anti-detection"""
    options = webdriver.ChromeOptions()
    
    # Anti-detection: Hide automation flags
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    # Stealth mode
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-gpu')
    
    # Random user agent (rotate for better stealth)
    user_agents = [
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    ]
    selected_ua = random.choice(user_agents)
    options.add_argument(f'user-agent={selected_ua}')
    
    # Window size (real user behavior)
    options.add_argument('--window-size=1920,1080')
    options.add_argument('--start-maximized')
    
    # Language
    options.add_argument('--lang=en-US')
    options.add_experimental_option('prefs', {'intl.accept_languages': 'en-US,en'})
    
    # Disable images for faster loading (optional, comment if needed)
    # prefs = {"profile.managed_default_content_settings.images": 2}
    # options.add_experimental_option("prefs", prefs)
    
    # Try multiple methods to create driver
    driver = None
    
    # Method 1: Selenium 4.6+ auto-download (recommended)
    try:
        from selenium.webdriver.chrome.service import Service as ChromeService
        service = ChromeService()
        driver = webdriver.Chrome(service=service, options=options)
        print("✓ Using Selenium auto-managed ChromeDriver")
    except Exception as e:
        print(f"⚠ Selenium auto-download failed: {e}")
        
        # Method 2: webdriver-manager
        try:
            print("  Trying webdriver-manager...")
            from webdriver_manager.chrome import ChromeDriverManager
            from webdriver_manager.core.os_manager import ChromeType
            
            # Clear cache to force fresh download
            import os
            cache_path = os.path.expanduser("~/.wdm")
            if os.path.exists(cache_path):
                print(f"  Clearing webdriver-manager cache: {cache_path}")
                import shutil
                shutil.rmtree(cache_path, ignore_errors=True)
            
            # Install chromedriver
            driver_path = ChromeDriverManager().install()
            print(f"  ChromeDriver installed at: {driver_path}")
            
            service = ChromeService(executable_path=driver_path)
            driver = webdriver.Chrome(service=service, options=options)
            print("✓ Using webdriver-manager ChromeDriver")
            
        except ImportError:
            print("✗ webdriver-manager not installed!")
            print("\nInstall it with:")
            print("  pip install webdriver-manager")
            raise
        except Exception as e2:
            print(f"✗ webdriver-manager failed: {e2}")
            
            # Method 3: System chromedriver
            try:
                print("  Trying system chromedriver...")
                import subprocess
                result = subprocess.run(['which', 'chromedriver'], 
                                      capture_output=True, text=True)
                if result.returncode == 0:
                    chromedriver_path = result.stdout.strip()
                    print(f"  Found system chromedriver: {chromedriver_path}")
                    service = ChromeService(executable_path=chromedriver_path)
                    driver = webdriver.Chrome(service=service, options=options)
                    print("✓ Using system ChromeDriver")
                else:
                    raise Exception("System chromedriver not found")
            except Exception as e3:
                print(f"✗ System chromedriver failed: {e3}")
                print("\n" + "="*60)
                print("CHROMEDRIVER INSTALLATION REQUIRED")
                print("="*60)
                print("\nOption 1: Install Chrome + ChromeDriver (Recommended)")
                print("  ./install_chrome.sh")
                print("\nOption 2: Install webdriver-manager")
                print("  pip install webdriver-manager")
                print("\nOption 3: Manual ChromeDriver")
                print("  sudo apt install chromium-chromedriver")
                print("="*60)
                raise Exception("Failed to create ChromeDriver. See options above.")
    
    if driver is None:
        raise Exception("Failed to create ChromeDriver")
    
    # Advanced anti-detection scripts
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    
    # Override navigator properties
    driver.execute_cdp_cmd('Network.setUserAgentOverride', {
        "userAgent": 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    
    # Stealth scripts
    driver.execute_script("""
        // Override plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });
        
        // Override languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });
        
        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
        
        // Chrome runtime
        window.chrome = {
            runtime: {}
        };
    """)
    
    return driver


def human_delay(min_sec=None, max_sec=None):
    """Random delay to mimic human behavior"""
    if min_sec is None:
        min_sec = MIN_DELAY
    if max_sec is None:
        max_sec = MAX_DELAY
    delay = random.uniform(min_sec, max_sec)
    time.sleep(delay)


def random_mouse_movement(driver):
    """Simulate random mouse movements"""
    try:
        from selenium.webdriver.common.action_chains import ActionChains
        actions = ActionChains(driver)
        
        # Random small movements
        for _ in range(random.randint(2, 4)):
            x_offset = random.randint(-100, 100)
            y_offset = random.randint(-100, 100)
            actions.move_by_offset(x_offset, y_offset)
        
        actions.perform()
    except:
        pass  # Ignore if fails


def smooth_scroll(driver, element):
    """Smooth scroll to element"""
    driver.execute_script(
        "arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});",
        element
    )
    time.sleep(random.uniform(0.3, 0.6))


def scroll_page_to_load(driver):
    """Scroll entire page to load all lazy-loaded content with human-like behavior"""
    print("Scrolling page to load all content...")
    
    # Get page height
    last_height = driver.execute_script("return document.body.scrollHeight")
    
    # Scroll down in random increments (human-like)
    scroll_pause_time = random.uniform(0.8, 1.2)  # Increased
    
    for i in range(5):  # Increased back to 5
        # Random scroll amount (not always same)
        scroll_amount = random.randint(1000, 1500)
        driver.execute_script(f"window.scrollBy(0, {scroll_amount});")
        
        # Random pause (human behavior)
        time.sleep(random.uniform(0.5, 0.8))  # Increased
        
        # Sometimes scroll up a bit (human behavior) - reduced frequency
        if random.random() > 0.85:
            driver.execute_script(f"window.scrollBy(0, -{random.randint(100, 300)});")
            time.sleep(random.uniform(0.3, 0.5))
    
    # Scroll to bottom
    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    time.sleep(scroll_pause_time)
    
    # Check if new content loaded
    new_height = driver.execute_script("return document.body.scrollHeight")
    if new_height > last_height:
        # More content loaded, scroll again
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(scroll_pause_time)
    
    # Scroll back to top (human behavior)
    driver.execute_script("window.scrollTo(0, 0);")
    time.sleep(random.uniform(0.5, 0.8))
