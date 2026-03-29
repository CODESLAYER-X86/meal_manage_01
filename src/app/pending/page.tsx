"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Clock, ArrowLeft, LogOut, CheckCircle, Loader2 } from "lucide-react";

export default function PendingPage() {
  useSession();
  const router = useRouter();
  const [messName, setMessName] = useState("");
  const [status, setStatus] = useState<"loading" | "pending" | "approved" | "rejected" | "none">("loading");

  useEffect(() => {
    const doCheck = async () => {
      try {
        const res = await fetch("/api/join-requests?own=true");
        const data = await res.json();

        if (data.pendingRequest) {
          setMessName(data.pendingRequest.mess.name);
          setStatus("pending");
        } else {
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

    doCheck();
    const interval = setInterval(doCheck, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status === "approved") {
      router.push("/dashboard");
      router.refresh();
    }
    if (status === "none") {
      router.push("/onboarding");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1c]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-slate-400 font-medium animate-pulse">Loading status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      {/* Animated background */}
      <div className="fixed inset-0 bg-[#0a0f1c]" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(234,179,8,0.1),_transparent_50%)]" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(249,115,22,0.05),_transparent_50%)]" />

      <div className="relative z-10 max-w-md w-full">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-3xl shadow-2xl shadow-black/20 p-8 sm:p-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-500/10 border border-yellow-500/20 rounded-full mb-6 text-yellow-500">
            <Clock className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Waiting for Approval</h1>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Your request to join <span className="font-semibold text-white">{messName || "the mess"}</span> has been sent. The manager needs to approve it.
          </p>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-5 mb-8">
            <div className="flex items-center justify-center gap-3 text-yellow-500">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
              </span>
              <p className="text-sm font-semibold tracking-wide uppercase">Pending Approval</p>
            </div>
            <p className="text-xs text-yellow-500/70 mt-2 font-medium">This page will auto-refresh automatically</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => router.push("/onboarding")}
              className="w-full flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 font-medium py-3 rounded-xl transition-all border border-white/10"
            >
              <ArrowLeft className="w-4 h-4" /> Try a Different Mess
            </button>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-red-400 font-medium py-2 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
