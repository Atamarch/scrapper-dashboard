# Sarana AI - Scrapper Dashboard

Dashboard untuk mengelola leads dan templates dengan integrasi Supabase.

## Fitur

- **Dashboard**: Menampilkan statistik total leads, total jobs, dan total companies
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
- score (numeric) - Lead qualification score
- scored_at (timestamp) - When the lead was scored
- processed_at (timestamp) - When the lead was processed
- sent_at (timestamp) - When the outreach message was sent to the lead

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
- Real-time data dari Supabase (total leads, total jobs, total companies)
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


## Custom Hooks

### useMascotAnimation (`frontend/hooks/useMascotAnimation.ts`)

A React hook that provides GSAP-powered animations for an interactive mascot character with eye tracking, blinking, and expressive behaviors.

#### Features

**1. Automatic Idle Blinking**
- Random blink intervals (4-6 seconds)
- Smooth eyelid animation using scaleY transform
- Automatically starts on mount and stops on unmount

**2. Eye Tracking**
- Pupil movement follows cursor/input position
- Clamped movement range (-6 to 6 pixels)
- Smooth transitions with power3 easing
- Enable/disable tracking on demand

**3. Expressive States**
- **Close Eyes**: Morphs eye shapes to closed curved lines, hides pupils
- **Peek One Eye**: Opens left eye partially (35%) with playful bounce
- **Reset to Idle**: Returns to normal state with centered pupils and resumes blinking

#### Usage

```typescript
import { useMascotAnimation } from '@/hooks/useMascotAnimation';
import { useRef } from 'react';

function MascotComponent() {
  // Create refs for SVG elements
  const leftEye = useRef<SVGGElement>(null);
  const rightEye = useRef<SVGGElement>(null);
  const leftPupil = useRef<SVGCircleElement>(null);
  const rightPupil = useRef<SVGCircleElement>(null);
  const leftEyeShape = useRef<SVGPathElement>(null);
  const rightEyeShape = useRef<SVGPathElement>(null);

  const {
    enableTracking,
    disableTracking,
    movePupil,
    closeEyes,
    peekOneEye,
    resetToIdle,
  } = useMascotAnimation({
    leftEye,
    rightEye,
    leftPupil,
    rightPupil,
    leftEyeShape,
    rightEyeShape,
  });

  // Example: Track input field focus
  const handleFocus = () => {
    enableTracking();
  };

  const handleBlur = () => {
    disableTracking();
    resetToIdle();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percentX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    movePupil(percentX);
  };

  return (
    <svg>
      {/* SVG mascot structure */}
    </svg>
  );
}
```

#### API Reference

**Parameters:**
- `refs: MascotRefs` - Object containing refs to SVG elements

**Returns:**
- `blink()` - Trigger a single blink animation
- `enableTracking()` - Enable pupil tracking
- `disableTracking()` - Disable pupil tracking
- `movePupil(percentX: number)` - Move pupils horizontally (-1 to 1 range)
- `closeEyes()` - Close eyes with smooth morph animation
- `peekOneEye()` - Open left eye partially with bounce effect
- `resetToIdle()` - Return to normal state and resume blinking

#### Dependencies

- `gsap` - Animation library for smooth transitions and morphing
- `react` - For hooks and refs

#### Animation Details

**Eye Shapes:**
- Eyes are rendered as SVG circles with dynamic radius
- Open: `r="12"` (full circle)
- Closed: `r="1"` (minimal dot)
- Peeking: `r="4"` (35% open - left eye only)

**Blink Animation:**
- Uses radius morphing instead of scale transforms
- Shrinks from top with `transformOrigin: 'center top'`
- Close phase: radius 12 → 1 (80ms, power2.in easing)
- Open phase: radius 1 → 12 (120ms, power2.out easing)
- Total blink duration: 200ms

**Close Eyes Animation:**
- Hides pupils completely with opacity fade and scale to 0 (150ms)
- Shrinks eye shape radius to 1 (300ms, power2.inOut easing)
- Shows eyebrows with fade-in (200ms, starts at 100ms)
- All animations run in parallel for smooth coordinated effect
- Simplified implementation: removed eye group opacity fade for cleaner visual effect

**Timing:**
- Blink duration: 200ms (80ms close + 120ms open)
- Pupil movement: 250ms with power3.out easing
- Eye morph (close/peek): 300ms with power2.inOut easing
- Peek animation: 250ms with power2.out easing
- Close eyes: 300ms total (pupils fade + eye group dim + shape shrink + eyebrows appear)
