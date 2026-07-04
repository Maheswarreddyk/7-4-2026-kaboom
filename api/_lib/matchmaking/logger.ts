import type { SupabaseClient } from '@supabase/supabase-js';

export interface EngineLogContext {
  engine: string;
  sessionId?: string;
  queueId?: string;
  reservationId?: string;
  matchId?: string;
  success: boolean;
  reason?: string;
  durationMs?: number;
  details?: Record<string, unknown>;
}

export function logEngine(ctx: EngineLogContext): void {
  const payload = {
    ts: new Date().toISOString(),
    ...ctx,
  };
  if (ctx.success) {
    console.log(`[${ctx.engine}] OK`, JSON.stringify(payload));
  } else {
    console.error(`[${ctx.engine}] FAIL`, JSON.stringify(payload));
  }
}

export async function logToDb(
  supabase: SupabaseClient,
  sessionId: string | null,
  event: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('connection_logs').insert({
      session_id: sessionId,
      event,
      details,
    });
  } catch (err) {
    console.error('[Logger] Failed to write connection_log:', err);
  }
}
