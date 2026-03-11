# LinkedIn Crawler & Scoring System

Project ini terdiri dari 3 komponen utama:
1. **Frontend** - Dashboard admin untuk monitoring crawler dan scheduler.
2. **Backend Crawler** - Scraping profil LinkedIn.
3. **Backend Scoring** - Sistem penilaian kandidat.

## 📋 Prerequisites

Pastikan sudah terinstal:
- **Node.js** (v18 atau lebih baru)
- **Python** (v3.8 atau lebih baru)
- **Docker & Docker Compose** (untuk RabbitMQ)
- **Chrome Browser** (untuk Selenium crawler)

## 🚀 Cara Menjalankan Project

⚠️ **PENTING:** Baca [SAFETY.md](SAFETY.md) untuk menghindari deteksi bot oleh LinkedIn!

### 1. Setup LavinMQ (Message Queue)

LavinMQ digunakan untuk komunikasi antara crawler dan scoring system.

**Opsi 1: Gunakan LavinMQ Cloud (Recommended)**

Lihat panduan lengkap di: [LAVINMQ-SETUP.md](LAVINMQ-SETUP.md)

1. Buat akun gratis di https://www.lavinmq.com
2. Buat instance baru (Free tier: unlimited messages)
3. Copy connection credentials
4. Update `.env` files di `backend/crawler/`, `backend/scoring/`, dan `backend/api/`

**Opsi 2: Gunakan Docker RabbitMQ Lokal (Development only)**

```bash
docker run -d --name rabbitmq \
  -p 5672:5672 -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=guest \
  -e RABBITMQ_DEFAULT_PASS=guest \
  rabbitmq:3-management

# Akses Management UI: http://localhost:15672
# Username: guest, Password: guest
```

### 2. Setup Backend - Crawler

```bash
# Masuk ke folder crawler
cd backend/crawler

# Buat virtual environment (opsional tapi direkomendasikan)
python -m venv venv

# Aktifkan virtual environment
# Linux/Mac:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Buat file .env (copy dari .env.example jika ada)
# Atau buat manual dengan isi:
cat > .env << EOF
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
CRAWLER_QUEUE=crawler_queue
SCORING_QUEUE=scoring_queue
EOF

# Jalankan crawler consumer (menunggu job dari queue)
python crawler_consumer.py

# Atau jalankan crawler langsung (untuk testing)
python main.py
```

### 3. Setup Backend - Scoring

Buka terminal baru:

```bash
# Masuk ke folder scoring
cd backend/scoring

# Buat virtual environment
python -m venv venv

# Aktifkan virtual environment
# Linux/Mac:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Buat file .env dengan Supabase credentials
cat > .env << EOF
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
SCORING_QUEUE=scoring_queue
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
EOF

# Jalankan scoring consumer
python scoring_consumer.py

# Atau jalankan scoring manual (untuk testing)
python score.py
```

### 4. Setup Frontend - Dashboard

Buka terminal baru:

```bash
# Masuk ke folder frontend
cd frontend

# Install dependencies
npm install

# Buat file .env.local dengan Supabase credentials
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EOF

# Jalankan development server
npm run dev

# Akses dashboard di browser
# http://localhost:3000
```

## 📊 Struktur Project

```
.
├── frontend/                 # Next.js Dashboard
│   ├── app/
│   │   ├── admin/
│   │   │   └── dashboard/   # Admin dashboard & scheduler
│   │   ├── leads/           # Leads management
│   │   └── company/         # Company management
│   ├── components/          # React components
│   └── lib/                 # Utilities & Supabase client
│
├── backend/
│   ├── crawler/             # LinkedIn Crawler
│   │   ├── crawler.py       # Main crawler logic
│   │   ├── crawler_consumer.py  # RabbitMQ consumer
│   │   └── main.py          # CLI interface
│   │
│   └── scoring/             # Scoring System
│       ├── scoring_consumer.py  # RabbitMQ consumer
│       ├── score.py         # Batch scoring
│       └── requirements/    # Job requirements JSON
│
└── README.md
```

## 🔧 Konfigurasi Scoring

Sistem scoring menggunakan bobot berikut:

### Bobot Penilaian (Total 100 poin)

1. **Demographics (40 poin)** - PRIORITAS TERTINGGI
   - Gender: 15 poin
   - Location: 15 poin
   - Age: 10 poin

2. **Experience (25 poin)** - STRICT
   - Hanya pengalaman Desk Collection yang dihitung
   - Minimal 3 tahun di posisi relevan

3. **Skills (25 poin)**
   - Required skills: 18 poin
   - Preferred skills: 7 poin

4. **Education (10 poin)**
   - High School/Diploma/Bachelor

### Edit Requirements

File requirements ada di: `backend/scoring/requirements/`

Contoh: `desk_collection.json`

```json
{
  "position": "Desk Collection - BPR KS Bandung",
  "required_skills": {
    "Desk Collection": 1,
    "Call Collection": 1,
    "Telecollection": 1
  },
  "min_experience_years": 3,
  "required_gender": "Female",
  "required_location": "Bandung",
  "required_age_range": {
    "min": 20,
    "max": 35
  }
}
```

## 🎯 Workflow

1. **Admin membuat schedule** di dashboard (http://localhost:3000/admin/dashboard/scheduler)
2. **Crawler berjalan** sesuai schedule dan scrape profil LinkedIn
3. **Data dikirim** ke RabbitMQ queue
4. **Scoring consumer** mengambil data dari queue dan menghitung score
5. **Score disimpan** ke Supabase dan file JSON
6. **Admin melihat hasil** di dashboard

### Scheduler Behavior

When creating a new schedule through the API:
- **Active schedules** are immediately registered with the scheduler service (no restart required)
- **Inactive schedules** are stored in the database but not registered until activated
- If scheduler registration fails, the schedule is still created and will be loaded on next API restart
- Manual schedule execution is available via the `/api/schedules/{schedule_id}/execute` endpoint

### Manual Schedule Execution Session Tracking

When manually executing a schedule via the API endpoint `/api/schedules/{schedule_id}/execute`:
- The global `current_crawl_session` is updated to track the execution source
- Session is marked with `source: 'scheduled'` to distinguish from manual crawls
- Includes schedule metadata (ID, name) for better monitoring and debugging
- Session tracking only occurs if the scraping operation succeeds and queues leads
- Provides real-time visibility into which schedule triggered the current crawl activity

**Session Data Structure for Scheduled Execution:**
```python
{
    'is_active': True,
    'source': 'scheduled',           # Indicates scheduled trigger
    'schedule_id': 'uuid',           # Schedule that triggered the crawl
    'schedule_name': 'Daily Crawl',  # Human-readable schedule name
    'template_id': 'uuid',           # Template being used
    'template_name': 'Template Name', # Template name
    'started_at': 'ISO timestamp',   # When crawl started
    'leads_queued': 150              # Number of leads queued
}
```

### Scheduler Service Implementation

The scheduler service (`backend/api/scheduler_service.py`) uses `ScheduleManager` for database operations to avoid connection issues:

**Database Access Pattern:**
- Uses `ScheduleManager.get_by_id()` instead of direct database client calls
- Prevents connection pooling issues during job registration
- Ensures consistent database access across scheduler operations

This change improves reliability when adding jobs to the scheduler, particularly during API startup when multiple schedules are loaded simultaneously.

**Error Resilience:**
- `last_run` timestamp updates are wrapped in try-catch blocks
- Database update failures are logged but don't interrupt schedule execution
- Ensures crawler jobs continue even if metadata updates fail
- Non-critical operations are isolated to prevent cascade failures

## 🐛 Troubleshooting

### LavinMQ/RabbitMQ tidak bisa connect
```bash
# Test koneksi ke LavinMQ
python test-lavinmq.py

# Cek credentials di .env files
cat backend/crawler/.env | grep RABBITMQ
cat backend/scoring/.env | grep RABBITMQ
cat backend/api/.env | grep RABBITMQ

# Pastikan RABBITMQ_VHOST sudah diset!
```

### Crawler error "Chrome driver not found"
```bash
# Install Chrome browser terlebih dahulu
# Atau update webdriver-manager
pip install --upgrade webdriver-manager
```

### Frontend error "Cannot find module '@/lib/supabase'"
```bash
# Restart TypeScript server di IDE
# Atau rebuild
cd frontend
rm -rf .next
npm run dev
```

### Scoring tidak update ke Supabase
- Pastikan SUPABASE_URL dan SUPABASE_KEY sudah benar di `.env`
- Cek tabel `leads_list` sudah ada di Supabase
- Pastikan kolom `score` ada di tabel

## 📝 Notes

- **Development**: Semua service berjalan di localhost
- **Production**: Perlu setup environment variables yang proper
- **Security**: Jangan commit file `.env` ke git
- **Supabase**: Pastikan sudah setup database schema yang sesuai

## 🔄 Frontend Components

### Requirement Modal (`frontend/components/requirement-modal.tsx`)

The requirement modal component provides a dual-mode interface for configuring crawler jobs:

#### Features
- **Two Operating Modes:**
  - **Create New Schedule**: Configure a new crawler job with custom settings
  - **Use Existing Schedule**: Attach requirements to an existing active schedule

- **Schedule Management:**
  - Fetches active schedules from Supabase `schedules` table
  - Orders schedules by creation date (newest first)
  - Displays schedule name and cron expression
  - Real-time loading states for better UX

- **Requirement Selection:**
  - Browse and select from available requirements
  - Preview requirement JSON before selection
  - Visual feedback for selected items

- **Schedule Types (New Mode):**
  - **Run Now**: Execute crawler immediately
  - **Scheduled**: Set up cron-based recurring execution

#### Database Integration
The component queries the following Supabase tables:
- `requirements` - Job requirement configurations
- `schedules` - Active crawler schedules (filtered by `status = 'active'`)

Both queries are ordered by `created_at` in descending order to show the most recent items first.

### Requirements View Modal (`frontend/components/requirements-view-modal.tsx`)

A dual-view modal component for displaying job requirements in both structured UI and raw JSON formats.

#### Features
- **Dual View Modes:**
  - **UI View**: Structured card-based display with parsed requirement items
  - **JSON View**: Raw JSON format for technical inspection

- **Smart Requirement Parsing:**
  - Automatically handles both array and object-based requirement structures
  - Extracts `id`, `label`, `name`, or `title` fields for display
  - Falls back to index-based identifiers when fields are missing

- **UI View Display:**
  - Card-based layout with color-coded ID badges
  - Shows requirement label/name prominently
  - Displays up to 3 additional properties per requirement
  - Hover effects for better interactivity
  - Empty state handling with user-friendly message

- **JSON View Display:**
  - Syntax-highlighted JSON output
  - Properly formatted with 2-space indentation
  - Horizontal scrolling for long lines
  - Preserves complete data structure

- **Tab Navigation:**
  - Smooth transitions between view modes
  - Visual indicators for active tab
  - Icon-based navigation (List for UI, Code for JSON)

#### Usage
The component is typically used to preview requirement configurations before attaching them to crawler jobs or schedules. It provides both human-readable and machine-readable views of the same data.

#### Props
- `isOpen` (boolean): Controls modal visibility
- `onClose` (function): Callback when modal is closed
- `templateName` (string): Display name for the requirement template
- `requirements` (any): Requirement data (array or object)

## 🔐 Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Backend (.env)
```
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
CRAWLER_QUEUE=crawler_queue
SCORING_QUEUE=scoring_queue
SUPABASE_URL=
SUPABASE_KEY=
```

## 🔒 Authentication & Authorization

### Frontend Middleware (`frontend/middleware.ts`)

The application uses Next.js middleware with Supabase SSR for authentication and authorization.

#### Features
- **Session Management**: Uses `@supabase/ssr` for server-side session handling
- **Cookie-based Auth**: Properly manages authentication cookies across requests
- **Role-based Access Control**: Enforces admin-only access to protected routes
- **Auto-redirect Logic**:
  - Logged-in users accessing `/login` → redirected to dashboard (`/`)
  - Non-authenticated users → redirected to `/login`
  - Non-admin users → signed out and redirected to `/login`

#### Protected Routes
All routes are protected except:
- Static assets (`_next/static`, `_next/image`)
- Public images (`favicon.ico`, `logo_sarana_ai.jpg`, and image files)

#### Role Verification
The middleware checks for admin role in multiple metadata locations:
- `user_metadata.role`
- `app_metadata.role`
- `raw_app_meta_data.role`

Only users with `role: 'admin'` can access the application.

#### Migration from Auth Helpers
The middleware has been updated from `@supabase/auth-helpers-nextjs` to `@supabase/ssr` for better Next.js 13+ compatibility and improved cookie handling.

## 📞 Support

Jika ada masalah, cek:
1. Semua service sudah running (RabbitMQ, Crawler, Scoring, Frontend)
2. Environment variables sudah benar
3. Dependencies sudah terinstall semua
4. Port tidak bentrok dengan aplikasi lain

---

**Happy Crawling! 🚀**

## 🌐 CORS Configuration (API)

The backend API (`backend/api/main.py`) is configured to accept requests from multiple origins:

### Allowed Origins
- `http://localhost:3000` - Local development (primary)
- `http://localhost:3001` - Local development (alternate)
- `https://*.vercel.app` - All Vercel preview and production deployments
- Custom production URL via `FRONTEND_URL` environment variable

### Configuration
The API uses both static origins and regex patterns to support:
- Local development environments
- Vercel preview deployments (automatically generated URLs)
- Production deployments

### Environment Variable
To set a custom production frontend URL, add to `backend/api/.env`:
```
FRONTEND_URL=https://your-production-domain.com
```

This ensures the API can communicate with your frontend regardless of deployment environment.

## 🐳 Docker Testing (API)

Before deploying the API to production, you can test the Docker build locally using the provided test script.

### Testing Docker Build

```bash
# Navigate to API directory
cd backend/api

# Set environment variables (required)
export SUPABASE_URL="your_supabase_url"
export SUPABASE_KEY="your_supabase_key"

# Run the test script
bash test-docker.sh
```

### What the Script Does

1. **Builds** the Docker image as `linkedin-api:test`
2. **Starts** a container named `linkedin-api-test` on port 8000
3. **Waits** for the service to initialize (5 seconds)
4. **Tests** the health endpoint at `http://localhost:8000/health`
5. **Reports** success or failure with appropriate cleanup

### After Testing

If successful, the API will be running at:
- API: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`

To stop and remove the test container:
```bash
docker stop linkedin-api-test
docker rm linkedin-api-test
```

### Troubleshooting Docker Tests

If the health check fails, the script will:
- Display container logs automatically
- Stop and remove the container
- Exit with error code

Common issues:
- Missing environment variables (SUPABASE_URL, SUPABASE_KEY)
- Port 8000 already in use
- Docker daemon not running

## 📤 Outreach API Endpoint

The API now includes an outreach endpoint for sending connection requests to LinkedIn leads.

### Endpoint: POST `/api/outreach/send`

Send connection requests to selected leads with personalized messages.

#### Request Body
```json
{
  "leads": [
    {
      "id": "lead-uuid",
      "name": "John Doe",
      "profile_url": "https://www.linkedin.com/in/johndoe"
    }
  ],
  "message": "Hi {lead_name}, I'd like to connect with you!",
  "dry_run": true
}
```

#### Parameters
- `leads` (array, required): List of lead objects with `id`, `name`, and `profile_url`
- `message` (string, required): Connection request message template. Use `{lead_name}` placeholder for personalization
- `dry_run` (boolean, optional): If `true`, validates payload without sending actual requests. Default: `true`

#### Response
```json
{
  "status": "success",
  "message": "Outreach messages queued successfully",
  "total_leads": 5,
  "valid_leads": 5,
  "queued": 5,
  "count": 5,
  "batch_id": "20260223_143022",
  "dry_run": true,
  "queue": "outreach_queue"
}
```

#### Response Fields
- `status`: Operation status ("success" or "error")
- `message`: Human-readable status message
- `total_leads`: Total number of leads in request
- `valid_leads`: Number of leads that passed validation
- `queued`: Number of messages successfully queued to RabbitMQ
- `count`: Same as `queued` (for backward compatibility)
- `batch_id`: Unique batch identifier for tracking
- `dry_run`: Whether this was a test run
- `queue`: Name of the RabbitMQ queue used

#### Validation
The endpoint validates each lead for:
- Required fields: `name` and `profile_url`
- Returns count of valid vs total leads
- Logs detailed information for debugging

#### Current Status
**Step 1 (Completed)**: Payload validation and logging
- Receives and validates outreach requests from frontend
- Logs lead details for debugging
- Returns validation results

**Step 2 (Completed)**: RabbitMQ integration
- `pika` library integrated for RabbitMQ communication
- Queues outreach jobs to `outreach_queue` for processing
- Each lead sent as individual message with batch tracking
- Persistent message delivery (survives broker restarts)
- Worker-based connection request sending ready
- Rate limiting and anti-detection measures in worker

#### Queue Configuration
The outreach endpoint uses the following RabbitMQ configuration:
- **Queue Name**: `outreach_queue` (configurable via `OUTREACH_QUEUE` env var)
- **Message Format**: JSON with lead details, message template, and dry_run flag
- **Delivery Mode**: Persistent (messages survive broker restarts)
- **Batch Tracking**: Each batch gets unique ID with timestamp

#### Message Structure
Each queued message contains:
```json
{
  "job_id": "outreach_20260223_143022_1",
  "lead_id": "lead-uuid",
  "name": "John Doe",
  "profile_url": "https://www.linkedin.com/in/johndoe",
  "message": "Hi John Doe, I'd like to connect!",
  "dry_run": true,
  "batch_id": "20260223_143022",
  "created_at": "2026-02-23T14:30:22.123456"
}

#### Dependencies
The outreach feature requires:
- **RabbitMQ**: Message queue for job distribution
- **pika**: Python RabbitMQ client library (already imported)
- **Crawler worker**: Processes outreach jobs from queue

#### Usage Example
```bash
curl -X POST http://localhost:8000/api/outreach/send \
  -H "Content-Type: application/json" \
  -d '{
    "leads": [
      {
        "id": "123",
        "name": "Jane Smith",
        "profile_url": "https://www.linkedin.com/in/janesmith"
      }
    ],
    "message": "Hi {lead_name}, interested in your profile!",
    "dry_run": true
  }'
```


## 🏢 Companies API Endpoints

The API provides endpoints for managing and retrieving company data from the Supabase `companies` table.

### Endpoint: GET `/api/companies`

Retrieve all companies, optionally filtered by platform.

#### Query Parameters
- `platform` (string, optional): Filter companies by platform (case-insensitive partial match)

#### Response
```json
{
  "success": true,
  "count": 2,
  "platform": "mejakita",
  "companies": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "PT Example Company",
      "platform": "mejakita",
      "created_at": "2026-02-23T10:00:00Z"
    }
  ]
}
```

#### Response Fields
- `success`: Operation status (boolean)
- `count`: Number of companies returned
- `platform`: Platform filter applied (null if no filter)
- `companies`: Array of company objects

#### Usage Examples
```bash
# Get all companies
curl http://localhost:8000/api/companies

# Get companies for specific platform
curl http://localhost:8000/api/companies?platform=mejakita
```

### Endpoint: GET `/api/companies/{company_id}`

Retrieve a single company by its UUID.

#### Path Parameters
- `company_id` (string, required): UUID of the company

#### Response (Success)
```json
{
  "success": true,
  "company": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "PT Example Company",
    "platform": "mejakita",
    "created_at": "2026-02-23T10:00:00Z"
  }
}
```

#### Response (Not Found)
```json
{
  "detail": "Company not found"
}
```
Status Code: 404

#### Usage Example
```bash
curl http://localhost:8000/api/companies/123e4567-e89b-12d3-a456-426614174000
```

### Database Schema

The companies endpoints interact with the `companies` table in Supabase:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `name` | String | Company name |
| `platform` | String | Platform identifier for filtering |
| `created_at` | Timestamp | Record creation timestamp |

**Note:** The `platform` column is used for filtering companies by platform. The API performs case-insensitive partial matching on this field.

### Error Handling

Both endpoints return appropriate HTTP status codes:
- `200 OK`: Successful request
- `404 Not Found`: Company not found (single company endpoint)
- `500 Internal Server Error`: Database or server error
- `503 Service Unavailable`: Database connection not available

### Recent Updates

**Database Client Reference Fix (Latest)**
- Fixed incorrect database client reference in companies endpoints
- Changed `db.supabase.table()` to `db.client.table()` for proper Supabase client access
- Affects both `/api/companies` and `/api/companies/{company_id}` endpoints
- Ensures consistent database access pattern across the API

## 📊 Leads Filtering API Endpoints

The API provides advanced filtering endpoints for retrieving leads based on company platform or company ID. These endpoints follow the relational chain: `platform → companies → search_templates → leads_list`.

### Endpoint: GET `/api/leads/by-platform`

Retrieve leads filtered by company platform with full relationship chain visibility.

#### Query Parameters
- `platform` (string, required): Platform name to filter by (case-insensitive partial match)
- `limit` (integer, optional): Number of results to return. Default: `100`
- `offset` (integer, optional): Pagination offset. Default: `0`

#### Response
```json
{
  "success": true,
  "platform": "mejakita",
  "companies_found": 2,
  "companies": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "PT Example Company",
      "code": "EXAMPLE",
      "platform": "mejakita"
    }
  ],
  "templates_found": 5,
  "templates": [
    {
      "id": "template-uuid-1",
      "name": "Backend Developer",
      "company_id": "123e4567-e89b-12d3-a456-426614174000"
    }
  ],
  "leads_count": 150,
  "leads_returned": 100,
  "limit": 100,
  "offset": 0,
  "leads": [
    {
      "id": "lead-uuid-1",
      "template_id": "template-uuid-1",
      "name": "John Doe",
      "profile_url": "https://linkedin.com/in/johndoe",
      "score": 85.5,
      "date": "2026-02-23",
      "connection_status": "scraped"
    }
  ]
}
```

#### Response Fields
- `success`: Operation status (boolean)
- `platform`: Platform name used for filtering
- `companies_found`: Number of companies matching the platform
- `companies`: Array of company objects matching the platform
- `templates_found`: Number of search templates linked to these companies
- `templates`: Array of search template objects
- `leads_count`: Total number of leads across all templates (for pagination)
- `leads_returned`: Number of leads in current response
- `limit`: Applied result limit
- `offset`: Applied pagination offset
- `leads`: Array of lead objects

#### Query Flow
1. **Step 1**: Query `companies` table filtered by platform (case-insensitive partial match)
2. **Step 2**: Query `search_templates` table using company IDs from step 1
3. **Step 3**: Query `leads_list` table using template IDs from step 2
4. **Step 4**: Count total leads for pagination metadata

#### Usage Examples
```bash
# Get first 100 leads for mejakita platform
curl "http://localhost:8000/api/leads/by-platform?platform=mejakita"

# Get next 50 leads with pagination
curl "http://localhost:8000/api/leads/by-platform?platform=mejakita&limit=50&offset=100"

# Get leads for different platform
curl "http://localhost:8000/api/leads/by-platform?platform=jobstreet"
```

#### Empty Results Handling
If no companies match the platform:
```json
{
  "success": true,
  "platform": "nonexistent",
  "companies_found": 0,
  "templates_found": 0,
  "leads_count": 0,
  "leads": []
}
```

If companies exist but no templates:
```json
{
  "success": true,
  "platform": "mejakita",
  "companies_found": 2,
  "companies": [...],
  "templates_found": 0,
  "leads_count": 0,
  "leads": []
}
```

### Endpoint: GET `/api/leads/by-company/{company_id}`

Retrieve leads filtered by a specific company ID with full relationship chain visibility.

#### Path Parameters
- `company_id` (string, required): UUID of the company

#### Query Parameters
- `limit` (integer, optional): Number of results to return. Default: `100`
- `offset` (integer, optional): Pagination offset. Default: `0`

#### Response (Success)
```json
{
  "success": true,
  "company": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "PT Example Company",
    "code": "EXAMPLE",
    "platform": "mejakita",
    "created_at": "2026-02-23T10:00:00Z"
  },
  "templates_found": 3,
  "templates": [
    {
      "id": "template-uuid-1",
      "name": "Backend Developer",
      "company_id": "123e4567-e89b-12d3-a456-426614174000"
    }
  ],
  "leads_count": 75,
  "leads_returned": 75,
  "limit": 100,
  "offset": 0,
  "leads": [
    {
      "id": "lead-uuid-1",
      "template_id": "template-uuid-1",
      "name": "Jane Smith",
      "profile_url": "https://linkedin.com/in/janesmith",
      "score": 92.0,
      "date": "2026-02-23",
      "connection_status": "scraped"
    }
  ]
}
```

#### Response (Company Not Found)
```json
{
  "detail": "Company not found"
}
```
Status Code: 404

#### Response Fields
- `success`: Operation status (boolean)
- `company`: Complete company object
- `templates_found`: Number of search templates for this company
- `templates`: Array of search template objects
- `leads_count`: Total number of leads across all templates (for pagination)
- `leads_returned`: Number of leads in current response
- `limit`: Applied result limit
- `offset`: Applied pagination offset
- `leads`: Array of lead objects

#### Query Flow
1. **Step 1**: Query `companies` table by company ID (validates existence)
2. **Step 2**: Query `search_templates` table using company ID
3. **Step 3**: Query `leads_list` table using template IDs from step 2
4. **Step 4**: Count total leads for pagination metadata

#### Usage Examples
```bash
# Get all leads for a specific company
curl "http://localhost:8000/api/leads/by-company/123e4567-e89b-12d3-a456-426614174000"

# Get leads with pagination
curl "http://localhost:8000/api/leads/by-company/123e4567-e89b-12d3-a456-426614174000?limit=50&offset=0"

# Get next page
curl "http://localhost:8000/api/leads/by-company/123e4567-e89b-12d3-a456-426614174000?limit=50&offset=50"
```

#### Empty Results Handling
If company exists but has no templates:
```json
{
  "success": true,
  "company": {...},
  "templates_found": 0,
  "leads_count": 0,
  "leads": []
}
```

### Database Relationships

These endpoints leverage the following table relationships:

```
companies (platform)
    ↓ (1:N)
search_templates (company_id)
    ↓ (1:N)
leads_list (template_id)
```

**Table Columns Used:**
- `companies`: `id`, `name`, `code`, `platform`, `created_at`
- `search_templates`: `id`, `name`, `company_id`
- `leads_list`: All columns (full lead data)

### Pagination

Both endpoints support pagination through `limit` and `offset` parameters:
- **Default limit**: 100 leads per request
- **Offset**: Starting position in result set (0-indexed)
- **Total count**: Returned in `leads_count` field for building pagination UI

Example pagination calculation:
```javascript
const totalPages = Math.ceil(leads_count / limit);
const currentPage = Math.floor(offset / limit) + 1;
```

### Error Handling

Both endpoints return appropriate HTTP status codes:
- `200 OK`: Successful request (even if no results found)
- `404 Not Found`: Company not found (by-company endpoint only)
- `500 Internal Server Error`: Database or server error
- `503 Service Unavailable`: Database connection not available

### Use Cases

**By Platform Endpoint:**
- Dashboard views showing all leads across multiple companies on a platform
- Platform-level analytics and reporting
- Cross-company lead comparison
- Platform performance metrics

**By Company Endpoint:**
- Company-specific lead management
- Single company analytics
- Template performance within a company
- Company-focused recruitment workflows

## ⚙️ VS Code Workspace Configuration

The project includes VS Code workspace settings to optimize the development experience.

### TypeScript Settings (`.vscode/settings.json`)

- **Auto-closing Tags**: Disabled (`typescript.autoClosingTags: false`)
  - Prevents automatic insertion of closing JSX/TSX tags
  - Gives developers full control over tag completion
  - Useful when working with complex React component structures

To modify workspace settings, edit `.vscode/settings.json` directly or use VS Code's settings UI (Workspace tab).

## 🎭 Mascot Animation Hook

The frontend includes a custom React hook for animating SVG mascot characters with eye tracking and interactive behaviors.

### Hook: `useMascotAnimation` (`frontend/hooks/useMascotAnimation.ts`)

A GSAP-powered animation hook that provides lifelike eye movements and interactions for SVG mascot characters.

#### Features

**Automatic Behaviors:**
- **Idle Blinking**: Random blinks every 4-6 seconds when idle
- **Eye Tracking**: Pupils follow cursor movement when enabled
- **State Management**: Tracks closed, peeking, and tracking states

**Interactive Animations:**
- **Blink**: Quick eye blink animation (0.25s total)
- **Close Eyes**: Smooth eye closing with pupil fade-out
- **Peek One Eye**: Playful partial eye opening (35%) with bounce effect
- **Unsee Peek**: Reverses peek animation, closing the peeking eye back to closed state
- **Reset to Idle**: Returns to normal state and resumes blinking

**Eye Morphing:**
- Uses SVG path morphing for smooth eye shape transitions
- Open eye path: `M 0 0 Q 15 -8, 30 0 Q 15 8, 0 0`
- Closed eye path: `M 0 0 Q 15 0, 30 0 Q 15 0, 0 0`
- Peek eye path: `M 0 0 Q 15 -3, 30 0 Q 15 3, 0 0` (35% open)

#### Required SVG Structure

The hook expects SVG elements with specific refs:

```typescript
interface MascotRefs {
  leftEye: MutableRefObject<SVGGElement | null>;
  rightEye: MutableRefObject<SVGGElement | null>;
  leftPupil: MutableRefObject<SVGCircleElement | null>;
  rightPupil: MutableRefObject<SVGCircleElement | null>;
  leftEyeShape: MutableRefObject<SVGPathElement | null>;
  rightEyeShape: MutableRefObject<SVGPathElement | null>;
}
```

#### Usage Example

```typescript
import { useRef } from 'react';
import { useMascotAnimation } from '@/hooks/useMascotAnimation';

function MascotComponent() {
  // Create refs for SVG elements
  const leftEye = useRef<SVGGElement>(null);
  const rightEye = useRef<SVGGElement>(null);
  const leftPupil = useRef<SVGCircleElement>(null);
  const rightPupil = useRef<SVGCircleElement>(null);
  const leftEyeShape = useRef<SVGPathElement>(null);
  const rightEyeShape = useRef<SVGPathElement>(null);

  // Initialize animation hook
  const mascot = useMascotAnimation({
    leftEye,
    rightEye,
    leftPupil,
    rightPupil,
    leftEyeShape,
    rightEyeShape,
  });

  // Enable eye tracking on mouse move
  const handleMouseMove = (e: MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percentX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    mascot.movePupil(percentX);
  };

  return (
    <div 
      onMouseEnter={() => mascot.enableTracking()}
      onMouseLeave={() => mascot.disableTracking()}
      onMouseMove={handleMouseMove}
    >
      <svg viewBox="0 0 200 200">
        <g ref={leftEye}>
          <path ref={leftEyeShape} d="M 0 0 Q 15 -8, 30 0 Q 15 8, 0 0" />
          <circle ref={leftPupil} r="5" />
        </g>
        <g ref={rightEye}>
          <path ref={rightEyeShape} d="M 0 0 Q 15 -8, 30 0 Q 15 8, 0 0" />
          <circle ref={rightPupil} r="5" />
        </g>
      </svg>
    </div>
  );
}
```

#### API Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `blink()` | Trigger a single blink animation | None |
| `enableTracking()` | Enable cursor tracking for pupils | None |
| `disableTracking()` | Disable cursor tracking | None |
| `movePupil(percentX)` | Move pupils horizontally | `percentX`: -1 to 1 (clamped to ±6px) |
| `closeEyes()` | Close eyes with smooth animation | None |
| `peekOneEye()` | Open left eye partially (35%) | None |
| `unseePeek()` | Close the peeking eye back to closed state | None |
| `resetToIdle()` | Return to normal state and resume blinking | None |

#### Animation Timings

- **Blink**: 0.1s close + 0.15s open = 0.25s total
- **Close Eyes**: 0.3s morph + 0.15s pupil fade
- **Peek**: 0.25s eye open + 0.3s bounce effect
- **Unsee Peek**: 0.2s eye close + 0.15s pupil fade + 0.2s position reset
- **Reset**: 0.3s morph + 0.2s pupil fade-in
- **Pupil Movement**: 0.25s smooth tracking
- **Idle Blink Interval**: Random 4-6 seconds

#### State Management

The hook maintains internal state refs to prevent conflicting animations:
- `isTrackingRef`: Whether cursor tracking is active
- `isClosedRef`: Whether eyes are currently closed
- `isPeekingRef`: Whether in peek animation state

These states ensure animations don't overlap inappropriately (e.g., no blinking while eyes are closed).

#### Dependencies

- **GSAP** (`gsap`): Animation library for smooth transitions
- **React** (`useEffect`, `useRef`): Hook lifecycle and ref management

#### Cleanup

The hook automatically cleans up on unmount:
- Stops blink intervals
- Reverts GSAP context
- Clears all timeouts

This prevents memory leaks and ensures proper cleanup when the component is removed from the DOM.

## 🔍 RabbitMQ Debugging (API Helper)

The RabbitMQ helper in `backend/api/helper/rabbitmq_helper.py` includes enhanced debugging features for troubleshooting queue connectivity and message publishing issues.

### Debug Output

When publishing messages to RabbitMQ queues, the helper now provides detailed console output:

**Connection Phase:**
```
🔗 Connecting to RabbitMQ...
   Host: leopard.lmq.cloudamqp.com:5671
   VHost: fexihtwb
   Queue: linkedin_profiles
```

**Success Phase:**
```
✅ Queue declared: linkedin_profiles
✅ Message published to queue: linkedin_profiles
```

**Error Phase:**
```
❌ Queue publish failed: [Errno 111] Connection refused
Traceback (most recent call last):
  File "backend/api/helper/rabbitmq_helper.py", line 43, in publish
    connection = pika.BlockingConnection(self.parameters)
  ...
```

### Features

- **Connection Details**: Displays host, port, vhost, and target queue before attempting connection
- **Queue Declaration Confirmation**: Confirms successful queue declaration
- **Publish Confirmation**: Confirms message was successfully published
- **Full Stack Traces**: On error, prints complete traceback for debugging
- **Emoji Indicators**: Visual indicators for quick status identification (🔗 connecting, ✅ success, ❌ error)

### Use Cases

**Debugging Connection Issues:**
- Verify correct host, port, and vhost are being used
- Identify network connectivity problems
- Detect authentication failures

**Debugging Queue Issues:**
- Confirm queue names match between publisher and consumer
- Verify queue declaration succeeds
- Track message publishing success

**Production Monitoring:**
- Monitor queue health in real-time
- Identify intermittent connection issues
- Track message flow through the system

### Environment Variables

The debug output uses these environment variables from `.env`:
- `RABBITMQ_HOST`: RabbitMQ server hostname
- `RABBITMQ_PORT`: RabbitMQ server port (5672 for AMQP, 5671 for AMQPS)
- `RABBITMQ_VHOST`: Virtual host name
- `RABBITMQ_QUEUE`: Default crawler queue name
- `OUTREACH_QUEUE`: Outreach queue name

### Affected Methods

The enhanced debugging applies to:
- `publish(queue_name, message)`: Base publish method
- `publish_crawler_job(profile_url, template_id)`: Crawler job publishing
- `publish_outreach_job(lead, message_text, dry_run, batch_id)`: Outreach job publishing

All methods now provide detailed logging for troubleshooting queue operations.


## 🔍 RabbitMQ Debugging (API Helper)

The RabbitMQ helper in `backend/api/helper/rabbitmq_helper.py` includes enhanced debugging features for troubleshooting queue connectivity and message publishing issues.

### Debug Output

When publishing messages to RabbitMQ queues, the helper now provides detailed console output:

**Connection Phase:**
```
🔗 Connecting to RabbitMQ...
   Host: leopard.lmq.cloudamqp.com:5671
   VHost: fexihtwb
   Queue: linkedin_profiles
```

**Success Phase:**
```
✅ Queue declared: linkedin_profiles
✅ Message published to queue: linkedin_profiles
```

**Error Phase:**


## 🔧 Environment Variable Loading (API)

The API backend (`backend/api/main.py`) now explicitly loads environment variables using `python-dotenv` at startup.

### Implementation

```python
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
```

### Benefits

- **Explicit Loading**: Environment variables are loaded before any service initialization
- **Development Consistency**: Ensures `.env` files are read in all execution contexts
- **Debugging**: Makes it clear when and where environment configuration is loaded
- **Reliability**: Prevents issues where environment variables might not be available during early initialization

### Affected Services

This change ensures environment variables are available for:
- Database connections (Supabase)
- RabbitMQ/LavinMQ configuration
- CORS settings
- API keys and secrets
- All other environment-dependent configurations

### Note

While many Python frameworks auto-load `.env` files, this explicit call ensures consistent behavior across different deployment environments and execution methods (direct Python, Docker, systemd, etc.).


## 🐛 Crawler Session Management Fix

The API's stop scraping endpoint (`POST /api/crawler/stop`) has been fixed to properly clear the crawler session state.

### Issue

Previously, when stopping the crawler via the API, the queue would be purged but the `current_crawl_session` global state remained active (`is_active: True`). This caused the crawler status to incorrectly show as "running" even after stopping.

### Fix

The stop endpoint now explicitly resets the `current_crawl_session` to idle state after purging the queue:

```python
current_crawl_session = {
    'is_active': False,
    'source': None,
    'schedule_id': None,
    'schedule_name': None,
    'template_id': None,
    'template_name': None,
    'started_at': None,
    'leads_queued': 0
}
```

### Impact

- **Status Accuracy**: Crawler status now correctly reflects "idle" after stopping
- **UI Consistency**: Dashboard shows accurate crawler state
- **Session Tracking**: Prevents stale session data from persisting
- **Queue Sync**: Session state now stays in sync with queue state

### Affected Endpoint

- `POST /api/crawler/stop` - Stop scraping and clear session

### Console Output

When stopping the crawler, you'll now see:
```
🛑 Stop scraping requested - purging queue
✅ Crawler session cleared - status now idle
```

This ensures the crawler session state is properly synchronized with the queue state for accurate status reporting.


## 🕐 Timezone Support (API)

The API backend now includes timezone support via the `pytz` library for handling datetime operations across different timezones.

### Dependency

- **pytz**: Python timezone library for accurate timezone calculations and conversions

### Usage

The `pytz` library is imported in `backend/api/main.py` and can be used for:
- Converting timestamps to specific timezones
- Handling schedule execution times across regions
- Ensuring consistent datetime formatting in API responses
- Managing timezone-aware datetime objects

### Installation

The `pytz` library should be included in `backend/api/requirements.txt`. If not already present, install it:

```bash
pip install pytz
```

This ensures accurate timezone handling for scheduled crawler jobs and timestamp operations throughout the API.


## 🚀 API Startup Diagnostics

The API backend (`backend/api/main.py`) now includes enhanced startup logging to help diagnose initialization issues.

### Startup Output

When the API starts, you'll see detailed diagnostic information:

```
🚀 Starting up API...
   Database init: ✓ Success
   Initializing database tables...
   Starting scheduler service...
✓ Scheduler started and running
   Scheduler is_running: True
```

### Diagnostic Information

The startup sequence now logs:
- **Database Initialization**: Success/failure status of service initialization
- **Table Creation**: Confirmation of database table initialization
- **Scheduler Status**: Whether the scheduler service started successfully
- **Scheduler State**: Real-time verification that the scheduler is running

### Troubleshooting

If startup fails, the enhanced logging will show:

**Database Connection Issues:**
```
🚀 Starting up API...
   Database init: ✗ Failed
⚠ Running without scheduler (database not available)
   db object: None
   scheduler object: None
```

**Scheduler Issues:**
```
🚀 Starting up API...
   Database init: ✓ Success
   Initializing database tables...
   Starting scheduler service...
⚠ Running without scheduler (database not available)
   db object: <Database instance>
   scheduler object: None
```

### Benefits

- **Quick Diagnosis**: Immediately identify which component failed during startup
- **Service Verification**: Confirm all services initialized correctly
- **Debug Information**: Object state inspection for troubleshooting
- **Visual Indicators**: Emoji-based status indicators for quick scanning

### Related Services

The startup diagnostics cover initialization of:
- Supabase database connection
- APScheduler service
- RabbitMQ/LavinMQ connection
- Database table creation

This enhanced logging makes it easier to identify configuration issues, missing environment variables, or service connectivity problems during API startup.


## 🔒 Schedule Template Validation (Database Layer)

The database layer (`backend/api/database.py`) now includes validation to ensure all schedules have a valid `template_id` before being used by the scheduler.

### Validation Rules

**Schedule Retrieval (`get_schedule_by_id`):**
- Checks if `template_id` exists in the schedule record
- Returns `None` if `template_id` is missing or empty
- Logs warning: `⚠️ Schedule {schedule_id} missing template_id`

**Active Schedules (`get_active_schedules`):**
- Filters out schedules without `template_id` from active schedule list
- Only returns schedules with valid `template_id` values
- Logs count of filtered schedules: `⚠️ Filtered out {count} schedules without template_id`

### Why This Matters

The scheduler requires `template_id` to:
- Determine which search template to use for crawling
- Link crawled leads to the correct template
- Maintain data integrity between schedules and templates

Without `template_id`, the scheduler cannot execute the crawl job properly, so these schedules are excluded from execution.

### Impact

**Before:**
- Schedules without `template_id` would be passed to the scheduler
- Scheduler would fail or behave unpredictably
- Error handling would occur at execution time

**After:**
- Invalid schedules are filtered at the database layer
- Scheduler only receives valid, executable schedules
- Clear warnings logged for debugging
- Prevents runtime errors in scheduler

### Console Output

When schedules are missing `template_id`, you'll see:

```
⚠️ Schedule abc-123-def missing template_id
⚠️ Filtered out 2 schedules without template_id
```

### Affected Methods

- `get_schedule_by_id(schedule_id)` - Returns `None` if no `template_id`
- `get_active_schedules()` - Filters out schedules without `template_id`

### Database Schema Requirement

This validation assumes the `crawler_schedules` table includes a `template_id` column that should be populated when creating schedules. Ensure your schedule creation logic sets this field properly.


## 🔄 Scheduler Service Database Access Pattern

The scheduler service (`backend/api/scheduler_service.py`) has been updated to use `ScheduleManager` for database operations instead of direct database client calls.

### Changes

**Job Execution Method (`_execute_job`):**
- Uses `ScheduleManager.get_by_id(schedule_id)` instead of `self.db.get_schedule(schedule_id)`
- Uses `ScheduleManager.update(schedule_id, {'last_run': datetime.now().isoformat()})` instead of `self.db.update_last_run(schedule_id)`

### Benefits

- **Connection Stability**: Avoids connection pooling issues during job registration
- **Consistent Access**: Uses the same database access pattern as other parts of the application
- **Reliability**: Reduces database connection errors when adding jobs to the scheduler
- **Maintainability**: Centralizes database operations through `ScheduleManager`

### Impact

This change improves reliability when:
- Adding jobs to the scheduler during API startup
- Executing scheduled crawler jobs
- Updating schedule metadata (last run timestamp)
- Loading multiple schedules simultaneously

### Related Components

- `helper/supabase_helper.py` - Contains `ScheduleManager` class
- `backend/api/database.py` - Legacy database client (being phased out)
- `backend/api/scheduler_service.py` - Scheduler service implementation

### Migration Note

This is part of a gradual migration from direct database client usage to manager-based patterns for better separation of concerns and improved reliability.


## 🔧 Scheduler Thread-Safe Database Access

The scheduler service (`backend/api/scheduler_service.py`) now implements thread-safe database access patterns to prevent connection issues during concurrent job execution.

### Thread-Local Database Connections

**Job Execution Method (`_execute_job`):**
- Creates fresh `SupabaseManager` instance per thread
- Imports database helpers within thread context
- Uses direct Supabase client calls instead of shared manager instances

### Implementation Pattern

```python
# Import fresh in thread to avoid connection issues
from helper.supabase_helper import SupabaseManager
from helper.rabbitmq_helper import queue_publisher

# Create fresh Supabase manager for this thread
supabase_manager = SupabaseManager()

# Get schedule using fresh connection
schedule = supabase_manager.supabase.table('crawler_schedules').select('*').eq('id', schedule_id).execute()
```

### Benefits

- **Thread Safety**: Each job execution gets its own database connection
- **Connection Isolation**: Prevents connection pooling conflicts between threads
- **Reliability**: Eliminates "connection already closed" errors
- **Concurrent Execution**: Multiple scheduled jobs can run simultaneously without interference

### Error Resilience

The `last_run` timestamp update is wrapped in try-catch blocks:
- Database update failures are logged but don't interrupt schedule execution
- Non-critical operations are isolated to prevent cascade failures
- Crawler jobs continue even if metadata updates fail

### Console Output

When executing scheduled jobs, you'll see:
```
⏱️ Staggering execution by 2.5s to avoid concurrent overload
📋 Template ID: template-uuid-123
📝 Schedule Name: Daily LinkedIn Crawl
```

### Impact

This change resolves issues where:
- Multiple schedules executing simultaneously caused connection errors
- Shared database connections became stale or closed unexpectedly
- Job execution failed due to connection pooling conflicts
- Scheduler reliability was affected by concurrent database access

### Related Components

- `helper/supabase_helper.py` - Contains `SupabaseManager` class
- `helper/rabbitmq_helper.py` - Queue publisher for crawler jobs
- `backend/api/scheduler_service.py` - Scheduler service implementation

### Technical Details

**Stagger Delay**: Jobs are staggered by 0.5-3 seconds to prevent concurrent overload
**Connection Lifecycle**: Each thread creates and manages its own connection
**Import Strategy**: Database helpers imported within thread scope to ensure fresh instances


## 🔄 Scheduler Crawl Session Management

The scheduler service (`backend/api/scheduler_service.py`) now includes improved crawl session tracking with safer module access patterns.

### Session Update Behavior

**Crawl Session Tracking:**
- Updates global `current_crawl_session` in main module after queuing leads
- Tracks active crawl sessions initiated by scheduled jobs
- Provides real-time visibility into scheduled crawler operations

### Safe Module Access Pattern

The scheduler now uses `sys.modules` to safely access the main module:

```python
import sys
# Get main module from sys.modules (already loaded)
if 'main' in sys.modules:
    main = sys.modules['main']
    main.current_crawl_session = {
        'is_active': True,
        'source': 'scheduled',
        'schedule_id': schedule_id,
        'schedule_name': schedule.get('name', 'Unknown Schedule'),
        'template_id': template_id,
        'template_name': template_name,
        'started_at': started_at_jakarta,
        'leads_queued': queued_count
    }
else:
    print(f"⚠️ Main module not loaded, skipping session update")
```

### Benefits

- **No Circular Imports**: Uses `sys.modules` instead of direct import to avoid circular dependency issues
- **Graceful Degradation**: Skips session update if main module isn't loaded (e.g., when scheduler runs standalone)
- **Error Isolation**: Session update failures don't interrupt crawler job execution
- **Thread Safety**: Safe to call from scheduler threads without affecting main application

### Session Data Structure

```python
{
    'is_active': True,
    'source': 'scheduled',           # Indicates scheduled trigger
    'schedule_id': 'uuid',           # Schedule that triggered the crawl
    'schedule_name': 'Daily Crawl',  # Human-readable schedule name
    'template_id': 'uuid',           # Template being crawled
    'template_name': 'Backend Dev',  # Human-readable template name
    'started_at': '2026-03-10T14:30:00+07:00',  # Asia/Jakarta timezone
    'leads_queued': 150              # Number of leads queued for crawling
}
```

### Console Output

When session is updated successfully:
```
✅ Updated crawl session for scheduled run
```

When main module is not loaded:
```
⚠️ Main module not loaded, skipping session update
```

When session update fails:
```
⚠️ Failed to update crawl session: [error message]
```

### Use Cases

- **Dashboard Integration**: Real-time display of active scheduled crawls
- **Monitoring**: Track which schedules are currently executing
- **Debugging**: Identify the source of crawler activity (manual vs scheduled)
- **Analytics**: Measure scheduled crawler performance and lead throughput

### Related Components

- `backend/api/main.py` - Contains `current_crawl_session` global variable
- `backend/api/scheduler_service.py` - Updates session during scheduled execution
- `helper/supabase_helper.py` - Provides template metadata for session tracking

### Migration Note

This replaces the previous direct import pattern (`import main`) which could cause circular import issues when the scheduler service was imported before the main module was fully initialized.


## 🔧 Scheduler Service Thread Safety

The scheduler service (`backend/api/scheduler_service.py`) has been optimized to handle thread-safety issues when executing scheduled crawl jobs.

### Thread-Safe Template Name Handling

**Problem**: When scheduled jobs execute in background threads, querying Supabase for template names can cause connection pool issues and thread-safety errors.

**Solution**: The scheduler now uses a simplified template name format instead of querying the database:

```python
# Before (caused thread issues):
template = supabase_manager.get_template_by_id(template_id)
template_name = template.get('name', 'Unknown Template')

# After (thread-safe):
template_name = f"Template {template_id[:8]}"
```

### Crawl Session Updates

When a scheduled crawl executes, the service updates the global `current_crawl_session` with:
- `is_active`: Set to `True` during execution
- `source`: Set to `'scheduled'` to indicate scheduler trigger
- `schedule_id`: UUID of the executing schedule
- `schedule_name`: Name from schedule record
- `template_id`: UUID of the template being crawled
- `template_name`: Simplified format using first 8 chars of template ID
- `started_at`: ISO timestamp in Asia/Jakarta timezone
- `leads_queued`: Count of leads successfully queued

### Enhanced Logging

The scheduler now provides detailed logging for crawl session updates:

```
✅ Updated crawl session for scheduled run
   is_active: True
   source: scheduled
   leads_queued: 150
```

This helps with debugging and monitoring scheduled crawl executions.

### Benefits

- **Eliminates thread-safety issues**: No database queries in background threads
- **Improves reliability**: Scheduled jobs execute without connection errors
- **Maintains functionality**: Session tracking still works with simplified template names
- **Better debugging**: Enhanced logging shows exact session state

### Migration Notes

If you're upgrading from an older version:
1. No database schema changes required
2. No configuration changes needed
3. Existing schedules continue to work
4. Template names in session data will use new format: `"Template {id[:8]}"`


## 🔄 Scheduler Service Template Name Resolution

The scheduler service (`backend/api/scheduler_service.py`) now retrieves template names from the database during scheduled crawl execution for better session tracking.

### Template Name Retrieval

**Implementation**: When a scheduled job executes, the scheduler queries Supabase to get the actual template name:

```python
# Get template name from database
try:
    from helper.supabase_helper import SupabaseManager
    supabase_manager = SupabaseManager()
    template = supabase_manager.get_template_by_id(template_id)
    template_name = template.get('name', 'Unknown Template') if template else f"Template {template_id[:8]}"
except Exception as e:
    print(f"⚠️ Failed to get template name: {e}")
    template_name = f"Template {template_id[:8]}"
```

### Fallback Behavior

If the database query fails (connection issues, template not found, etc.), the scheduler falls back to a simplified format:
- Format: `"Template {template_id[:8]}"`
- Example: `"Template 38a1699d"`

This ensures the crawl session is always updated with a valid template name, even if the database is temporarily unavailable.

### Benefits

- **Better UX**: Dashboard displays actual template names instead of truncated IDs
- **Improved Tracking**: Session data includes human-readable template information
- **Error Resilience**: Fallback ensures crawl execution continues even if template lookup fails
- **Debugging**: Easier to identify which template is being crawled in logs and UI

### Crawl Session Data

The `current_crawl_session` now includes the resolved template name:

```python
{
    'is_active': True,
    'source': 'scheduled',
    'schedule_id': 'uuid',
    'schedule_name': 'Daily Morning Crawl',
    'template_id': 'uuid',
    'template_name': 'Backend Developer - Jakarta',  # Actual name from database
    'started_at': '2026-03-10T14:30:00+07:00',
    'leads_queued': 150
}
```

### Console Output

**Success:**
```
📝 Template Name: Backend Developer - Jakarta
✅ Updated crawl session for scheduled run
```

**Fallback:**
```
⚠️ Failed to get template name: Connection timeout
📝 Template Name: Template 38a1699d
✅ Updated crawl session for scheduled run
```

### Related Components

- `helper/supabase_helper.py` - Contains `SupabaseManager.get_template_by_id()` method
- `backend/api/main.py` - Contains `current_crawl_session` global variable
- `backend/api/scheduler_service.py` - Executes scheduled crawls and updates session

### Migration Notes

- No database schema changes required
- No configuration changes needed
- Existing schedules automatically benefit from improved template name resolution
- If `SupabaseManager.get_template_by_id()` doesn't exist, add it to `helper/supabase_helper.py`

## 🔄 Schedule Status Management (Database Layer)

The `ScheduleManager` class in `backend/api/helper/supabase_helper.py` now includes a method for updating schedule status programmatically.

### Method: `update_schedule_status`

Updates the status of a crawler schedule between 'active' and 'inactive' states.

#### Signature
```python
@staticmethod
def update_schedule_status(schedule_id: str, is_active: bool) -> bool
```

#### Parameters
- `schedule_id` (str): UUID of the schedule to update
- `is_active` (bool): `True` to set status to 'active', `False` to set to 'inactive'

#### Returns
- `bool`: `True` if update was successful, `False` if schedule not found or update failed

#### Implementation
```python
@staticmethod
def update_schedule_status(schedule_id: str, is_active: bool) -> bool:
    """Update schedule status (active/inactive)"""
    try:
        status = 'active' if is_active else 'inactive'
        response = supabase.table('crawler_schedules').update({
            'status': status
        }).eq('id', schedule_id).execute()
        
        if response.data:
            print(f"✅ Schedule {schedule_id} status updated to: {status}")
            return True
        else:
            print(f"⚠️ No schedule found with ID: {schedule_id}")
            return False
            
    except Exception as e:
        print(f"❌ Error updating schedule status: {e}")
        return False
```

### Console Output

**Success:**
```
✅ Schedule abc-123-def status updated to: active
```

**Schedule Not Found:**
```
⚠️ No schedule found with ID: abc-123-def
```

**Error:**
```
❌ Error updating schedule status: Connection timeout
```

### Usage Examples

```python
from helper.supabase_helper import ScheduleManager

# Activate a schedule
success = ScheduleManager.update_schedule_status('schedule-uuid', True)
if success:
    print("Schedule activated successfully")

# Deactivate a schedule
success = ScheduleManager.update_schedule_status('schedule-uuid', False)
if success:
    print("Schedule deactivated successfully")
```

### Use Cases

- **Programmatic Schedule Control**: Enable/disable schedules from code
- **Batch Operations**: Update multiple schedule statuses in loops
- **Integration**: Use in webhook handlers or external system integrations
- **Automation**: Automatically activate/deactivate schedules based on conditions
- **Error Recovery**: Deactivate problematic schedules programmatically

### Database Schema

The method updates the `crawler_schedules` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (used for lookup) |
| `status` | String | Schedule status ('active' or 'inactive') |

### Related Components

- `backend/api/main.py` - API endpoints that use schedule status
- `backend/api/scheduler_service.py` - Scheduler that respects active/inactive status

## 📊 Crawler Status API Endpoint

The API provides a comprehensive crawler status endpoint that returns real-time information about the current crawling session and queue state.

### Endpoint: POST `/api/scraping/stop`

**Note**: This endpoint was updated to provide crawler status instead of stopping functionality.

#### Response
```json
{
  "is_running": true,
  "queue_size": 25,
  "template_id": "38a1699d-ad54-4f05-9483-e3d35142d35f",
  "template_name": "Backend Developer - Jakarta",
  "processed_count": 150
}
```

#### Response Fields
- `is_running` (boolean): Whether the crawler is currently active
- `queue_size` (integer): Number of jobs remaining in the RabbitMQ queue
- `template_id` (string|null): UUID of the template being processed
- `template_name` (string|null): Human-readable name of the current template
- `processed_count` (integer): Number of leads queued in the current session

#### Features

**Real-time Queue Monitoring:**
- Queries RabbitMQ to get current queue size
- Determines if crawler is running based on queue size and session state
- Handles RabbitMQ connection errors gracefully

**Automatic Session Completion:**
- Auto-completes crawl session when queue becomes empty
- Calls `check_and_complete_session()` to update session state
- Ensures status accuracy after crawl completion

**Session Data Integration:**
- Returns data from global `current_crawl_session` object
- Includes template information for context
- Shows leads queued count from session start

#### Usage Examples

```bash
# Get current crawler status
curl -X POST http://localhost:8000/api/scraping/stop

# Response when crawler is active
{
  "is_running": true,
  "queue_size": 15,
  "template_id": "abc-123-def",
  "template_name": "Frontend Developer",
  "processed_count": 75
}

# Response when crawler is idle
{
  "is_running": false,
  "queue_size": 0,
  "template_id": null,
  "template_name": null,
  "processed_count": 0
}
```

#### Error Handling

If RabbitMQ connection fails:
- `queue_size` defaults to 0
- `is_running` determined from session state only
- Error logged to console: `"Error getting queue info: [error message]"`

If session completion fails:
- Returns current session state
- Error logged but doesn't affect response
- Status may show as running until next check

#### Integration

This endpoint is typically used by:
- **Dashboard UI**: Real-time status display
- **Monitoring Systems**: Health checks and alerts
- **Automation Scripts**: Wait for crawl completion
- **Debug Tools**: Troubleshoot crawler state issues

#### Related Components

- `helper.rabbitmq_helper.queue_publisher.get_queue_info()` - Queue size retrieval
- `check_and_complete_session()` - Session completion logic
- `current_crawl_session` - Global session state object
- `CrawlerStatusResponse` - Pydantic response model

#### Migration Note

This endpoint was previously used for stopping the crawler but has been repurposed to provide status information. For stopping crawler functionality, use the dedicated stop endpoint if available.s

## 🤖 Automatic Crawl Session Completion

The API now includes automatic crawl session completion functionality that monitors queue status and automatically completes crawl sessions when processing is finished.

### Feature Overview

The `check_and_complete_session()` function automatically:
- Monitors RabbitMQ queue size during active crawl sessions
- Completes crawl sessions when queue becomes empty
- Auto-deactivates schedules that triggered the completed crawl
- Resets session state to idle for accurate status reporting

### Implementation

**Automatic Checking**: The session completion check is triggered when:
- Getting crawl session status via `GET /api/crawler/session`
- Any endpoint that queries the current session state

**Session Completion Logic**:
```python
async def check_and_complete_session():
    """Check if crawl session should be automatically completed"""
    global current_crawl_session
    
    # Only check if session is currently active
    if not current_crawl_session.get('is_active', False):
        return
    
    # Get current queue size
    queue_info = queue_publisher.get_queue_info()
    queue_size = queue_info.get('messages', 0) if queue_info else 0
    
    # If queue is empty, session should be completed
    if queue_size == 0:
        # Auto-deactivate schedule if this was a scheduled crawl
        if current_crawl_session.get('source') == 'scheduled':
            schedule_id = current_crawl_session.get('schedule_id')
            ScheduleManager.update_schedule_status(schedule_id, False)
        
        # Clear the crawl session
        current_crawl_session = {
            'is_active': False,
            'source': None,
            'schedule_id': None,
            'schedule_name': None,
            'template_id': None,
            'template_name': None,
            'started_at': None,
            'leads_queued': 0
        }
```

### Auto-Schedule Deactivation

**Scheduled Crawl Behavior**: When a crawl session was triggered by a schedule:
- The system automatically deactivates the schedule when crawling completes
- Prevents the same schedule from running again until manually reactivated
- Provides control over one-time vs recurring crawl operations

**Console Output**:
```
🏁 Queue is empty - completing crawl session
✅ Auto-deactivated schedule: Daily LinkedIn Crawl (ID: abc-123-def) - crawling completed
✅ Crawl session auto-completed - status now idle
```

### Benefits

- **Automatic Cleanup**: No manual intervention needed to complete crawl sessions
- **Accurate Status**: Dashboard always shows correct crawler state
- **Schedule Control**: Prevents runaway scheduled crawls
- **Resource Management**: Frees up session tracking when processing is complete
- **User Experience**: Real-time status updates without manual refresh

### Session State Synchronization

The automatic completion ensures:
- **Queue State Sync**: Session state matches actual queue processing status
- **Dashboard Accuracy**: UI shows correct "idle" vs "running" status
- **API Consistency**: All endpoints return consistent session information
- **Schedule Coordination**: Scheduled vs manual crawls are properly tracked

### Error Handling

The completion check includes robust error handling:
- **Queue Connection Errors**: Gracefully handles RabbitMQ connectivity issues
- **Schedule Update Failures**: Logs errors but doesn't interrupt session completion
- **Exception Isolation**: Errors in completion check don't affect other API operations

### Related Endpoints

- `GET /api/crawler/session` - Triggers automatic completion check
- `POST /api/crawler/stop` - Manual session completion (still available)
- `POST /api/schedules/{id}/execute` - Creates sessions that can be auto-completed

### Configuration

No additional configuration required. The feature uses existing:
- RabbitMQ connection settings for queue monitoring
- Schedule management for auto-deactivation
- Session tracking variables for state management

### Migration Notes

- **Backward Compatible**: Existing manual session management still works
- **No Schema Changes**: Uses existing database tables and queue infrastructure
- **Automatic Activation**: Feature is active immediately after API update
- **Graceful Degradation**: Falls back to manual completion if auto-completion failss
- `helper/supabase_helper.py` - Contains `ScheduleManager` class

### Migration Notes

- No database schema changes required (assumes `status` column exists)
- Method is static, can be called without instantiating `ScheduleManager`
- Compatible with existing schedule management workflows
- Follows the same error handling pattern as other `ScheduleManager` methods

## 🔄 Session Monitor Task (API Background Service)

The API backend now includes a background session monitoring task that automatically tracks and manages crawler session completion.

### Background Task Implementation

**Session Monitor Task (`session_monitor_task`):**
- Runs as an async background task during API lifecycle
- Monitors crawler session state every 10 seconds
- Automatically detects when crawl sessions should be marked as complete
- Provides graceful shutdown handling with proper cleanup

### Task Lifecycle

**Startup:**
```python
async def session_monitor_task():
    """Background task to monitor session completion"""
    global background_task_running
    background_task_running = True
    
    print("🔄 Session monitor task started")
    
    try:
        while background_task_running:
            await asyncio.sleep(10)  # Check every 10 seconds
            await check_and_complete_session()
    except asyncio.CancelledError:
        print("🛑 Session monitor task cancelled")
    except Exception as e:
        print(f"❌ Session monitor task error: {e}")
    finally:
        background_task_running = False
        print("🔄 Session monitor task stopped")
```

### Features

- **Automatic Session Completion**: Detects when crawler jobs finish and updates session state accordingly
- **Error Resilience**: Continues running even if individual monitoring cycles fail
- **Graceful Shutdown**: Properly handles cancellation during API shutdown
- **Status Tracking**: Maintains global `background_task_running` flag for monitoring
- **Console Logging**: Provides clear status updates for debugging and monitoring

### Console Output

**Task Startup:**
```
🔄 Session monitor task started
```

**Task Shutdown:**
```
🛑 Session monitor task cancelled
🔄 Session monitor task stopped
```

**Error Handling:**
```
❌ Session monitor task error: Connection timeout
🔄 Session monitor task stopped
```

### Integration

The session monitor task integrates with:
- **Crawler Session State**: Monitors `current_crawl_session` global variable
- **Queue Status**: Checks RabbitMQ queue sizes to determine completion
- **Database Updates**: Updates session completion timestamps in Supabase
- **API Lifecycle**: Starts with API startup, stops with API shutdown

### Benefits

- **Automated Management**: No manual intervention required for session completion
- **Real-time Monitoring**: Continuous monitoring ensures timely session updates
- **Resource Efficiency**: Lightweight background task with minimal resource usage
- **Reliability**: Error handling ensures the monitor doesn't crash the API
- **Observability**: Clear logging for debugging and operational monitoring

### Technical Details

**Monitoring Interval**: 10 seconds between checks
**Task Type**: Async background task using `asyncio`
**Error Handling**: Try-catch blocks prevent task crashes
**Cleanup**: Automatic cleanup on task cancellation or completion
**State Management**: Uses global `background_task_running` flag

### Related Components

- `backend/api/main.py` - Contains session monitor task implementation
- `current_crawl_session` - Global session state being monitored
- `check_and_complete_session()` - Function called by monitor (to be implemented)
- RabbitMQ queues - Monitored for completion detection

### Future Enhancements

The session monitor task provides a foundation for:
- Automatic session timeout handling
- Performance metrics collection
- Queue health monitoring
- Crawler job failure detection
- Session analytics and reporting

### Migration Notes

- No configuration changes required
- Task starts automatically with API
- No database schema changes needed
- Existing session management continues to work
- Monitor task runs independently of other API operations

## 🧹 API Code Cleanup (Duplicate Function Removal)

The API backend (`backend/api/main.py`) has been cleaned up to remove duplicate function definitions that could cause conflicts.

### Changes Made

**Duplicate Function Removal:**
- Removed duplicate `stop_scraping` function at line 871
- Kept the main implementation at line 1816 with full functionality
- Added comment indicating the removal: `# Removed duplicate stop_scraping function - using the one at line 1816`

### Why This Matters

**Code Quality:**
- Eliminates potential conflicts between duplicate function definitions
- Ensures only one authoritative implementation exists
- Prevents confusion during debugging and maintenance
- Follows Python best practices for function definition

**Functionality Preserved:**
- The remaining `stop_scraping` function includes all features:
  - Queue purging via RabbitMQ
  - Session state management
  - Schedule deactivation
  - Error handling and logging
  - Response formatting

### Affected Endpoint

- `POST /api/scraping/stop` - Stop scraping and clear session

The endpoint functionality remains unchanged - only the duplicate code has been removed.

### Benefits

- **Cleaner Codebase**: Eliminates redundant code
- **Reduced Maintenance**: Single function to maintain instead of duplicates
- **Better Reliability**: No risk of inconsistent behavior between duplicate implementations
- **Improved Readability**: Clearer code structure without duplicates

### Migration Notes

- No API changes - endpoint behavior is identical
- No configuration changes required
- No database schema changes needed
- Existing integrations continue to work without modification

This cleanup is part of ongoing code quality improvements to maintain a clean and maintainable codebase.

## 🛠️ Stop Scraping Endpoint Improvements

The stop scraping endpoint (`POST /api/scraping/stop`) has been enhanced with improved error handling and schedule management.

### Code Cleanup

**Duplicate Endpoint Removal**: A duplicate endpoint definition was removed from line 903 in `backend/api/main.py`. The correct implementation remains at line 1822. This cleanup eliminates code duplication and potential conflicts between endpoint definitions.

### Recent Improvements

**Enhanced Schedule Management:**
- Added explicit import of `ScheduleManager` within the function scope
- Improved schedule deactivation logic for both manual and scheduled crawls
- Better error isolation for schedule status updates

**Improved Error Handling:**
- Added comprehensive error logging with `print(f"❌ Error in stop_scraping: {str(e)}")`
- Enhanced debugging output for troubleshooting stop operations
- Graceful handling of schedule deactivation failures

### Implementation Details

**Schedule Deactivation Logic:**
```python
# Always deactivate schedule if it was running (both manual and automatic)
if schedule_id:
    try:
        from helper.supabase_helper import ScheduleManager
        schedule_manager = ScheduleManager()
        schedule_manager.update_schedule_status(schedule_id, False)
        print(f"✅ Deactivated schedule: {schedule_name} (ID: {schedule_id})")
    except Exception as e:
        print(f"⚠️ Failed to deactivate schedule: {e}")
```

**Error Logging:**
- All exceptions are now logged with detailed error messages
- Helps identify issues with queue purging or schedule deactivation
- Maintains API error response while providing debugging information

### Benefits

- **Better Debugging**: Enhanced error logging helps identify issues quickly
- **Reliable Schedule Management**: Improved schedule deactivation with proper error handling
- **Consistent State**: Ensures crawler session and schedule status stay synchronized
- **Error Isolation**: Schedule deactivation failures don't prevent queue purging

### Console Output

When stopping the crawler, you'll see enhanced logging:
```
🛑 Stop scraping requested - purging queue
✅ Deactivated schedule: Daily Morning Crawl (ID: abc-123-def)
✅ Crawler session cleared - status now idle
```

If errors occur:
```
⚠️ Failed to deactivate schedule: Connection timeout
❌ Error in stop_scraping: Queue purge failed
```

### Related Components

- `helper/supabase_helper.py` - Contains `ScheduleManager` class for schedule operations
- `helper/rabbitmq_helper.py` - Handles queue purging operations
- `backend/api/main.py` - Contains the stop scraping endpoint implementation

### Migration Notes

- No API changes required - endpoint signature remains the same
- Enhanced logging provides better visibility into stop operations
- Existing clients continue to work without modification
- Improved error handling makes the endpoint more reliable in production environments