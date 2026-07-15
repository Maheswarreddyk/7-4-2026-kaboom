import { WidgetCard } from './WidgetCard.js';

export function LiveActivityFeedWidget({ events }: { events: any[] }) {
  if (!events || events.length === 0) {
    return (
      <WidgetCard title="Live Activity Feed" className="h-96">
        <div className="flex h-full items-center justify-center text-slate-500">
          Waiting for activity...
        </div>
      </WidgetCard>
    );
  }

  const formatEvent = (e: any) => {
    switch (e.event_type) {
      case 'SESSION_STARTED':
        return `New user joined from ${e.payload?.city || 'Unknown'}, ${e.payload?.country || 'Unknown'} on ${e.payload?.os || 'Unknown'}`;
      case 'QUEUE_JOINED':
        return `User searching queue (${e.payload?.match_mode || 'Unknown'})`;
      case 'MATCH_FOUND':
        return `Match created (Wait: ${e.payload?.wait_time_sec}s)`;
      case 'CALL_ENDED':
        return `Conversation ended (${Math.round((e.payload?.duration_sec || 0)/60)}m) - ${e.payload?.ended_reason || 'Unknown'}`;
      case 'MUTUAL_LIKE':
        return `Mutual Like!`;
      default:
        return e.event_type;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'SESSION_STARTED': return 'text-blue-400';
      case 'QUEUE_JOINED': return 'text-emerald-400';
      case 'MATCH_FOUND': return 'text-indigo-400';
      case 'CALL_ENDED': return 'text-amber-400';
      case 'MUTUAL_LIKE': return 'text-pink-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <WidgetCard title="Live Activity Feed" className="h-96">
      <div className="h-full overflow-y-auto pr-2 mt-4 space-y-3">
        {events.map((e, idx) => (
          <div key={e.id || idx} className="flex items-start gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-800/50">
            <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${getEventColor(e.event_type).replace('text-', 'bg-')}`} />
            <div>
              <p className="text-sm text-slate-200">{formatEvent(e)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {new Date(e.created_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
