import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    const globalFetch = globalThis.fetch;
    const chaosFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (process.env.CHAOS_DB_LATENCY === 'true') {
        // 20% chance to inject 1000-4000ms latency on DB requests
        if (Math.random() < 0.2) {
          const delay = Math.floor(Math.random() * 3000) + 1000;
          console.warn(`[Chaos] Injecting ${delay}ms DB latency into Supabase query...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      return globalFetch(input, init);
    };

    supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        fetch: chaosFetch
      }
    });
  }
  return supabase;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = getSupabase();
    const { error } = await client.from('server_metrics').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export function handleSupabaseError(error: unknown, context: string): never {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: string }).message)
      : 'Unknown database error';
  throw new DatabaseError(`${context}: ${message}`, error);
}
