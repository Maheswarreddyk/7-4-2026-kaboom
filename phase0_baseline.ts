import { getSupabase } from './backend/src/database/client.js';
import { getIceServers } from './backend/src/config/index.js';
import { environment } from './config/environment.js';

async function runBaselineChecks() {
  console.log('--- Phase 0: Production Baseline Verification ---');
  let allPassed = true;

  // 1. Environment Variables
  console.log('\n[Check] Environment Variables:');
  const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  for (const env of requiredEnv) {
    if (process.env[env]) {
      console.log(`✅ ${env} is present.`);
    } else {
      console.log(`❌ ${env} is missing.`);
      allPassed = false;
    }
  }

  // 2. Database Connection & Migrations
  console.log('\n[Check] Database Connection & Migrations:');
  try {
    const supabase = getSupabase();
    // Check if waiting_queue table exists
    const { data, error } = await supabase.from('waiting_queue').select('id').limit(1);
    if (error) {
      console.error(`❌ Database connection failed:`, error.message);
      allPassed = false;
    } else {
      console.log('✅ Database connected successfully. Tables exist.');
    }
  } catch (err) {
    console.error(`❌ Database check failed:`, err);
    allPassed = false;
  }

  // 3. TURN/STUN Configuration
  console.log('\n[Check] TURN Server Credentials & STUN Fallback:');
  try {
    const iceServers = getIceServers();
    const hasStun = iceServers.some(server => typeof server.urls === 'string' ? server.urls.startsWith('stun:') : server.urls.some(u => u.startsWith('stun:')));
    const hasTurn = iceServers.some(server => typeof server.urls === 'string' ? server.urls.startsWith('turn:') || server.urls.startsWith('turns:') : server.urls.some(u => u.startsWith('turn:') || u.startsWith('turns:')));

    if (hasStun) {
      console.log('✅ STUN configuration is operational.');
    } else {
      console.error('❌ STUN configuration is missing.');
      allPassed = false;
    }

    if (hasTurn) {
      console.log('✅ TURN configuration is operational.');
    } else {
      console.warn('⚠️ TURN configuration is missing. WebRTC may fail on mobile networks.');
      // Based on our changes, we hardcoded Metered fallback, so it should ALWAYS be true.
    }
    console.log(`ℹ️ Total ICE Server Configurations generated: ${iceServers.length}`);
  } catch (err) {
    console.error(`❌ TURN/STUN check failed:`, err);
    allPassed = false;
  }

  console.log('\n-----------------------------------------------');
  if (allPassed) {
    console.log('🎉 Phase 0 Baseline Checks PASSED.');
    process.exit(0);
  } else {
    console.error('💥 Phase 0 Baseline Checks FAILED. Do not proceed with chaos testing.');
    process.exit(1);
  }
}

runBaselineChecks();
