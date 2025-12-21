import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conversation Practice Space",
  description: "대화의 깊이를 더하는 성찰과 연습의 공간",
};

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
      <body className="antialiased font-sans bg-background text-foreground min-h-screen flex flex-col items-center">
        {/* Mobile-first Container Shell */}
        <div className="w-full max-w-screen-md flex-1 flex flex-col shadow-2xl min-h-screen bg-card border-x border-border/50">
          <header className="px-6 py-4 flex justify-between items-center bg-card/80 backdrop-blur-md sticky top-0 z-50 border-b border-border/40">
            <h1 className="font-bold text-lg tracking-tight text-primary">Dialogue Lab</h1>
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
              U
            </div>
          </header>

          <main className="flex-1 p-6">
            {children}
          </main>

          <footer className="p-6 text-center text-xs text-muted-foreground border-t border-border/40">
            © 2025 Dialogue Lab. <br /> Reflection over Evaluation.
          </footer>
        </div>
      </body>
    </html>
  );
}
