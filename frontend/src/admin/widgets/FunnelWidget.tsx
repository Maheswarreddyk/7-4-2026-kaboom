import { WidgetCard } from './WidgetCard.js';

interface FunnelStep {
  step: string;
  count: number;
  dropoff: number;
}

interface FunnelWidgetProps {
  data: FunnelStep[];
}

export function FunnelWidget({ data }: FunnelWidgetProps) {
  const maxCount = data.length > 0 ? data[0].count : 1;

  return (
    <WidgetCard 
      title="Product Funnel" 
      subtitle="Acquisition to Activation drop-off rates"
      className="col-span-full lg:col-span-2"
    >
      <div className="flex flex-col gap-3">
        {data.map((item, idx) => {
          const widthPercent = Math.max((item.count / maxCount) * 100, 2);
          
          return (
            <div key={item.step} className="flex items-center gap-4">
              <div className="w-40 text-sm font-medium text-slate-300 truncate text-right">
                {item.step}
              </div>
              <div className="flex-1 h-8 bg-slate-800 rounded-md overflow-hidden relative group">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-1000 ease-out flex items-center px-3"
                  style={{ width: `${widthPercent}%` }}
                >
                  <span className="text-xs font-bold text-white drop-shadow-md">
                    {item.count.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="w-24 text-right">
                {idx > 0 && (
                  <span className="text-xs font-medium text-rose-400 bg-rose-400/10 px-2 py-1 rounded-full">
                    -{item.dropoff}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}
