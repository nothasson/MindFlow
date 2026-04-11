import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MindFlow",
  description: "AI 学习系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh"
      className="h-full antialiased"
    >
      <body className="h-full bg-[#EEECE2] font-sans">
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
