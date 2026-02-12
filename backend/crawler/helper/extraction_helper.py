"""Helper functions for data extraction with show all flow"""
from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchElementException
from helper.browser_helper import human_delay, smooth_scroll


def click_show_all(driver, section):
    """Click 'Show all' link in section"""
    try:
        smooth_scroll(driver, section)
        human_delay(0.5, 0.8)
        
        # Find "Show all X items" link
        selectors = [
            ".//a[contains(text(), 'Show all')]",
            ".//a[contains(., 'Show all')]",
            ".//div[contains(@class, 'pvs-list__footer')]//a",
        ]
        
        for selector in selectors:
            try:
                button = section.find_element(By.XPATH, selector)
                button_text = button.text.strip()
                print(f"  Found: '{button_text}'")
                
                # Click
                driver.execute_script("arguments[0].click();", button)
                print("  ✓ Clicked 'Show all'")
                
                # Wait for page to load
                human_delay(2, 2.5)  # Increased for better page load
                return True
            except NoSuchElementException:
                continue
        
        print("  ⚠ No 'Show all' button found")
        return False
    except Exception as e:
        print(f"  Error clicking show all: {e}")
        return False


def click_back_arrow(driver):
    """Click back arrow button on detail page"""
    try:
        # Back arrow is usually at top left
        back_selectors = [
            "//button[@aria-label='Back']",
            "//button[contains(@class, 'app-aware-link')]//li-icon[@type='arrow-left']",
            "//button[.//li-icon[@type='arrow-left']]",
            "//a[@aria-label='Back']",
        ]
        
        for selector in back_selectors:
            try:
                back_button = driver.find_element(By.XPATH, selector)
                print("  Found back button")
                driver.execute_script("arguments[0].click();", back_button)
                print("  ✓ Clicked back")
                human_delay(1.5, 2)  # Increased for page transition
                return True
            except NoSuchElementException:
                continue
        
        # Fallback: browser back
        print("  Using browser back()")
        driver.back()
        human_delay(1.5, 2)
        return True
    except Exception as e:
        print(f"  Error clicking back: {e}")
        return False


def extract_items_from_detail_page(driver):
    """Extract list items from detail page (after show all)"""
    items = []
    
    # Wait for detail page to fully load
    print("  Waiting for detail page to load...")
    human_delay(2, 2.5)  # Increased even more
    
    # Aggressive scrolling to load ALL lazy content
    print("  Scrolling to load all items...")
    last_count = 0
    no_change_count = 0
    max_scrolls = 20  # Increased even more
    
    for i in range(max_scrolls):
        # Scroll down
        driver.execute_script("window.scrollBy(0, 1500);")
        human_delay(1, 1.5)  # Increased for better loading
        
        # Count current items
        current_items = driver.find_elements(By.XPATH, "//main//ul[contains(@class, 'pvs-list')]/li")
        current_count = len(current_items)
        
        print(f"    Scroll {i + 1}/{max_scrolls}: {current_count} items")
        
        if current_count == last_count:
            no_change_count += 1
            # If no change for 4 consecutive scrolls, we're done
            if no_change_count >= 4:
                print(f"    No new items after 4 scrolls, stopping")
                break
        else:
            no_change_count = 0
        
        last_count = current_count
        
        # Also check if we reached bottom
        at_bottom = driver.execute_script(
            "return (window.innerHeight + window.scrollY) >= document.body.scrollHeight - 100;"
        )
        if at_bottom and no_change_count >= 2:
            print(f"    Reached bottom of page")
            break
    
    print(f"  Final item count after scrolling: {last_count}")
    
    # Scroll back to top
    print("  Scrolling back to top...")
    driver.execute_script("window.scrollTo(0, 0);")
    human_delay(1, 1.5)
    
    # Scroll down a bit to middle
    driver.execute_script("window.scrollTo(0, document.body.scrollHeight / 2);")
    human_delay(0.8, 1)
    
    # Get items - try multiple selectors
    selectors = [
        "//main//ul[contains(@class, 'pvs-list')]/li[contains(@class, 'pvs-list__paged-list-item')]",
        "//main//ul[contains(@class, 'pvs-list')]/li",
        "//div[contains(@class, 'scaffold-finite-scroll__content')]//ul/li",
        "//main//ul/li[contains(@class, 'artdeco-list__item')]",
    ]
    
    for selector in selectors:
        items = driver.find_elements(By.XPATH, selector)
        if items and len(items) > 0:
            print(f"  ✓ Found {len(items)} items using selector")
            break
    
    if not items:
        print("  ⚠ No items found on detail page!")
    
    return items
