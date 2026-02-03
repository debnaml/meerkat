import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meerkat | Page & Section Monitoring",
  description: "ChangeTower-style SaaS for trustworthy change detection, diffs, and alerts.",
};

const themeInitScript = `
(() => {
  try {
    const preference = localStorage.getItem('meerkat-theme');
    if (preference === 'light' || preference === 'dark') {
      document.documentElement.setAttribute('data-theme', preference);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  } catch (error) {
    console.warn('Unable to hydrate theme preference', error);
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
