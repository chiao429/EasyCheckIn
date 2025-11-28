import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EasyCheck - 活動點名系統",
  description: "簡單易用的活動簽到點名系統",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
