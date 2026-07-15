import { RefreshCw, CheckCircle, Circle, AlertCircle } from 'lucide-react';
import { cn } from '../utils/index.js';

interface BootScreenProps {
  visible: boolean;
  stage: string;
  progress: number;
  isLongLoading: boolean;
  isError: boolean;
  bootTime: number;
  onRetry: () => void;
}

export function BootScreen({ 
  visible, 
  stage, 
  progress, 
  isLongLoading, 
  isError, 
  bootTime, 
  onRetry 
}: BootScreenProps) {
  const getSubtext = () => {
    if (isError) return "Unable to start.";
    if (bootTime > 30) return "Retrying connection...";
    if (bootTime > 15) return "Still warming up...";
    if (isLongLoading) return "Almost ready...";
    return "Please wait a moment.";
  };

  const steps = [
    { name: 'Loading application', minProgress: 10 },
    { name: 'Starting web server', minProgress: 30 },
    { name: 'Connecting database', minProgress: 50 },
    { name: 'Initializing services', minProgress: 80 },
    { name: 'Ready', minProgress: 100 },
  ];

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0A0A0B] text-white transition-all duration-700 ease-in-out",
        visible ? "opacity-100 backdrop-blur-md" : "opacity-0 pointer-events-none backdrop-blur-none"
      )}
    >
      <div 
        className={cn(
          "flex flex-col items-center max-w-md w-full px-6 transition-transform duration-700 ease-out",
          visible ? "scale-100" : "scale-95"
        )}
      >
        
        {/* Logo / Brand */}
        <div className="mb-8 flex items-center justify-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <span className="text-2xl font-black text-white tracking-tighter">K</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
            Kaboom
          </h1>
        </div>

        {/* Progress System - Only fade in if it takes longer than 2s (Long Loading) or Error */}
        <div 
          className={cn(
            "w-full bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-xl shadow-2xl transition-all duration-1000",
            (isLongLoading || isError) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">{isError ? 'Startup Failed' : stage}</h2>
            {!isError && <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />}
            {isError && <AlertCircle className="w-5 h-5 text-red-500" />}
          </div>

          <div className="space-y-4 mb-6">
            {steps.map((step) => {
              const isCompleted = progress >= step.minProgress && !isError;
              const isCurrent = !isCompleted && progress < step.minProgress && progress > (step.minProgress - 30);
              
              return (
                <div key={step.name} className={cn(
                  "flex items-center space-x-3",
                  isCompleted ? "text-zinc-200" : isCurrent ? "text-purple-400" : "text-zinc-600"
                )}>
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Circle className={cn("w-5 h-5", isCurrent && "animate-pulse text-purple-500")} />
                  )}
                  <span className={cn("text-sm font-medium", isCurrent && "animate-pulse")}>{step.name}</span>
                </div>
              );
            })}
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-4">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500 ease-out",
                isError ? "bg-red-500" : "bg-gradient-to-r from-purple-500 to-pink-500"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <p className={cn("text-xs text-center font-medium", isError ? "text-red-400" : "text-zinc-500")}>
            {getSubtext()}
          </p>

          {isError && (
            <button 
              onClick={onRetry}
              className="mt-6 w-full py-3 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 transition-colors"
            >
              Retry Connection
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
