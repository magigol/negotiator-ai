import "./globals.css";
import type { Metadata } from "next";
import AppNavbar from "@/components/AppNavbar";

export const metadata: Metadata = {
  title: "Negotiator AI",
  description: "Marketplace con negociación asistida por IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <AppNavbar />
        {children}
      </body>
    </html>
  );
}