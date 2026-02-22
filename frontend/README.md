# Sarana AI - Lead Management Dashboard

Dashboard untuk mengelola leads dan templates dengan integrasi Supabase.

## Fitur

- **Dashboard**: Menampilkan statistik total leads, connected, pending, conversion rate, dan total templates
- **Leads**: Tabel leads dengan filter by template dan pagination
- **Company**: Grid view companies dengan search, pagination, dan modal untuk view requirements (templates)

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Supabase
- Lucide Icons
- React Hot Toast (Toast notifications)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Jalankan development server:
```bash
npm run dev
```

3. Buka [http://localhost:3000](http://localhost:3000)

## Struktur Database Supabase

### Table: leads_list
- id (uuid, primary key)
- template_id (uuid, foreign key → search_templates.id)
- date (date)
- name (text)
- note_sent (text)
- search_url (text)
- profile_url (text)
- connection_status (text)

### Table: search_templates
- id (uuid, primary key)
- company_id (uuid, foreign key → companies.id)
- name (text)
- job_title (text)
- url (text)
- note (text)
- created_at (timestamp)

### Table: companies
- id (uuid, primary key)
- name (text)
- code (text, unique)
- created_at (timestamp)

## Relasi Database

```
companies (1) ──→ (N) search_templates (1) ──→ (N) leads_list
```

- Satu company bisa punya banyak templates
- Satu template bisa punya banyak leads

## Navigasi

- `/` - Dashboard dengan statistik
- `/leads` - Daftar leads dengan filter template
- `/company` - Daftar companies dengan search dan modal requirements

## Fitur Detail

### Dashboard
- Card statistik dengan animasi loading
- Real-time data dari Supabase (total leads, connected, pending, conversion rate, total templates)
- Icon untuk setiap metrik

### Leads
- Filter by template (dropdown)
- Pagination (10 items per page)
- Link ke profile eksternal
- Status badge dengan warna dinamis (connected, pending, dll)
- URL parameter support untuk filter template

### Company
- Search by name atau code
- Pagination (9 items per page)
- Card layout dengan grid responsive
- Button "View Requirements" yang membuka modal
- Modal menampilkan templates dari company tersebut dengan:
  - Search by name atau job title
  - Pagination (6 items per page)
  - Button "View Leads" yang redirect ke leads page dengan filter template
