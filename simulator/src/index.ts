import { ArgumentParser } from 'argparse';
import { generateUsers } from './generator.js';
import { SimulationRunner } from './runner.js';
import { DatabaseCleaner } from './cleaner.js';

async function main() {
  const parser = new ArgumentParser({
    description: 'Kaboom Digital Twin Matchmaking Simulator',
  });

  parser.add_argument('--users', { type: 'int', default: 1000, help: 'Number of simulated users (e.g. 1000, 5000, 10000)' });
  parser.add_argument('--seed', { type: 'int', default: Math.floor(Math.random() * 100000), help: 'Random seed for deterministic behavior' });
  parser.add_argument('--duration', { type: 'int', default: 180, help: 'Duration to spread arrivals over, in seconds' });
  parser.add_argument('--soak', { action: 'store_true', help: 'Run in 60-minute soak mode to detect resource leaks' });
  parser.add_argument('--chaos', { action: 'store_true', help: 'Inject random network and infrastructure faults (Chaos Matrix)' });

  const args = parser.parse_args();

  console.log('================================================');
  console.log('🚀 Kaboom Digital Twin Certification Simulator');
  console.log('================================================');
  console.log(`👤 Users: ${args.users}`);
  console.log('🔄 Initializing generated user profiles...');
  const users = generateUsers(args.users, args.seed, args.soak ? 3600 : args.duration);

  const runner = new SimulationRunner(users, args.soak, args.chaos);
  await runner.start();

  console.log('\n[Simulator] Execution Complete. Tearing down...');
  await runner.teardown();

  const cleaner = new DatabaseCleaner();
  await cleaner.cleanSimulatorData('sim_user_');

  process.exit(0);
}

main().catch((err) => {
  console.error('[Fatal Simulator Error]', err);
  process.exit(1);
});
