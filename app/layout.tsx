/*
 * File: app/layout.tsx
 * Purpose: Página de la aplicación Next.js
 */

import "./globals.css";
import type { Metadata } from "next";
import AppNavbar from "@/components/AppNavbar";

export const metadata: Metadata = {
  title: "Negotiator AI",
  description: "Marketplace con negociación asistida por IA",
};

// Página/Componente exportado: RootLayout.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // La raíz de la aplicación envuelve todas las páginas con el navbar compartido.
  return (
    <html lang="es">
      <body>
        <AppNavbar />
        {children}
      </body>
    </html>
  );
}