import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  SUPABASE_URL: process.env.TEST_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.TEST_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  TARGET_URL: process.env.TARGET_URL || 'http://localhost:5173',
  TOTAL_USERS: parseInt(process.env.TOTAL_USERS || '50', 10),
  DURATION_MINUTES: parseInt(process.env.DURATION_MINUTES || '5', 10),
  HEADLESS: process.env.HEADLESS !== 'false',
};

if (!config.SUPABASE_URL || !config.SUPABASE_KEY) {
  throw new Error('Missing Supabase credentials in .env');
}
