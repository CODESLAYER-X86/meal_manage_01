"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function PendingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [messName, setMessName] = useState("");
  const [status, setStatus] = useState<"loading" | "pending" | "approved" | "rejected" | "none">("loading");

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/join-requests?own=true");
      const data = await res.json();

      if (data.pendingRequest) {
        setMessName(data.pendingRequest.mess.name);
        setStatus("pending");
      } else {
        // No pending request — check if user now has a messId (approved)
        const messRes = await fetch("/api/mess");
        const messData = await messRes.json();
        if (messData.mess) {
          setStatus("approved");
        } else {
          setStatus("none");
        }
      }
    } catch {
      setStatus("none");
    }
  };

  useEffect(() => {
    checkStatus();
    // Poll every 5 seconds to check if approved
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === "approved") {
      // Session will be refreshed on redirect
      router.push("/dashboard");
      router.refresh();
    }
    if (status === "none") {
      router.push("/onboarding");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-amber-100">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-amber-100 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/20 p-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-6">
            <span className="text-4xl">⏳</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Waiting for Approval</h1>
          <p className="text-slate-400 mb-6">
            Your request to join <span className="font-semibold text-slate-300">{messName}</span> has been sent to the manager.
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-yellow-700">
              <span className="animate-pulse">●</span>
              <p className="text-sm font-medium">Pending manager approval...</p>
            </div>
            <p className="text-xs text-yellow-600 mt-2">This page will auto-refresh when approved</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                router.push("/onboarding");
              }}
              className="w-full bg-gray-100 hover:bg-gray-200 text-slate-300 font-medium py-2.5 rounded-lg transition-colors"
            >
              ← Try a Different Mess
            </button>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full text-slate-400 hover:text-red-500 text-sm py-2 transition-colors"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
