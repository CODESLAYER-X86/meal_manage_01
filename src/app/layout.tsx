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
        <meta name="theme-color" content="#4f46e5" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${geistSans.variable} antialiased bg-gray-50 min-h-screen flex flex-col`}>
        <SessionProvider>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
            {children}
          </main>
          <footer className="mt-auto py-4 border-t border-gray-100 bg-white/60 backdrop-blur-sm">
            <p className="text-center text-xs text-gray-400 tracking-wide">
              Designed &amp; built by{" "}
              <span className="font-semibold text-indigo-500 tracking-wider">CODESLAYER_X86</span>
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
