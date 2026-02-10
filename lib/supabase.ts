import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hzkgpdnlkihnlosxwwig.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6a2dwZG5sa2lobmxvc3h3d2lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2ODQ1NzYsImV4cCI6MjA4MzI2MDU3Nn0.M8aoPh1BrSGr47ix0Fd9jUJdK16Vd_MIge4uXKcHlHc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Lead = {
  id: string;
  template_id: string;
  date: string;
  name: string;
  note_sent: string;
  search_url: string;
  profile_url: string;
  connection_status: string;
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
};
