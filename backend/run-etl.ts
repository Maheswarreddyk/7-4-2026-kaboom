import { etlService } from './src/analytics/etlService.js';
import { getSupabase } from './src/database/client.js';
import dotenv from 'dotenv';
dotenv.config();

async function runEtl() {
  console.log('Running ETL Sync...');
  try {
    const res = await etlService.syncAnalytics();
    console.log('ETL Sync Result:', res);
  } catch (err) {
    console.error('ETL Sync Failed:', err);
  }
}

runEtl();
