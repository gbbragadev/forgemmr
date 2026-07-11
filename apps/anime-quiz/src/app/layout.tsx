import type { Metadata } from "next";
import { appConfig } from "../../app.config";
import "./globals.css";

export const metadata: Metadata = {
  title: appConfig.seo.title,
  description: appConfig.seo.description,
  openGraph: {
    title: appConfig.seo.title,
    description: appConfig.seo.description,
    locale: "pt_BR",
    alternateLocale: ["en_US"], // conteúdo EN disponível via toggle (client-only, static export)
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
