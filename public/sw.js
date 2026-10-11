// Service worker mínimo: existe solo para que Android/Chrome ofrezca
// "Instalar app". A propósito NO cachea nada (ni páginas, ni datos, ni la
// sesión): cada pedido va directo a la red, igual que sin service worker.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
// Sin respondWith: el navegador resuelve el pedido normalmente por la red.
self.addEventListener("fetch", () => {});
