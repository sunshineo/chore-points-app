import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GemSteps Day",
  description: "Daily tasks, points, and rewards",
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
