# Sarana AI - Lead Management Dashboard

Dashboard untuk mengelola leads dan templates dengan integrasi Supabase.

## Fitur

- **Dashboard**: Menampilkan statistik total leads, connected, pending, conversion rate, dan total templates
- **Leads**: Tabel leads dengan filter by template dan pagination
- **Company**: Grid view companies dengan search, pagination, dan modal untuk view requirements (templates)
- **Authentication**: Login/Sign up page with social OAuth integration and animated UI

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
- `/login` - Authentication page with sign in/sign up functionality

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

### Login/Authentication
- Dual-mode authentication page (Sign In / Sign Up)
- Animated toggle between sign in and sign up modes
- Form fields:
  - Email (both modes)
  - Password with show/hide toggle (both modes)
  - Full Name (sign up only)
  - Forgot password link (sign in only)
- Social authentication buttons:
  - Google OAuth
  - Facebook OAuth
  - Apple OAuth
- Glassmorphism design with decorative cloud elements
- Sarana AI branding with logo display
- Responsive layout with centered card design
- Smooth flip animation when switching modes (300ms transition)

## Authentication & Authorization

### Middleware Protection (`frontend/middleware.ts`)

The application implements route-level authentication and role-based access control using Next.js middleware.

#### Features

**1. Session Management**
- Validates user session on every request using Supabase Auth
- Automatically redirects unauthenticated users to `/login`
- Prevents authenticated users from accessing login page (redirects to dashboard)

**2. Role-Based Access Control (RBAC)**
- Enforces admin-only access to all protected routes
- Checks user role from multiple metadata sources:
  - `user_metadata.role`
  - `app_metadata.role`
  - `raw_app_meta_data.role`
- Automatically signs out non-admin users and redirects to login

**3. Protected Routes**
All routes except the following are protected:
- `/login` - Public authentication page
- `/_next/static/*` - Next.js static assets
- `/_next/image/*` - Next.js image optimization
- `/favicon.ico` - Favicon
- `/logo_sarana_ai.jpg` - Logo image
- Static assets (`.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`)

#### Implementation Details

```typescript
// Middleware flow:
1. Create Supabase client with middleware context
2. Get current session
3. Check if accessing login page:
   - If logged in → redirect to dashboard
   - If not logged in → allow access
4. For all other routes:
   - If not logged in → redirect to login
   - If logged in but not admin → sign out and redirect to login
   - If logged in and admin → allow access
```

#### User Role Configuration

To grant admin access, set the user's role in Supabase:

**Option 1: Via Supabase Dashboard**
1. Go to Authentication → Users
2. Select user
3. Edit user metadata
4. Add: `{ "role": "admin" }`

**Option 2: Via SQL**
```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'user@example.com';
```

#### Security Considerations

- Session validation occurs on every request (server-side)
- Non-admin users are immediately signed out (prevents token reuse)
- Multiple metadata sources checked for role (fallback mechanism)
- Static assets excluded from auth checks (performance optimization)


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
