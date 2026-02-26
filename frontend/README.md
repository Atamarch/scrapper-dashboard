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
- requirements (jsonb) - Job requirements configuration

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


## TypeScript Types

### Template Type (`frontend/lib/supabase.ts`)

The `Template` type represents a job template/requirement in the system:

```typescript
export type Template = {
  id: string;
  company_id: string;
  name: string;
  job_title: string;
  url: string;
  note: string;
  created_at: string;
  requirements: any; // JSONB field containing job requirements configuration
};
```

#### Requirements Field
The `requirements` field stores job-specific criteria as a JSON object. This field is used to:
- Define candidate requirements for the position
- Store scoring criteria and weights
- Configure matching rules for lead qualification

**Usage Example:**
```typescript
// Accessing requirements from a template
const template: Template = await fetchTemplate(templateId);
const requirements = template.requirements;

// Requirements structure (example)
{
  "position": "Desk Collection - BPR KS Bandung",
  "required_skills": {
    "Desk Collection": 1,
    "Call Collection": 1
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

**Components Using Requirements:**
- `templates-modal.tsx` - Displays requirements in JSON preview modal
- `json-preview-modal.tsx` - Renders requirements JSON for viewing
