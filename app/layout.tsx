import type { Metadata, Viewport } from "next";
import { Gantari, Lato } from "next/font/google";
import "./globals.css";

const gantari = Gantari({
  variable: "--font-gantari",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Verse App",
  description: "Operación de Verse Group y C&C Group sobre Airtable",
  appleWebApp: { capable: true, title: "Verse", statusBarStyle: "default" },
  icons: { apple: "/icono/180" },
};

export const viewport: Viewport = {
  themeColor: "#002448",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${gantari.variable} ${lato.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
