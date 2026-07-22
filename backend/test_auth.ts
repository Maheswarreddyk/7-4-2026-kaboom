import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAuth() {
  console.log('Testing Anonymous Auth...');
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
  if (authError) {
    console.error('Auth Error:', authError);
    return;
  }

  const token = authData.session?.access_token;
  console.log('Got JWT:', token ? 'Yes' : 'No');
  if (!token) return;

  console.log('Calling backend /start-session...');
  try {
    const res = await fetch('http://127.0.0.1:8787/api/start-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ browser: 'test', device: 'test', platform: 'test' })
    });
    const data = await res.json();
    console.log('Response:', data);
  } catch(e) {
    console.error('Fetch error:', e);
  }
}

testAuth();
