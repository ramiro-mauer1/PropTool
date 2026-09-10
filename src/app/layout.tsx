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
  themeColor: "#09090b",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "PropTool - Inmobiliaria AI Studio",
  description:
    "Editor de imagenes profesional con IA para agentes inmobiliarios. Mejora, escala y transforma fotografias de propiedades al instante.",
  keywords: [
    "inmobiliaria",
    "editor de imagenes",
    "IA",
    "real estate",
    "photo editor",
    "upscaler",
  ],
  authors: [{ name: "PropTool" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-[#fbfbf9] dark:bg-[#09090b] text-[#191918] dark:text-[#f4f4f5] min-h-[100dvh] transition-colors duration-150`}
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
