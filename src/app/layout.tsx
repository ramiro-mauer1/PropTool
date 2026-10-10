import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/Toast";
import { MotionLayoutGroup } from "@/components/MotionLayoutGroup";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

// Rendered per request so Next.js can stamp the CSP nonce from middleware.ts
// on its scripts — a statically prerendered page has no nonce and the CSP
// would block it.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Sin maximumScale: el zoom con pinza queda disponible (accesibilidad y
  // revisión de detalle en las fotos). El auto-zoom de iOS al enfocar un input
  // se evita forzando 16px en los controles de formulario (globals.css).
  viewportFit: "cover",
  themeColor: "#08090a",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "Plinth - Real Estate OS",
  description:
    "Editor de imágenes profesional con IA para agentes inmobiliarios. Mejora, escala y transforma fotografías de propiedades al instante.",
  keywords: [
    "inmobiliaria",
    "editor de imágenes",
    "IA",
    "real estate",
    "photo editor",
    "upscaler",
  ],
  authors: [{ name: "Plinth" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground min-h-[100dvh]`}
      >
        <ToastProvider>
          <MotionLayoutGroup>{children}</MotionLayoutGroup>
        </ToastProvider>
      </body>
    </html>
  );
}
