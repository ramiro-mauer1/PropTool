"use client";

import { useEffect, useState } from "react";
import { isLamaModelAvailable } from "@/lib/aiModels";

/**
 * ¿Se puede usar Limpieza Inteligente? null mientras se comprueba; false si
 * el modelo LaMa no está publicado (la función queda temporalmente desactivada).
 */
export function useCleanupAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void isLamaModelAvailable().then((ok) => {
      if (active) setAvailable(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  return available;
}
