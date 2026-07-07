import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

function getEnv(key: string): string {
  if (key === 'SUPABASE_URL') {
    return process.env.SUPABASE_URL || 'https://dirocenpssdilkztizps.supabase.co';
  }
  if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  }
  return process.env[key] || '';
}

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = getEnv('SUPABASE_URL');
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!serviceRoleKey && process.env.NODE_ENV === 'production') {
      console.error('[Error] SUPABASE_SERVICE_ROLE_KEY is not defined in production environment variables.');
    }
    
    supabase = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabase;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const { error } = await getSupabase().from('server_metrics').select('id').limit(1);
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
