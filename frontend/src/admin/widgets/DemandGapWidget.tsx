import { WidgetCard } from './WidgetCard.js';

interface DemandData {
  campus: string;
  demand: number;
  supply: number;
  gap: number;
}

interface DemandGapWidgetProps {
  data: DemandData[];
  title?: string;
}

export function DemandGapWidget({ data, title = "Search Demand vs Supply" }: DemandGapWidgetProps) {
  return (
    <WidgetCard title={title} subtitle="Identifies marketing gaps where searches fail to find matches.">
      <div className="flex flex-col gap-5 mt-2">
        {data.map((item) => {
          const maxVal = Math.max(item.demand, 1);
          const supplyPct = Math.min((item.supply / maxVal) * 100, 100);
          const gapPct = Math.max(100 - supplyPct, 0);

          return (
            <div key={item.campus} className="flex flex-col gap-2">
              <div className="flex justify-between items-end">
                <span className="text-sm font-semibold text-slate-200">{item.campus}</span>
                <div className="flex gap-4 text-xs font-medium">
                  <span className="text-blue-400">Demand: {item.demand}</span>
                  <span className="text-emerald-400">Supply: {item.supply}</span>
                  <span className="text-rose-400">Gap: {item.gap}</span>
                </div>
              </div>
              
              <div className="h-4 w-full bg-slate-800 rounded-full flex overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-1000"
                  style={{ width: `${supplyPct}%` }}
                />
                <div 
                  className="h-full bg-rose-500/80 transition-all duration-1000"
                  style={{ width: `${gapPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}
