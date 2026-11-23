import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Tema } from "@/components/tema";
import { PLATFORM_NAME } from "@/lib/config";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: PLATFORM_NAME,
  description: "Plataforma de operación sobre Airtable",
  appleWebApp: { capable: true, title: PLATFORM_NAME, statusBarStyle: "default" },
  icons: { apple: "/icono/180" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <Tema>{children}</Tema>
      </body>
    </html>
  );
}
