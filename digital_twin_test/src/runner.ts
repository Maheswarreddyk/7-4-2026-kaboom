import { chromium, Browser } from 'playwright';
import { config } from './config';
import { UserSimulation } from './UserSimulation';
import { UserBehavior, ScenarioConfig } from './types';
import { store } from './store';
import { dashboardEmitter } from './dashboard/server';
import { startSupabaseWatcher } from './SupabaseWatcher';

(global as any).dashboardEmitter = dashboardEmitter;

// Helper to get a random behavior based on specified distribution
function getRandomBehavior(): UserBehavior {
  const rand = Math.random();
  if (rand < 0.6) return 'HAPPY_PATH';       // 60% standard successful 3m chat
  if (rand < 0.7) return 'SKIP_EARLY';       // 10% skips early
  if (rand < 0.8) return 'HARD_CLOSE';       // 10% hard closes browser
  if (rand < 0.9) return 'ABANDON_QUEUE';    // 10% abandons queue before match
  return 'NETWORK_INTERRUPT';                // 10% other/network interrupt (to be fully implemented)
}

function generateScenarios(): ScenarioConfig[] {
  const scenarios: ScenarioConfig[] = [];
  
  const total = config.TOTAL_USERS;
  const numRandom = Math.floor(total * 0.4);
  const numSmart = Math.floor(total * 0.3);
  const numExact = total - numRandom - numSmart;
  
  for(let i=0; i<numRandom; i++) {
    scenarios.push({
      mode: 'RANDOM',
      tags: [],
      namePrefix: `RandomMatch_${(i+1).toString().padStart(3, '0')}`
    });
  }

  const smartTags = [
    ['Gaming', 'Travel', 'Music'],
    ['Gaming', 'Movies', 'Travel'],
    ['Music', 'Photography', 'Cooking'],
    ['Reading', 'Travel', 'Movies'],
    ['Gaming', 'Fitness', 'Music']
  ];
  for(let i=0; i<numSmart; i++) {
    scenarios.push({
      mode: 'PREFER',
      tags: smartTags[i % smartTags.length],
      namePrefix: `SmartMatch_${(i+1).toString().padStart(3, '0')}`
    });
  }

  const exactTags = [
    ['Gaming', 'Travel', 'Music'], 
    ['Movies', 'Fitness', 'Technology'], 
    ['Photography', 'Cooking', 'Reading'], 
  ];
  for(let i=0; i<numExact; i++) {
    scenarios.push({
      mode: 'STRICT',
      tags: exactTags[Math.floor(i / (numExact/3)) || 0] || exactTags[0], 
      namePrefix: `ExactMatch_${(i+1).toString().padStart(3, '0')}`
    });
  }

  return scenarios;
}

// Generate arrival times using uniform distribution over the duration window
function generateArrivalTimes(totalUsers: number, durationMinutes: number): number[] {
  const durationMs = durationMinutes * 60 * 1000;
  const times: number[] = [];
  for (let i = 0; i < totalUsers; i++) {
    times.push(Math.random() * durationMs);
  }
  return times.sort((a, b) => a - b);
}

async function run() {
  const scenarios = generateScenarios();
  const totalUsers = scenarios.length; // 90
  console.log(`[Runner] Starting Digital Twin Load Test with ${totalUsers} users over ${config.DURATION_MINUTES} minutes.`);
  startSupabaseWatcher();

  // We'll spawn a few browser instances to distribute the contexts and avoid thread starvation.
  const numBrowsers = Math.min(10, Math.ceil(totalUsers / 50));
  const browsers: Browser[] = [];
  for (let i = 0; i < numBrowsers; i++) {
    browsers.push(await chromium.launch({
      headless: config.HEADLESS,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    }));
  }

  const arrivalTimes = generateArrivalTimes(totalUsers, config.DURATION_MINUTES);
  const startTime = Date.now();
  let completedCount = 0;

  const promises = arrivalTimes.map(async (delay, index) => {
    // Wait until the scheduled arrival time
    const waitTime = Math.max(0, (startTime + delay) - Date.now());
    await new Promise(resolve => setTimeout(resolve, waitTime));

    const browser = browsers[index % numBrowsers];
    const context = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });

    const behavior = getRandomBehavior();
    const scenario = scenarios[index];
    const sim = new UserSimulation(context, behavior, scenario);
    
    console.log(`[Runner] Spawned User ${sim.userId} with behavior ${behavior} / ${scenario.mode}`);
    
    try {
      await sim.run();
    } catch (e) {
      console.error(`[Runner] User ${sim.userId} threw uncaught error:`, e);
    } finally {
      completedCount++;
      console.log(`[Runner] User ${sim.userId} finished. (${completedCount}/${totalUsers})`);
      store.saveReport(); // Periodically save report
    }
  });

  await Promise.all(promises);

  console.log(`[Runner] All ${config.TOTAL_USERS} users completed.`);
  
  for (const b of browsers) {
    await b.close();
  }
  
  store.saveReport();
  console.log(`[Runner] Final report saved. Simulation complete.`);
}

run().catch(console.error);
