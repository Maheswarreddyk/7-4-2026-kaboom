-- 1. Recreate the table with ALL required columns (both old heartbeat and new dashboard metrics)
DROP TABLE IF EXISTS public.server_metrics CASCADE;

CREATE TABLE public.server_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  active_users INTEGER NOT NULL DEFAULT 0,
  waiting_users INTEGER NOT NULL DEFAULT 0,
  matches_today INTEGER NOT NULL DEFAULT 0,
  total_searching_users int DEFAULT 0,
  avg_wait_time interval DEFAULT '0',
  max_wait_time interval DEFAULT '0',
  abandoned_matches int DEFAULT 0,
  successful_matches int DEFAULT 0,
  failed_matches int DEFAULT 0,
  rematches int DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Insert initial row for global metrics update
INSERT INTO public.server_metrics (total_searching_users) VALUES (0);

CREATE OR REPLACE FUNCTION public.update_matchmaker_metrics(
  p_total_searching_users int,
  p_avg_wait interval,
  p_max_wait interval,
  p_abandoned int,
  p_succ int,
  p_fail int,
  p_rematches int
) RETURNS void AS $$
BEGIN
  UPDATE public.server_metrics
  SET
    total_searching_users = p_total_searching_users,
    avg_wait_time = p_avg_wait,
    max_wait_time = p_max_wait,
    abandoned_matches = p_abandoned,
    successful_matches = p_succ,
    failed_matches = p_fail,
    rematches = p_rematches,
    updated_at = NOW()
  WHERE id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Fix matchmaker_heal_cycle to use visitor_sessions without updated_at column
CREATE OR REPLACE FUNCTION matchmaker_heal_cycle()
RETURNS void AS $$
BEGIN
  -- Mark sessions in 'waiting' for > 3 minutes as 'ended'
  UPDATE public.visitor_sessions
  SET status = 'ended', ended_at = NOW()
  WHERE status = 'waiting'
    AND created_at < NOW() - INTERVAL '3 minutes';

  -- Cleanup orphaned matches ('matched' state but older than 5 mins)
  UPDATE public.visitor_sessions
  SET status = 'ended', ended_at = NOW()
  WHERE status = 'matched'
    AND created_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Reload Supabase Schema Cache
NOTIFY pgrst, 'reload schema';
