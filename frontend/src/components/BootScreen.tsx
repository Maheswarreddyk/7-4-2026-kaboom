import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, CheckCircle, Circle, AlertCircle } from 'lucide-react';

interface HealthResponse {
  success: boolean;
  ready: boolean;
  status: string;
  progress: number;
  stage: string;
  version: string;
  uptime: number;
}

export function BootScreen({ onReady }: { onReady: () => void }) {
  const [stage, setStage] = useState('Loading application');
  const [progress, setProgress] = useState(10);
  const [status, setStatus] = useState('BOOTING');
  const [bootTime, setBootTime] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isError, setIsError] = useState(false);

  // Poll health endpoint
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data: HealthResponse = await res.json();
        
        setStage(data.stage);
        setProgress(data.progress);
        setStatus(data.status);

        if (data.ready) {
          setIsFadingOut(true);
          setTimeout(() => onReady(), 500); // 500ms fade transition
          return true; // Is ready
        }
      }
    } catch (e) {
      // Network error during early boot, just ignore and retry
      console.warn('[BootScreen] Health check failed, retrying...');
    }
    return false;
  }, [onReady]);

  // Polling loop
  useEffect(() => {
    if (isFadingOut || isError) return;

    let timeoutId: NodeJS.Timeout;
    const poll = async () => {
      const ready = await checkHealth();
      if (!ready && !isFadingOut && !isError) {
        timeoutId = setTimeout(poll, 1000);
      }
    };
    
    poll();

    return () => clearTimeout(timeoutId);
  }, [checkHealth, isFadingOut, isError]);

  // Timeout Escalation Timer
  useEffect(() => {
    if (isFadingOut || isError) return;
    
    const interval = setInterval(() => {
      setBootTime(prev => {
        const newTime = prev + 1;
        if (newTime >= 60) {
          setIsError(true);
        }
        return newTime;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isFadingOut, isError]);

  // Handle Manual Retry
  const handleRetry = () => {
    setIsError(false);
    setBootTime(0);
    setStage('Reconnecting...');
    setProgress(10);
  };

  const getSubtext = () => {
    if (isError) return "Unable to start.";
    if (bootTime > 30) return "Retrying connection...";
    if (bootTime > 15) return "Still warming up...";
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
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-zinc-950 text-white transition-opacity duration-500 ease-in-out ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="flex flex-col items-center max-w-md w-full px-6">
        
        {/* Logo / Brand */}
        <div className="mb-8 flex items-center justify-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <span className="text-2xl font-black text-white tracking-tighter">K</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
            Kaboom
          </h1>
        </div>

        {/* Progress System */}
        <div className="w-full bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">{isError ? 'Startup Failed' : stage}</h2>
            {!isError && <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />}
            {isError && <AlertCircle className="w-5 h-5 text-red-500" />}
          </div>

          <div className="space-y-4 mb-6">
            {steps.map((step) => {
              const isCompleted = progress >= step.minProgress && status !== 'FAILED';
              const isCurrent = !isCompleted && progress < step.minProgress && progress > (step.minProgress - 30);
              
              return (
                <div key={step.name} className={`flex items-center space-x-3 ${isCompleted ? 'text-zinc-200' : isCurrent ? 'text-purple-400' : 'text-zinc-600'}`}>
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Circle className={`w-5 h-5 ${isCurrent ? 'animate-pulse text-purple-500' : ''}`} />
                  )}
                  <span className={`text-sm font-medium ${isCurrent ? 'animate-pulse' : ''}`}>{step.name}</span>
                </div>
              );
            })}
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-4">
            <div 
              className={`h-full rounded-full transition-all duration-500 ease-out ${isError ? 'bg-red-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <p className={`text-xs text-center font-medium ${isError ? 'text-red-400' : 'text-zinc-500'}`}>
            {getSubtext()}
          </p>

          {isError && (
            <button 
              onClick={handleRetry}
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
