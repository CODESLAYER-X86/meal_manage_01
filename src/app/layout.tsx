import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mess Meal Manager",
  description: "Manage meals, deposits, and expenses for your mess",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0f1c" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${geistSans.variable} antialiased bg-[#0a0f1c] text-slate-200 min-h-screen flex flex-col`}>
        {/* Ambient background glow */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/[0.07] rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/[0.05] rounded-full blur-3xl" />
        </div>
        <SessionProvider>
          <Navbar />
          <main className="relative z-10 max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
            {children}
          </main>
          <footer className="relative z-10 mt-auto py-4 border-t border-white/[0.06]">
            <p className="text-center text-xs text-slate-600 tracking-wide">
              Designed &amp; built by{" "}
              <span className="font-semibold text-indigo-400 tracking-wider">CODESLAYER_X86</span>
            </p>
          </footer>
        </SessionProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
