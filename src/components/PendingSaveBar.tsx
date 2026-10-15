"use client";

import { Download, X } from "lucide-react";
import { clearPendingSave, retryPendingSave, usePendingSaveCount } from "@/lib/saveFiles";

/**
 * Si preparar las fotos tardó y el celular pidió un toque nuevo para abrir la
 * hoja de compartir, este aviso queda abajo con el botón "Guardar". Las fotos ya
 * están listas, así que el segundo toque abre la hoja al instante.
 */
export function PendingSaveBar() {
  const count = usePendingSaveCount();
  if (count === 0) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(var(--bottom-nav-space,0px)+0.75rem)] z-[80] mx-auto flex max-w-md items-center gap-2 rounded-xl border border-border bg-surface-overlay p-2 pl-3.5 shadow-2xl"
    >
      <p className="flex-1 text-sm text-foreground">
        {count === 1 ? "La foto está lista." : `Las ${count} fotos están listas.`}
      </p>
      <button
        type="button"
        onClick={() => void retryPendingSave()}
        className="flex items-center gap-1.5 h-10 px-4 rounded-lg bg-accent text-zinc-950 text-sm font-semibold btn-tactile"
      >
        <Download className="w-4 h-4 shrink-0" />
        Guardar
      </button>
      <button
        type="button"
        onClick={clearPendingSave}
        aria-label="Cerrar"
        className="flex items-center justify-center w-10 h-10 rounded-lg text-muted hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
