# LinkedIn Profile Crawler

Simplified crawler with only 2 main files

## File Structure

```
crawler/
├── crawler.py              # Main crawler class + all helper functions
├── crawler_consumer.py     # RabbitMQ consumer + utilities
├── scheduler_daemon.py     # Scheduled crawl job executor
├── .env                    # Configuration
├── requirements.txt        # Dependencies
├── helper/
│   ├── supabase_helper.py # Supabase integration for storing leads
│   └── rabbitmq_helper.py # RabbitMQ queue management
└── data/
    ├── cookie/            # LinkedIn session cookies
    └── output/            # Scraped profiles (JSON)
```

## Features

- **All-in-one design**: Core crawler with modular helpers
- **Supabase integration**: Direct storage to `leads_list` table with duplicate prevention
- **Browser restart**: Prevents memory leak every N profiles
- **Mobile/Desktop mode**: Choose scraping mode
- **Anti-detection**: Random delays, human-like scrolling
- **Cookie persistence**: Login once, reuse session
- **Duplicate prevention**: Skip already crawled profiles
- **RabbitMQ integration**: Queue-based processing
- **Scoring integration**: Auto-send to scoring queue

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure `.env`:
```bash
cp .env.example .env
# Edit .env with your LavinMQ credentials
# See LAVINMQ-SETUP.md for detailed setup guide
```

3. Test LavinMQ connection:
```bash
cd ../..
python test-lavinmq.py
```

## Usage

### Scheduler Daemon (Production)
Run scheduled crawl jobs from Supabase:

```bash
python scheduler_daemon.py
```

Features:
- Polls Supabase for active schedules
- Executes crawl jobs based on schedule timing
- Saves profiles directly to `leads_list` table
- Updates `last_run` timestamp automatically
- Configurable poll interval via `POLL_INTERVAL` env var
- **Smart profile sourcing with fallback priority**
- **Duplicate detection and skip logic**
- **Update existing leads instead of creating duplicates**

The daemon uses a priority-based approach to find profiles to scrape:

**Priority 1: JSON File (if linked)**
- If schedule has a `file_id`, loads profile URLs from the linked JSON file in `crawler_jobs` table
- Extracts URLs from the JSON data structure

**Priority 2: Unscraped Profiles from Supabase**
- If no JSON file is linked, automatically queries `leads_list` table for unscraped profiles
- Finds profiles where `profile_data` is null or empty
- Limits to 100 profiles per execution (configurable)
- Enables continuous scraping of new leads added to the database

**Duplicate Prevention:**
- Before scraping, checks if profile already has `profile_data` in database
- Skips profiles that are already scraped (non-empty `profile_data`)
- Updates existing leads instead of creating duplicates
- Tracks skipped count in execution statistics

The daemon workflow:
1. Checks for active schedules every 5 minutes (default)
2. Executes schedules that haven't run in the last hour
3. Sources profile URLs using priority system (JSON file → Unscraped profiles)
4. For each profile URL:
   - Checks if already scraped (has `profile_data`)
   - Skips if already scraped
   - Scrapes profile if not yet scraped
   - Updates existing lead or inserts new lead
5. Saves results to Supabase `leads_list` table with:
   - `profile_url`: LinkedIn profile URL
   - `name`: Extracted from profile data
   - `profile_data`: Full JSON profile data
   - `connection_status`: Set to 'scraped'
   - `date`: Current date (for new leads only)
6. Reports statistics: Success count, Skipped count, Failed count

### Consumer Mode (Recommended)
Process URLs from `profile/*.json` files with RabbitMQ:

```bash
python crawler_consumer.py
```

Features:
- Auto-load URLs from profile folder
- Skip already crawled profiles
- Skip sales URLs
- Multi-worker processing
- Send to scoring queue
- Supabase integration (automatic save to `leads_list` table)

### Direct Import
Use crawler directly in your code:

```python
from crawler import LinkedInCrawler
from helper.supabase_helper import SupabaseManager

# Initialize
crawler = LinkedInCrawler()
supabase = SupabaseManager()

# Login and scrape
crawler.login()
profile_data = crawler.get_profile("https://linkedin.com/in/username")

# Save to Supabase
supabase.save_lead(
    profile_url=profile_data['profile_url'],
    name=profile_data['name'],
    profile_data=profile_data,
    connection_status='scraped'
)

crawler.close()
```

## Supabase Helper

The `SupabaseManager` class provides methods for storing and managing leads:

### Methods

**`save_lead(profile_url, name, profile_data, connection_status='scraped', template_id=None)`**
- Saves or updates a lead in the `leads_list` table
- Automatically handles duplicates (updates existing, inserts new)
- Stores complete profile data in JSONB column
- Optional `template_id` parameter for filtering leads by requirement template
- Returns: `bool` (success status)

**`update_connection_status(profile_url, status)`**
- Updates the connection status for a lead
- Common statuses: `scraped`, `connection_sent`, `message_sent`, `connected`
- Returns: `bool` (success status)

**`lead_exists(profile_url)`**
- Checks if a lead already exists in the database
- Returns: `bool`

**`get_lead(profile_url)`**
- Retrieves complete lead data from database
- Returns: `dict` or `None`

### Usage Example

```python
from helper.supabase_helper import SupabaseManager

supabase = SupabaseManager()

# Check if lead exists
if not supabase.lead_exists("https://linkedin.com/in/username"):
    # Save new lead with optional template_id
    supabase.save_lead(
        profile_url="https://linkedin.com/in/username",
        name="John Doe",
        profile_data={...},
        connection_status='scraped',
        template_id='abc-123-def'  # Optional: link to requirement template
    )

# Update status after sending connection
supabase.update_connection_status(
    profile_url="https://linkedin.com/in/username",
    status='connection_sent'
)

# Retrieve lead data
lead = supabase.get_lead("https://linkedin.com/in/username")
if lead:
    print(f"Lead: {lead['name']}, Status: {lead['connection_status']}")
    if lead.get('template_id'):
        print(f"Template: {lead['template_id']}")
```

## Configuration

Edit `.env` file:

```bash
# LinkedIn Credentials (for email/password login)
LINKEDIN_EMAIL=your@email.com
LINKEDIN_PASSWORD=yourpassword

# OAuth Login (for Google/Microsoft/Apple login)
USE_OAUTH_LOGIN=false  # Set to true if using OAuth

# Delays (seconds)
MIN_DELAY=2.0
MAX_DELAY=5.0
PROFILE_DELAY_MIN=10.0
PROFILE_DELAY_MAX=20.0

# Mode
USE_MOBILE_MODE=false

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# RabbitMQ - Option 1: CloudAMQP URL (recommended for cloud deployments)
CLOUDAMQP_URL=amqps://user:pass@host.lmq.cloudamqp.com/vhost

# RabbitMQ - Option 2: Individual settings (for local/custom setups)
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASS=guest
RABBITMQ_VHOST=/
RABBITMQ_QUEUE=linkedin_profiles

# SSL/TLS Support
# Port 5671 automatically enables SSL/TLS connection
# Port 5672 uses standard non-encrypted connection

# Scoring
SCORING_QUEUE=scoring_queue
DEFAULT_REQUIREMENTS_ID=desk_collection

# Scheduler Daemon
POLL_INTERVAL=300  # Check for schedules every 5 minutes
```

### RabbitMQ Configuration Options

The crawler supports two ways to configure RabbitMQ:

**Option 1: CloudAMQP URL (Recommended for Cloud)**
```bash
CLOUDAMQP_URL=amqps://username:password@host.lmq.cloudamqp.com/vhost
```
- Automatically parses connection details from URL
- Supports both `amqp://` (plain) and `amqps://` (SSL/TLS)
- SSL is auto-enabled for `amqps://` URLs
- Perfect for LavinMQ, CloudAMQP, or other managed services

**Option 2: Individual Environment Variables**
```bash
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASS=guest
RABBITMQ_VHOST=/
```
- Use for local RabbitMQ instances
- SSL auto-enabled if port is 5671
- Falls back to this if `CLOUDAMQP_URL` is not set

### OAuth Login Setup

Jika akun LinkedIn Anda menggunakan OAuth (Google/Microsoft/Apple):

1. Set di `.env`:
```bash
LINKEDIN_EMAIL=
LINKEDIN_PASSWORD=
USE_OAUTH_LOGIN=true
```

2. Jalankan crawler:
```bash
python crawler_consumer.py
```

3. Browser akan terbuka, login manual dengan OAuth
4. Cookie tersimpan otomatis di `data/cookie/.linkedin_cookies.json`
5. Login berikutnya otomatis menggunakan cookie

**Lihat panduan lengkap**: [OAUTH_LOGIN.md](OAUTH_LOGIN.md)

### Cookie Management

Kelola cookie dengan script helper:

```bash
# Interactive menu
python manage_cookies.py

# Or direct commands
python manage_cookies.py check    # Check cookie status
python manage_cookies.py backup   # Backup cookies
python manage_cookies.py restore  # Restore from backup
python manage_cookies.py delete   # Delete cookies
```

## How It Works

**crawler.py** contains:
- `LinkedInCrawler` class
- Browser helper functions (create_driver, delays, scrolling)
- Auth helper functions (login, cookies)
- Extraction helper functions (show all, navigation)

**crawler_consumer.py** contains:
- `RabbitMQManager` class
- Consumer worker threads
- Profile save utilities
- Scoring integration
- Supabase integration (automatic save to database)

**scheduler_daemon.py** contains:
- Supabase schedule polling
- Scheduled job execution
- Direct `leads_list` table integration
- Automatic last_run tracking
- **Intelligent profile sourcing with priority fallback**
- **Duplicate detection and prevention**
- **Automatic unscraped profile discovery**

## Monitoring

RabbitMQ Management UI: http://localhost:15672
- Login: `guest` / `guest`

## Consumer Mode Statistics

The crawler consumer tracks the following metrics:
- `processing`: Currently processing profiles
- `completed`: Successfully scraped profiles
- `failed`: Failed scraping attempts
- `skipped`: Profiles skipped (already crawled or sales URLs)
- `sent_to_scoring`: Profiles sent to scoring queue
- `saved_to_supabase`: Profiles saved to Supabase database
- `supabase_failed`: Failed Supabase save attempts

Each worker automatically:
1. Connects to Supabase on startup (gracefully continues without it if connection fails)
2. Scrapes the LinkedIn profile
3. Saves profile data to local JSON file (`data/output/`)
4. Saves profile data to Supabase `leads_list` table with:
   - `profile_url`: LinkedIn profile URL
   - `name`: Extracted from profile data
   - `profile_data`: Complete JSON profile data
   - `connection_status`: Set to 'scraped'
5. Sends profile data to scoring queue for processing

If Supabase connection fails, the worker continues operating and saves data locally only.

## Output

JSON files saved to: `data/output/`

Example structure:
```json
{
  "profile_url": "...",
  "name": "...",
  "location": "...",
  "gender": "...",
  "estimated_age": {...},
  "about": "...",
  "experiences": [...],
  "education": [...],
  "skills": [...],
  "projects": [...],
  "honors": [...],
  "languages": [...],
  "licenses": [...],
  "courses": [...],
  "volunteering": [...],
  "test_scores": [...]
}
```

## Docker Testing

Test the Docker build locally before deploying to production:

```bash
./test-docker.sh
```

This script will:
- Build the Docker image locally
- Validate the build process
- Start a test container with your `.env` configuration
- Stream container logs for monitoring
- Automatically cleanup on exit

**Requirements:**
- Docker installed and running
- `.env` file with required credentials (LINKEDIN_EMAIL, LINKEDIN_PASSWORD, RABBITMQ_HOST, etc.)

**Note:** First build downloads Chrome (~500MB) and may take 5-10 minutes.

## Troubleshooting

**RabbitMQ SSL Connection:**
- Port 5671 automatically enables SSL/TLS encryption
- Port 5672 uses standard non-encrypted connection
- SSL is auto-detected based on port number
- Connection logs show SSL status: `Connected to RabbitMQ at host:port (SSL: True/False)`
- For LavinMQ cloud instances, use port 5671 with SSL

**ChromeDriver not found:**
```bash
pip install webdriver-manager
```

**Login verification required:**
- Complete verification in browser
- Press ENTER in terminal after login
- Cookies will be saved for next time

**Memory leak / data becomes empty:**
- Browser restarts automatically every 10 profiles
- This prevents memory leak and keeps accuracy high

**Docker build fails:**
- Ensure Docker is running
- Check `.env` file exists with all required variables
- Try `docker system prune` to free up space

**Outreach: Connect button not found:**
- The system now automatically tries the More dropdown menu if direct Connect button is not found
- Check debug screenshots in `data/output/outreach_screenshots/debug_no_connect_*.png`
- Review HTML page source saved alongside screenshots for detailed inspection
- LinkedIn UI may have changed - verify button exists on profile page or in More menu
- Ensure profile is not already connected (system now double-checks for "Message" button)
- Page automatically scrolls to top and waits 20 seconds for content to load
- Check console logs for which selectors were attempted and their results
- The `find_connect_button()` function handles both direct buttons and dropdown menus automatically

## Outreach Testing

Test the automated outreach functionality before sending real connection requests:

```bash
python test_outreach.py
```

This script allows you to:
- Send test outreach jobs to the RabbitMQ queue
- Verify the outreach worker processes jobs correctly
- Test message personalization with `{lead_name}` placeholder
- Run in dry-run mode (no actual connection requests sent)

**Before running:**
1. Ensure LavinMQ is configured in `.env` (see LAVINMQ-SETUP.md)
2. Test connection: `python ../../test-lavinmq.py`
3. Edit `test_outreach.py` to customize the test job:
   - `name`: Lead's name for personalization
   - `profile_url`: LinkedIn profile URL
   - `message`: Connection request message template
   - `dry_run`: Set to `True` for testing (no real send), `False` for production

**Configuration in `.env`:**
```bash
OUTREACH_QUEUE=outreach_queue  # Queue name for outreach jobs

# Supabase Configuration (for outreach tracking)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
```

**After sending test job:**
```bash
python crawler_outreach.py  # Start the outreach worker to process the job
```

The worker will:
- Navigate to the profile
- Click Connect button (with improved selector detection)
- Add a personalized note
- Type the message with human-like behavior
- Take a screenshot for verification
- In dry-run mode: Close modal without sending
- In production mode: Send actual connection requests (controlled by `dry_run` flag in job payload)

**Recent Improvements (Latest - Feb 24, 2026):**
- **Refined Connect button detection logic**: Improved reliability and debugging for both direct and dropdown scenarios
  - **Profile header detection**: Added `pvs-sticky-header-profile-actions` selector for better header container identification
  - **Direct Connect button search**: Now only attempts if profile header is found, preventing unnecessary searches
  - **More button location validation**: Checks button Y-coordinate to ensure it's in top 1000px of page (prevents clicking wrong buttons in recommendations)
  - **Enhanced More button selectors**: Added profile-specific selectors targeting `pvs-sticky-header-profile-actions` area first
  - **Increased dropdown wait time**: Extended from 2 to 3 seconds for dropdown animation to complete
  - **Detailed progress logging**: Added numbered selector attempts (e.g., "Trying More selector 1/5...") for easier debugging
  - **Element count reporting**: Logs how many elements were found for each selector before filtering
  - **Aria-label preview**: Shows first 50 characters of aria-label when checking dropdown elements
  - **Improved error messages**: Each selector failure now logs with specific error details
- **Enhanced dropdown menu handling (Feb 2026)**: Significantly improved reliability when Connect button is in More dropdown
  - Explicit wait for dropdown menu to appear after clicking More button (with timeout handling)
  - Waits for `div[@role='menu']` or `artdeco-dropdown__content` elements to be present
  - Additional 1-second delay for dropdown animation to complete
  - Enhanced selectors targeting `div[@role='button']` elements within dropdown (LinkedIn's actual structure)
  - Multi-layered selector strategy with aria-label priority:
    - **Priority 1**: Aria-label matching (most specific) - `@aria-label` containing "Invite" and "connect"
    - **Priority 2**: Class-based with text verification - `artdeco-dropdown__item` with "Connect" text
    - **Priority 3**: Generic role-based fallback - `@role='button'` with "Connect" text
  - Dual verification: Checks both element text and aria-label attribute for "Connect" keyword
  - Handles both button and div-based dropdown items
- **Enhanced connection status detection (Feb 2026)**: Improved reliability for detecting already-connected profiles
  - Scoped search within profile header container only (prevents false positives from other page sections)
  - Uses multiple fallback selectors to locate profile header (`pv-top-card`, `artdeco-card`, `main//section[1]`)
  - Checks for Message button in header using relative XPath (`.//` prefix for scoped search)
  - Detects "Pending" status for connection requests already sent
  - Returns early with appropriate status (`already_connected` or `already_pending`) to prevent duplicate requests
  - Graceful error handling - continues if status check fails (with warning logged)
- **Scoped Connect button detection**: `find_connect_button()` now searches only within the profile header container to prevent false positives
  - Locates profile header using multiple fallback selectors (`pv-top-card`, `artdeco-card`, `main//section[1]`)
  - All button searches are scoped to header container using relative XPath (`.//` prefix)
  - Prevents clicking Connect buttons from other page sections (e.g., "People Also Viewed", activity feed)
  - Improved reliability by filtering out non-header Connect buttons
- **Smart Connect button detection with More dropdown fallback**: Intelligently searches for Connect button in multiple locations
  - First attempts direct Connect button with 3 optimized selectors (scoped to header)
  - If not found, automatically clicks More button and searches inside dropdown menu
  - Handles profiles where Connect is hidden in More actions menu
  - Filters for visible and enabled buttons only to avoid false positives
- Enhanced Connect button detection with improved error handling and try-except blocks
- Improved page load handling with explicit wait for main content (20 seconds timeout)
- Auto-scroll to top before button detection to ensure visibility
- Debug artifacts: Screenshots + HTML page source saved when Connect button not found
- Detailed progress logging with selector preview and error messages
- Production-ready: Worker now supports both dry-run testing and live connection requests based on job payload
- Supabase integration: Outreach worker now connects to Supabase for future tracking and analytics capabilities

**Production Mode:**
The outreach worker is now production-ready. Control the behavior using the `dry_run` flag in each job:
- `dry_run: true` - Test mode: Types message but doesn't send (for verification)
- `dry_run: false` - Production mode: Sends actual connection requests

**Supabase Integration:**
The outreach worker now connects to Supabase on startup:
- Automatically initializes Supabase connection using credentials from `.env`
- Gracefully handles connection failures - continues without Supabase if unavailable
- Logs connection status on startup for debugging
- Stores outreach results with detailed status tracking:
  - `sent` - Connection request successfully sent (production mode)
  - `dry_run_success` - Message typed but not sent (test mode) → saved as `test_run`
  - `already_connected` - Profile already connected → saved as `already_connected`
  - `failed` - Request failed (not saved to database)
- Saves complete job metadata including message template, job ID, timestamp, and result details
- Updates `leads_list` table with appropriate `connection_status` based on outcome

**Safety Features:**
- Rate limiting: Fixed 3-minute delay between all connection requests (both testing and production modes)
- Screenshot capture for every attempt (success or failure)
- Detailed logging for debugging and audit trails
- Graceful error handling with no automatic retries to prevent spam
- Smart status tracking prevents duplicate connection attempts

## Notes

- First 10 profiles are usually accurate
- Browser restart prevents memory leak after that
- Mobile mode = simpler HTML, no "See all" buttons
- Desktop mode = full features, more data

## Database Schema

### Supabase Table: `leads_list`

The crawler stores scraped profiles in the `leads_list` table with the following schema:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `profile_url` | TEXT | LinkedIn profile URL (unique) |
| `name` | TEXT | Lead's name extracted from profile |
| `profile_data` | JSONB | Complete scraped profile data as JSON |
| `connection_status` | TEXT | Status: `scraped`, `connection_sent`, `message_sent`, `connected` |
| `date` | DATE | Date when profile was scraped |
| `template_id` | UUID | Optional: Link to requirement template for filtering |
| `score` | NUMERIC | Optional: Scoring result (populated by scoring service) |
| `scored_at` | TIMESTAMP | Optional: When the profile was scored |

### Database Migration

If you're setting up a new Supabase instance or the `profile_data` column doesn't exist:

1. Open Supabase SQL Editor
2. Run the migration script:
   ```bash
   backend/crawler/add_profile_data_column.sql
   ```

The migration script:
- Checks if `profile_data` column exists before adding it
- Creates the column as JSONB type with default empty object
- Verifies the column was added successfully
- Safe to run multiple times (idempotent)

**Note:** The `profile_data` column stores the complete JSON output from the crawler, including all sections like experiences, education, skills, projects, etc.
