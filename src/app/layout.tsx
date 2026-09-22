import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Klassa | School administration",
  description: "Secure, precise school administration for modern K-12 teams.",
  applicationName: "Klassa",
};

export const viewport: Viewport = { themeColor: "#ffffff", colorScheme: "light" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
