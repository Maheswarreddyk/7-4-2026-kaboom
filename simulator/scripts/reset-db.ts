import { execSync } from 'child_process';
import path from 'path';

// Get the path to the root directory where the 'supabase' folder lives
const rootDir = path.resolve(process.cwd(), '..');

console.log('🔄 Resetting local Supabase database...');
try {
  // Execute supabase db reset. This will drop all tables, apply migrations, and run seed.sql.
  execSync('npx supabase db reset', { cwd: rootDir, stdio: 'inherit' });
  console.log('✅ Local database reset successfully.');
} catch (error) {
  console.error('❌ Failed to reset database:', error);
  process.exit(1);
}
