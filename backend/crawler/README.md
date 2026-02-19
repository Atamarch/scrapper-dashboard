# LinkedIn Profile Crawler

Simplified crawler with only 2 main files.

## File Structure

```
crawler/
├── crawler.py              # Main crawler class + all helper functions
├── crawler_consumer.py     # RabbitMQ consumer + utilities
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

## Notes

- First 10 profiles are usually accurate
- Browser restart prevents memory leak after that
- Mobile mode = simpler HTML, no "See all" buttons
- Desktop mode = full features, more data
