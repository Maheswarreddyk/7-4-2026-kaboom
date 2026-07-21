import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;
let cachedUrl: string = '';
let cachedKey: string = '';

export function getSupabase(): SupabaseClient {
  const url = (globalThis.process?.env?.SUPABASE_URL as string) || '';
  const key = (globalThis.process?.env?.SUPABASE_SERVICE_ROLE_KEY as string) || '';

  // If env changed (new request with real keys) or client not yet created, rebuild
  if (!supabase || url !== cachedUrl || key !== cachedKey) {
    if (!url || !key) {
      throw new Error('[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
    }
    cachedUrl = url;
    cachedKey = key;
    supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });
  }
  return supabase;
}
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = getSupabase();
    const { error } = await client.from('visitor_sessions').select('id').limit(1);
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
