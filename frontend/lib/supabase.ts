import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Lead = {
  id: string;
  template_id: string | null;
  date: string;
  name: string | null;
  note_sent: string | null;
  search_url: string | null;
  profile_url: string | null;
  connection_status: string | null;
  score: number | null;
  scored_at: string | null;
  processed_at: string | null;
  scoring_data?: {
    results?: Array<{
      id: string;
      label: string;
      matched: boolean;
      candidate_value?: string;
    }>;
    [key: string]: any;
  };
};

export type Company = {
  id: string;
  name: string;
  code: string;
  created_at: string;
};

export type Template = {
  id: string;
  company_id: string;
  name: string;
  job_title: string;
  url: string;
  note: string;
  created_at: string;
  requirements: any;
};

export type Requirement = {
  id: string;
  template_id: string;
  template_name: string;
  value: any;
  created_at: string;
};
