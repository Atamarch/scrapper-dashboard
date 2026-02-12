// Script untuk create admin user
// Run: node scripts/create-admin.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hzkgpdnlkihnlosxwwig.supabase.co';
const supabaseServiceKey = 'YOUR_SERVICE_ROLE_KEY'; // Ganti dengan service role key dari Supabase

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdmin() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@example.com',
    password: 'admin123',
    email_confirm: true,
    user_metadata: {
      role: 'admin'
    }
  });

  if (error) {
    console.error('Error creating admin:', error);
  } else {
    console.log('Admin created successfully:', data);
  }
}

createAdmin();
