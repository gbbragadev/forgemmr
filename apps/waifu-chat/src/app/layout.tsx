import type { Metadata } from "next";
import { appConfig } from "../../app.config";
import "./globals.css";

export const metadata: Metadata = {
  title: appConfig.seo.title,
  description: appConfig.seo.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
