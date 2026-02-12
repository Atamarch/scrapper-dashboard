# LinkedIn Profile Scraper

Scraper LinkedIn profiles dengan RabbitMQ queue system.

## Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Setup .env
```bash
cp .env.example .env
```
Edit `.env` dan isi credentials LinkedIn lu.

### 3. Start RabbitMQ
```bash
docker-compose up -d
```

## Usage

### Multiple URLs (Recommended - Auto dari JSON)
```bash
python multiple.py
```

**Cara kerja:**
1. Auto-load URLs dari semua file `profile/*.json`
2. Skip URLs yang ada kata "sales"
3. Process dengan 3 workers (default)
4. Output ke `data/output/`

**Format JSON di folder profile:**
```json
[
  {
    "name": "John Doe",
    "profile_url": "https://www.linkedin.com/in/johndoe"
  },
  {
    "name": "Jane Doe",
    "profile_url": "https://www.linkedin.com/in/janedoe"
  }
]
```

### Simple Mode (Manual Input)
```bash
python main.py
```
Input URLs manual, tunggu selesai.

## Monitoring

RabbitMQ Management UI: http://localhost:15672
- Login: `guest` / `guest`

## Output

JSON files di folder: `data/output/`

## Data Structure

```json
{
  "profile_url": "...",
  "name": "...",
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

## Files

- `multiple.py` - **Main file** (auto-load dari JSON, 3 workers)
- `main.py` - Simple mode (manual input)
- `crawler.py` - Scraper logic
- `helper/` - Helper functions
- `profile/` - **Put your JSON files here**
