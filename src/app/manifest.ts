import type { MetadataRoute } from "next";

// App instalable: "Agregar a inicio" en iPhone e "Instalar" en Android.
// Se sirve en /manifest.webmanifest (excluido del login en middleware.ts).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Plinth",
    short_name: "Plinth",
    description: "Captaciones de propietarios directos para inmobiliarias",
    lang: "es",
    // `/` muestra el login sin sesión y, con sesión, AppShell lleva a la
    // herramienta de inicio del agente.
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#08090a",
    theme_color: "#08090a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
