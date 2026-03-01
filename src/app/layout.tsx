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
      <body className={`${geistSans.variable} antialiased bg-gray-50 min-h-screen`}>
        <SessionProvider>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 py-6">
            {children}
          </main>
        </SessionProvider>
      </body>
    </html>
  );
}
