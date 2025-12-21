import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";

export const metadata: Metadata = {
  title: "Conversation Practice Space",
  description: "대화의 깊이를 더하는 성찰과 연습의 공간",
};

import { MainNav } from "@/components/main-nav"

// Remove localFont since we don't have the file
// const pretendard = localFont({ ... })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.css"
        />
      </head>
      <body className="bg-background text-foreground antialiased selection:bg-primary/10 font-sans">
        <MainNav />
        <main className="min-h-screen py-8 px-4">
          <div className="container max-w-screen-md mx-auto min-h-[calc(100vh-8rem)]">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
