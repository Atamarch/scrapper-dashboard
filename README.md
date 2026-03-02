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

Retrieve all companies, optionally filtered by platform/code.

#### Query Parameters
- `platform` (string, optional): Filter companies by platform code (case-insensitive partial match)

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
      "code": "mejakita",
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
    "code": "mejakita",
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
| `code` | String | Platform/company code identifier |
| `created_at` | Timestamp | Record creation timestamp |

### Error Handling

Both endpoints return appropriate HTTP status codes:
- `200 OK`: Successful request
- `404 Not Found`: Company not found (single company endpoint)
- `500 Internal Server Error`: Database or server error
- `503 Service Unavailable`: Database connection not available
