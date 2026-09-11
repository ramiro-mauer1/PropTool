import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/Toast";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
