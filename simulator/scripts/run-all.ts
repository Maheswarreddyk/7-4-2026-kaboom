import { spawn, execSync, ChildProcess } from 'child_process';
import path from 'path';
import http from 'http';

import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');

const processes: ChildProcess[] = [];

// Cleanup function to kill all spawned processes on exit
const cleanup = () => {
  console.log('🧹 Cleaning up processes...');
  for (const p of processes) {
    if (!p.killed) {
      // In Windows, sometimes taskkill is needed for deep trees, but we will try standard kill first
      p.kill();
    }
  }
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

const waitForUrl = (url: string, timeoutMs: number = 60000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Timeout waiting for ${url}`));
      }
      const req = http.get(url, (res) => {
        if (res.statusCode === 200 || res.statusCode === 404 || res.statusCode === 302) {
          resolve();
        } else {
          setTimeout(check, 1000);
        }
      });
      req.on('error', () => {
        setTimeout(check, 1000);
      });
      req.end();
    };
    check();
  });
};

async function main() {
  console.log('🚀 Orchestrating Kaboom Digital Twin Full Stack Environment...');

  // 1. Skip local Supabase Docker (using live cloud DB per user request)
  console.log('📦 Using Live Cloud Supabase (Docker bypassed)...');

  // 2. Start Backend
  console.log('⚙️ Starting Backend server...');
  const backendProc = spawn('npm', ['run', 'dev', '-w', 'backend'], { cwd: rootDir, stdio: 'inherit', shell: true });
  processes.push(backendProc);

  // 3. Start Frontend
  console.log('🎨 Starting Frontend server...');
  const frontendProc = spawn('npm', ['run', 'dev:frontend'], { cwd: rootDir, stdio: 'inherit', shell: true });
  processes.push(frontendProc);

  // 4. Wait for services to be reachable
  console.log('⏳ Waiting 15 seconds for Frontend and Backend to compile and start...');
  await new Promise(resolve => setTimeout(resolve, 15000));

  console.log('✅ Services are up! Launching Certification Simulator...');

  // 5. Run the Simulator
  const args = process.argv.slice(2);
  const simulatorArgs = args.length > 0 ? args : ['--users=100']; // default to 100 if none provided

  const simProc = spawn('npx', ['tsx', 'src/index.ts', ...simulatorArgs], { cwd: path.join(rootDir, 'simulator'), stdio: 'inherit', shell: true });
  processes.push(simProc);

  simProc.on('close', (code) => {
    console.log(`[Simulator] Exited with code ${code}`);
    cleanup();
  });
}

main().catch(err => {
  console.error(err);
  cleanup();
});
