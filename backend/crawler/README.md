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
└── data/
    ├── cookie/            # LinkedIn session cookies
    └── output/            # Scraped profiles (JSON)
```

## Features

- **All-in-one design**: No helper folders, just 2 files
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
# Edit .env with your credentials
```

3. Start RabbitMQ:
```bash
docker-compose up -d
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

The daemon:
1. Checks for active schedules every 5 minutes (default)
2. Executes schedules that haven't run in the last hour
3. Scrapes all profile URLs in the schedule
4. Saves results to Supabase `leads_list` table with:
   - `profile_url`: LinkedIn profile URL
   - `name`: Extracted from profile data
   - `profile_data`: Full JSON profile data
   - `connection_status`: Set to 'scraped'
   - `date`: Current date

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

### Direct Import
Use crawler directly in your code:

```python
from crawler import LinkedInCrawler

crawler = LinkedInCrawler()
crawler.login()
profile_data = crawler.get_profile("https://linkedin.com/in/username")
crawler.close()
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

# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASS=guest
RABBITMQ_QUEUE=linkedin_profiles

# Scoring
SCORING_QUEUE=scoring_queue
DEFAULT_REQUIREMENTS_ID=desk_collection

# Scheduler Daemon
POLL_INTERVAL=300  # Check for schedules every 5 minutes
```

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

**scheduler_daemon.py** contains:
- Supabase schedule polling
- Scheduled job execution
- Direct `leads_list` table integration
- Automatic last_run tracking

## Monitoring

RabbitMQ Management UI: http://localhost:15672
- Login: `guest` / `guest`

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
- Check debug screenshots in `data/output/outreach_screenshots/debug_no_connect_*.png`
- Review HTML page source saved alongside screenshots for detailed inspection
- LinkedIn UI may have changed - verify button exists on profile page
- Ensure profile is not already connected (system now double-checks for "Message" button)
- Page automatically scrolls to top and waits 20 seconds for content to load
- Check console logs for which selectors were attempted and their results

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
1. Ensure RabbitMQ is running: `docker-compose up -d`
2. Edit `test_outreach.py` to customize the test job:
   - `name`: Lead's name for personalization
   - `profile_url`: LinkedIn profile URL
   - `message`: Connection request message template
   - `dry_run`: Set to `True` for testing (no real send), `False` for production

**Configuration in `.env`:**
```bash
OUTREACH_QUEUE=outreach_queue  # Queue name for outreach jobs
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

**Recent Improvements (Latest):**
- Enhanced Connect button detection with 6 optimized selectors for better reliability
- Improved page load handling with explicit wait for main content (20 seconds timeout)
- Auto-scroll to top before button detection to ensure visibility
- Better "already connected" detection with double-check for Message button
- Debug artifacts: Screenshots + HTML page source saved when Connect button not found
- Detailed progress logging with selector preview and error messages
- Filters for visible and enabled buttons only to avoid false positives
- Production-ready: Worker now supports both dry-run testing and live connection requests based on job payload

**Production Mode:**
The outreach worker is now production-ready. Control the behavior using the `dry_run` flag in each job:
- `dry_run: true` - Test mode: Types message but doesn't send (for verification)
- `dry_run: false` - Production mode: Sends actual connection requests

**Safety Features:**
- Rate limiting: Fixed 3-minute delay between all connection requests (both testing and production modes)
- Screenshot capture for every attempt (success or failure)
- Detailed logging for debugging and audit trails
- Graceful error handling with no automatic retries to prevent spam

## Notes

- First 10 profiles are usually accurate
- Browser restart prevents memory leak after that
- Mobile mode = simpler HTML, no "See all" buttons
- Desktop mode = full features, more data
