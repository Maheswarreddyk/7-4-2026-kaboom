import { spawn } from 'child_process';

console.log("=============================================");
console.log("🔥 STARTING KABOOM BACKEND IN CHAOS MODE 🔥");
console.log("=============================================");

process.env.CHAOS_DB_LATENCY = 'true';

let backendProcess;

function startBackend() {
  console.log("[Chaos] Booting Node.js backend...");
  // Use npx.cmd on windows, with shell: true to prevent EINVAL
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  backendProcess = spawn(cmd, ['tsx', 'src/index.ts'], { stdio: 'inherit', shell: true });
  
  // Random uptime between 15 and 45 seconds
  const uptime = Math.floor(Math.random() * 30000) + 15000;
  console.log(`[Chaos] Backend will be killed in ${uptime / 1000} seconds`);
  
  setTimeout(() => {
    if (backendProcess) {
      console.log("[Chaos] 💥 KILLING BACKEND (Simulated Infrastructure Failure) 💥");
      backendProcess.kill('SIGKILL');
      backendProcess = null;
    }
    
    // Brief downtime before restart (2 to 7 seconds)
    const downtime = Math.floor(Math.random() * 5000) + 2000;
    console.log(`[Chaos] Infrastructure down for ${downtime / 1000} seconds...`);
    setTimeout(startBackend, downtime);
  }, uptime);
}

startBackend();

process.on('SIGINT', () => {
  if (backendProcess) backendProcess.kill('SIGKILL');
  process.exit(0);
});
