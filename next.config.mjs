import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Every page is dynamic (CSP nonce, see app/layout.tsx), and for dynamic
  // pages Next 15 streams metadata into <body>. Browsers only read the
  // manifest and the apple-mobile-web-app-* tags from <head>, so streamed,
  // the app installs as a plain browser shortcut. Matching every user agent
  // keeps metadata blocking, in <head>.
  htmlLimitedBots: /.*/,
  // There's a stray lockfile higher up (~/package-lock.json); pin the root.
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  experimental: {
    // Cuánto reutiliza el navegador una sección ya cargada antes de volver a
    // pedirla al servidor. Las secciones no traen datos del servidor (todo se
    // carga en el cliente), así que reusarlas es seguro; sin esto, Next 15
    // vuelve al servidor en cada cambio de pestaña. Cerrar sesión recarga la
    // página entera y vacía este caché.
    staleTimes: {
      dynamic: 300,
      static: 600,
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          // The per-request Content-Security-Policy is set in middleware.ts.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // Microphone: voice capture in the CRM assistant.
            value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
        ],
      },
      {
        // El navegador tiene que ver siempre la última versión del service worker.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "onnxruntime-web": path.resolve(
        __dirname,
        "node_modules/onnxruntime-web/dist/ort.min.js"
      ),
    };
    return config;
  },
};

export default nextConfig;
