import { WidgetCard } from './WidgetCard.js';
import { TrendingUp, TrendingDown } from '../Icons.js';

interface CampusData {
  rank: number;
  campus: string;
  users: number;
  connections: number;
  mutualLikes: number;
  growth: number;
}

interface CampusLeaderboardWidgetProps {
  data: CampusData[];
}

export function CampusLeaderboardWidget({ data }: CampusLeaderboardWidgetProps) {
  return (
    <WidgetCard title="Campus Leaderboard" subtitle="Stack-ranked college adoption and engagement metrics.">
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-400 border-b border-slate-700/50">
              <th className="pb-3 font-medium">Rank</th>
              <th className="pb-3 font-medium">Campus</th>
              <th className="pb-3 font-medium text-right">Users</th>
              <th className="pb-3 font-medium text-right">Connections</th>
              <th className="pb-3 font-medium text-right">Mutual Likes</th>
              <th className="pb-3 font-medium text-right">Growth</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {data.map((row) => (
              <tr key={row.campus} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    row.rank === 1 ? 'bg-amber-500/20 text-amber-400' : 
                    row.rank === 2 ? 'bg-slate-300/20 text-slate-300' : 
                    row.rank === 3 ? 'bg-amber-700/20 text-amber-600' : 
                    'text-slate-500'
                  }`}>
                    {row.rank}
                  </span>
                </td>
                <td className="py-3 font-semibold text-slate-200">{row.campus}</td>
                <td className="py-3 text-right text-slate-300">{row.users.toLocaleString()}</td>
                <td className="py-3 text-right text-slate-300">{row.connections.toLocaleString()}</td>
                <td className="py-3 text-right text-slate-300">{row.mutualLikes.toLocaleString()}</td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {row.growth > 0 ? (
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-rose-400" />
                    )}
                    <span className={row.growth > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {Math.abs(row.growth)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetCard>
  );
}
