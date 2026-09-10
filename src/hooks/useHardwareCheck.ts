"use client";

import { useState, useEffect } from "react";

export interface HardwareCheckResult {
  isCapable: boolean;
  reason?: string;
}

interface NavigatorExtended extends Navigator {
  deviceMemory?: number;
  gpu?: unknown;
}

export function useHardwareCheck(): HardwareCheckResult {
  const [result, setResult] = useState<HardwareCheckResult>({
    isCapable: true,
  });

  useEffect(() => {
    function evaluate(): HardwareCheckResult {
      if (typeof window === "undefined") {
        return { isCapable: false, reason: "Entorno de servidor detectado" };
      }

      const nav = navigator as NavigatorExtended;
      const issues: string[] = [];

      const memory = nav.deviceMemory;
      if (typeof memory === "number" && memory <= 4) {
        issues.push(`RAM insuficiente (${memory} GB detectados, se requieren >4 GB)`);
      }

      const cores = nav.hardwareConcurrency;
      if (typeof cores === "number" && cores < 4) {
        issues.push(`CPU limitada (${cores} nucleos detectados, se recomiendan 4+)`);
      }

      const hasWebGPU = "gpu" in nav;
      if (!hasWebGPU) {
        issues.push("WebGPU no disponible en este navegador");
      }

      if (issues.length > 0) {
        return {
          isCapable: false,
          reason: issues.join(" · "),
        };
      }

      return { isCapable: true };
    }

    setResult(evaluate());
  }, []);

  return result;
}
