"use client";

import { useEffect } from "react";

/** Registra public/sw.js (sin caché; ver ese archivo). Solo en producción. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        /* sin service worker la app funciona igual; solo no se ofrece "Instalar" */
      });
  }, []);
  return null;
}
