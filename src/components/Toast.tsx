"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type ToastType = "warning" | "info" | "error" | "success";

export interface ToastOptions {
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
  createdAt: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast debe ser utilizado dentro de un ToastProvider");
  }
  return context;
}

const TOAST_ICONS: Record<ToastType, React.ElementType> = {
  warning: AlertCircle,
  error: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};

const TOAST_STYLES: Record<
  ToastType,
  {
    border: string;
    iconBg: string;
    iconColor: string;
    progressBar: string;
    titleColor: string;
  }
> = {
  warning: {
    border: "border-amber-500/30 shadow-amber-500/5",
    iconBg: "bg-amber-500/15 border-amber-500/30",
    iconColor: "text-amber-400",
    progressBar: "bg-amber-500",
    titleColor: "text-amber-300",
  },
  error: {
    border: "border-red-500/30 shadow-red-500/5",
    iconBg: "bg-red-500/15 border-red-500/30",
    iconColor: "text-red-400",
    progressBar: "bg-red-500",
    titleColor: "text-red-300",
  },
  success: {
    border: "border-emerald-500/30 shadow-emerald-500/5",
    iconBg: "bg-emerald-500/15 border-emerald-500/30",
    iconColor: "text-emerald-400",
    progressBar: "bg-emerald-500",
    titleColor: "text-emerald-300",
  },
  info: {
    border: "border-border shadow-black/20",
    iconBg: "bg-surface border-border",
    iconColor: "text-zinc-300",
    progressBar: "bg-zinc-500",
    titleColor: "text-zinc-200",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    const existingTimer = timersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, message, type = "info", duration = 4500 }: ToastOptions) => {
      setToasts((prev) => {
        const existing = prev.find((t) => t.message === message);
        if (existing) {
          const existingTimer = timersRef.current.get(existing.id);
          if (existingTimer) clearTimeout(existingTimer);

          if (duration > 0) {
            const timer = setTimeout(() => {
              removeToast(existing.id);
            }, duration);
            timersRef.current.set(existing.id, timer);
          }
          return prev;
        }

        const id = crypto.randomUUID();
        const newToast: ToastItem = {
          id,
          title,
          message,
          type,
          duration,
          createdAt: Date.now(),
        };

        if (duration > 0) {
          const timer = setTimeout(() => {
            removeToast(id);
          }, duration);
          timersRef.current.set(id, timer);
        }

        return [...prev, newToast];
      });
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      
      <div 
        aria-live="polite"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => {
            const Icon = TOAST_ICONS[toast.type || "info"];
            const style = TOAST_STYLES[toast.type || "info"];
            const duration = toast.duration ?? 4500;

            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{
                  duration: 0.25,
                  ease: [0.23, 1, 0.32, 1],
                }}
                className={`pointer-events-auto relative overflow-hidden rounded-card border bg-[#141417]/95 backdrop-blur-md p-3.5 shadow-2xl ${style.border}`}
                role="alert"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-subtle border flex items-center justify-center shrink-0 ${style.iconBg}`}
                  >
                    <Icon className={`w-4 h-4 ${style.iconColor}`} />
                  </div>

                  <div className="flex-1 min-w-0 pr-2">
                    {toast.title && (
                      <h4
                        className={`text-xs font-semibold tracking-tight leading-none mb-1 ${style.titleColor}`}
                      >
                        {toast.title}
                      </h4>
                    )}
                    <p className="text-xs text-zinc-300/90 leading-relaxed break-words font-sans">
                      {toast.message}
                    </p>
                  </div>

                  <button
                    onClick={() => removeToast(toast.id)}
                    type="button"
                    className="shrink-0 -mr-1 -mt-1 p-1 rounded-subtle text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
                    aria-label="Cerrar notificación"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {duration > 0 && (
                  <motion.div
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: duration / 1000, ease: "linear" }}
                    className={`absolute bottom-0 left-0 h-[2px] opacity-80 ${style.progressBar}`}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
