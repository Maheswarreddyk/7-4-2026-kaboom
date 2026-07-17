// Seeded Random Number Generator
export class PRNG {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Next random float between 0 and 1
  public next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  public nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  public choice<T>(arr: T[]): T {
    return arr[this.nextInt(0, arr.length - 1)];
  }

  public chance(probability: number): boolean {
    return this.next() < probability;
  }

  public sample<T>(arr: T[], count: number): T[] {
    const shuffled = [...arr].sort(() => this.next() - 0.5);
    return shuffled.slice(0, count);
  }
}

export type SimulatedUser = {
  id: string; // e.g. "sim_user_001"
  arrivalTimeMs: number; // Time in milliseconds since simulation start they will join
  profile: {
    displayName: string;
    gender: 'Male' | 'Female' | 'Other';
    lookingFor: string[];
    languages: string[];
    country: string;
    city: string;
    interestTags: string[];
    matchMode: 'RANDOM' | 'PREFER' | 'STRICT';
  };
  behavior: {
    networkQuality: 'excellent' | 'poor' | 'offline_drops';
    patienceMs: number; // How long they will wait before abandoning the search
    skipProbability: number; // Chance they click skip when matched
    leaveMidwayProbability: number; // Chance they close browser midway
    refreshProbability: number; // Chance they refresh the page
  };
  device: {
    browser: 'chromium' | 'firefox' | 'webkit';
    isMobile: boolean;
  };
};

const INTERESTS = ['Sports', 'Movies', 'Gaming', 'Technology', 'Programming', 'Anime', 'Fitness', 'Business', 'Finance', 'Travel', 'Cooking', 'Music', 'Reading', 'Science', 'Politics', 'Art', 'Photography', 'AI', 'Startups', 'Education'];
const COUNTRIES = ['India', 'USA', 'UK', 'Canada', 'Australia'];
const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'New York', 'London', 'Toronto', 'Sydney'];
const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Spanish', 'French'];

export function generateUsers(count: number, seed: number, durationSeconds: number = 180): SimulatedUser[] {
  const prng = new PRNG(seed);
  const users: SimulatedUser[] = [];
  const durationMs = durationSeconds * 1000;

  // Spread arrival times over duration, skewed towards the first half
  for (let i = 0; i < count; i++) {
    const isBurst = prng.chance(0.8);
    const arrivalTimeMs = isBurst 
      ? prng.nextInt(0, Math.floor(durationMs / 2)) 
      : prng.nextInt(Math.floor(durationMs / 2), durationMs);

    const user: SimulatedUser = {
      id: `sim_user_${i.toString().padStart(4, '0')}`,
      arrivalTimeMs,
      profile: {
        displayName: `SimUser_${i}`,
        gender: prng.choice(['Male', 'Female', 'Male', 'Female', 'Other']),
        lookingFor: prng.chance(0.7) ? ['Anyone'] : [prng.choice(['Male', 'Female'])],
        languages: prng.sample(LANGUAGES, prng.nextInt(1, 3)),
        country: prng.choice(COUNTRIES),
        city: prng.choice(CITIES),
        interestTags: prng.sample(INTERESTS, prng.nextInt(1, 5)),
        matchMode: prng.chance(0.1) ? 'STRICT' : prng.chance(0.3) ? 'PREFER' : 'RANDOM'
      },
      behavior: {
        networkQuality: prng.chance(0.1) ? 'poor' : prng.chance(0.05) ? 'offline_drops' : 'excellent',
        patienceMs: prng.nextInt(10000, 120000), // Wait between 10s and 2 minutes
        skipProbability: prng.next() * 0.5, // 0 to 50% chance to skip
        leaveMidwayProbability: prng.next() * 0.2, // 0 to 20% chance to leave midway
        refreshProbability: prng.next() * 0.1, // 0 to 10% chance to randomly refresh
      },
      device: {
        browser: prng.choice(['chromium', 'firefox', 'webkit']),
        isMobile: prng.chance(0.6) // 60% mobile traffic
      }
    };
    users.push(user);
  }

  // Sort by arrival time
  users.sort((a, b) => a.arrivalTimeMs - b.arrivalTimeMs);

  return users;
}
