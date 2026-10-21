"use client";

import { useEffect } from "react";

/** iPhone y iPad (también el iPad que se presenta como Mac). Todos sus navegadores son Safari por dentro. */
function isAppleMobile(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * Registra public/sw.js (sin caché; ver ese archivo). Solo en producción.
 *
 * En iPhone/iPad no: allá "Agregar a inicio" no usa el service worker, y con
 * su listener de fetch (vacío, lo pide el aviso de instalación de Chrome)
 * Safari despierta al worker y le pasa cada pedido de la app antes de ir a la
 * red, demora pura. A quien ya lo tenía registrado se le quita.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    if (isAppleMobile()) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((r) => void r.unregister()))
        .catch(() => {
          /* si no se puede quitar, la app funciona igual que antes */
        });
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        /* sin service worker la app funciona igual; solo no se ofrece "Instalar" */
      });
  }, []);
  return null;
}
