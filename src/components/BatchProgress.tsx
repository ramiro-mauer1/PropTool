"use client";

import { motion } from "framer-motion";
import { StopCircle, Loader2 } from "lucide-react";

interface BatchProgressProps {
  progress: number;
  processedCount: number;
  totalCount: number;
  onCancel: () => void;
}

export function BatchProgress({
  progress,
  processedCount,
  totalCount,
  onCancel,
}: BatchProgressProps) {
  const roundedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className="w-full p-3.5 rounded-card bg-surface/90 border border-border/80 shadow-subtle flex flex-col gap-2.5 backdrop-blur-md"
    >
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
          <span className="font-medium text-foreground">
            Limpiando fotografías con IA
          </span>
          <span className="text-muted font-mono tabular-nums text-2xs">
            ({processedCount}/{totalCount} completadas)
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono font-semibold tabular-nums text-foreground text-xs">
            {roundedProgress}%
          </span>

          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-subtle bg-error/10 hover:bg-error/20 border border-error/30 text-error text-2xs font-medium btn-tactile transition-colors"
            title="Detener procesamiento"
          >
            <StopCircle className="w-3 h-3" />
            <span>Detener</span>
          </button>
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full h-1.5 bg-surface-raised rounded-full overflow-hidden border border-border/60 relative">
        <motion.div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 relative overflow-hidden rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ ease: [0.23, 1, 0.32, 1], duration: 0.35 }}
        >
          {/* Subtle Shimmer highlight */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
        </motion.div>
      </div>
    </motion.div>
  );
}
