const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_URL.includes('your-project-id')) {
  console.warn('\x1b[33m%s\x1b[0m', '⚠️  Notice: SUPABASE_URL or SUPABASE_ANON_KEY is not configured in .env. Database/Auth calls will fail until valid credentials are provided.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

module.exports = supabase;
