"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function BazarDutyPage() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect after 3 seconds
    const timer = setTimeout(() => router.push("/bazar"), 3000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center max-w-md">
        <div className="text-5xl mb-4">🛒</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Bazar Duty Moved</h1>
        <p className="text-gray-500 mb-4">
          Bazar duties are now managed through the Bazar page. Members submit trips, and the manager approves them.
        </p>
        <Link
          href="/bazar"
          className="inline-block px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
        >
          Go to Bazar →
        </Link>
        <p className="text-xs text-gray-400 mt-3">Redirecting automatically...</p>
      </div>
    </div>
  );
}
