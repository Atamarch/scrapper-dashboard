# LinkedIn Crawler & Scoring System

Project ini terdiri dari 3 komponen utama:
1. **Frontend** - Dashboard admin untuk monitoring crawler dan scheduler
2. **Backend Crawler** - Scraping profil LinkedIn
3. **Backend Scoring** - Sistem penilaian kandidat

## 📋 Prerequisites

Pastikan sudah terinstal:
- **Node.js** (v18 atau lebih baru)
- **Python** (v3.8 atau lebih baru)
- **Docker & Docker Compose** (untuk RabbitMQ)
- **Chrome Browser** (untuk Selenium crawler)

## 🚀 Cara Menjalankan Project

⚠️ **PENTING:** Baca [SAFETY.md](SAFETY.md) untuk menghindari deteksi bot oleh LinkedIn!

### 1. Setup RabbitMQ (Message Queue)

RabbitMQ digunakan untuk komunikasi antara crawler dan scoring system.

```bash
# Masuk ke folder crawler
cd backend/crawler

# Jalankan RabbitMQ dengan Docker
docker-compose up -d

# Cek status RabbitMQ
docker ps

# Akses RabbitMQ Management UI
# Buka browser: http://localhost:15672
# Username: guest
# Password: guest
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
│   │   ├── main.py          # CLI interface
│   │   └── docker-compose.yml   # RabbitMQ setup
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

### RabbitMQ tidak bisa connect
```bash
# Cek status container
docker ps

# Restart RabbitMQ
docker-compose restart

# Lihat logs
docker-compose logs -f
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
