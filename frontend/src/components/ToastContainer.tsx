import { useToast } from '../contexts/ToastContext.js';
import { cn } from '../utils/index.js';

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'glass rounded-xl px-4 py-3 flex items-start gap-3 animate-slide-in cursor-pointer max-w-xs pointer-events-auto',
            toast.type === 'success' && 'border-success/30',
            toast.type === 'error'   && 'border-danger/30',
            toast.type === 'warning' && 'border-yellow-500/30',
            toast.type === 'info'    && 'border-accent/30'
          )}
          onClick={() => removeToast(toast.id)}
          role="alert"
        >
          <span className="text-lg leading-none mt-0.5">
            {toast.type === 'success' && '✓'}
            {toast.type === 'error'   && '✕'}
            {toast.type === 'warning' && '⚠'}
            {toast.type === 'info'    && 'ℹ'}
          </span>
          <p className="text-sm text-white/90 leading-snug">{toast.message}</p>
        </div>
      ))}
    </>
  );
}

