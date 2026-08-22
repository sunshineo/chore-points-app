import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GemSteps",
  description: "Daily tasks, points, and rewards",
  manifest: "/app.webmanifest",
  appleWebApp: {
    capable: true,
    title: "GemSteps",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
