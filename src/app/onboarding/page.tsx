"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PartyPopper, Clipboard, Home, AlertTriangle, Crown, Users, Rocket, Key, MailPlus } from "lucide-react";

export default function OnboardingPage() {
  const [step, setStep] = useState<"choose" | "create" | "join">("choose");
  const [messName, setMessName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState("");
  const router = useRouter();
  const { data: session, update, status } = useSession();

  // Safety guard: check fresh API status, not just the potentially stale session
  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/mess", { cache: "no-store" })
        .then(res => res.json())
        .then(data => {
          if (data.mess) {
            window.location.href = "/dashboard";
          }
        })
        .catch(() => {});
    }
  }, [status]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/mess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", messName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create mess");
        return;
      }

      setCreatedCode(data.mess.inviteCode);
      // Refresh session with the NEW messId so the JWT is immediately updated.
      // Without this, the token's messId stays null for up to 5 minutes (the DB refresh interval),
      // which causes the user to be redirected back to /onboarding if they close and reopen the tab.
      await update({ user: { messId: data.mess.id } });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/mess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", inviteCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send request");
        return;
      }

      // Request sent — go to pending page
      router.push("/pending");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const goToDashboard = () => {
    // Use hard navigation so the server re-reads the updated JWT with the new messId.
    // router.push keeps the client-side cached session which may still show messId as null.
    window.location.href = "/dashboard";
  };

  // Success screen after creating a mess
  if (createdCode) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
        {/* Animated background */}
        <div className="fixed inset-0 bg-[#0a0f1c]" />
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(34,197,94,0.15),_transparent_50%)]" />
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(16,185,129,0.1),_transparent_50%)]" />

        <div className="relative z-10 max-w-md w-full">
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-3xl shadow-2xl shadow-black/20 p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full mb-6 text-green-400">
              <PartyPopper className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Mess Created!</h1>
            <p className="text-slate-400 mb-6">Share this invite code with your roommates</p>

            <div className="bg-white/[0.04] border-2 border-dashed border-white/10 rounded-xl p-6 mb-6">
              <p className="text-sm text-slate-400 mb-2 font-medium">Invite Code</p>
              <p className="text-3xl font-mono font-bold text-blue-400 tracking-widest">
                {createdCode}
              </p>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(createdCode);
              }}
              className="w-full flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 font-medium py-3 rounded-xl transition-all mb-3 border border-white/10"
            >
              <Clipboard className="w-4 h-4" /> Copy Code
            </button>

            <button
              onClick={goToDashboard}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/25"
            >
              <Home className="w-4 h-4" /> Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      {/* Animated background */}
      <div className="fixed inset-0 bg-[#0a0f1c]" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(99,102,241,0.15),_transparent_50%)]" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(168,85,247,0.12),_transparent_50%)]" />

      <div className="relative z-10 max-w-md w-full">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-3xl shadow-2xl shadow-black/20 p-8 sm:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl mb-4 text-blue-400">
              <Home className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {step === "choose" && "Get Started"}
              {step === "create" && "Create a Mess"}
              {step === "join" && "Join a Mess"}
            </h1>
            <p className="text-slate-400 mt-2 text-sm leading-relaxed">
              {step === "choose" && "Create a new mess or join an existing one"}
              {step === "create" && "Set up your mess and invite your roommates"}
              {step === "join" && "Enter the invite code — manager will approve your request"}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2 animate-pulse">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* Choose Step */}
          {step === "choose" && (
            <div className="space-y-4">
              <button
                onClick={() => { setStep("create"); setError(""); }}
                className="w-full flex items-center gap-4 p-5 bg-white/[0.03] border border-white/10 rounded-2xl hover:border-blue-500/50 hover:bg-white/[0.06] transition-all group"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center group-hover:bg-blue-500/20 transition-colors text-blue-400">
                  <Crown className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white">I&apos;m a Manager</p>
                  <p className="text-sm text-slate-400">Create a mess and invite members</p>
                </div>
                <span className="ml-auto text-slate-500 group-hover:text-blue-400 transition-colors">→</span>
              </button>

              <button
                onClick={() => { setStep("join"); setError(""); }}
                className="w-full flex items-center gap-4 p-5 bg-white/[0.03] border border-white/10 rounded-2xl hover:border-green-500/50 hover:bg-white/[0.06] transition-all group"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center group-hover:bg-green-500/20 transition-colors text-green-400">
                  <Users className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white">Join a Mess</p>
                  <p className="text-sm text-slate-400">Enter an invite code to join</p>
                </div>
                <span className="ml-auto text-slate-500 group-hover:text-green-400 transition-colors">→</span>
              </button>
            </div>
          )}

          {/* Create Step */}
          {step === "create" && (
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Home className="w-4 h-4 text-slate-500" /> Mess Name
                </label>
                <input
                  type="text"
                  value={messName}
                  onChange={(e) => setMessName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-white placeholder-slate-500 transition-all outline-none"
                  placeholder="e.g. 42/A Mirpur Mess"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
              >
                {loading ? "Creating..." : <><Rocket className="w-4 h-4" /> Create Mess</>}
              </button>

              <button
                type="button"
                onClick={() => { setStep("choose"); setError(""); }}
                className="w-full text-slate-500 hover:text-slate-300 text-sm py-2 transition-colors"
              >
                ← Back to choice
              </button>
            </form>
          )}

          {/* Join Step */}
          {step === "join" && (
            <form onSubmit={handleJoin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Key className="w-4 h-4 text-slate-500" /> Invite Code
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-white placeholder-slate-500 font-mono text-center text-lg tracking-widest outline-none transition-all"
                  placeholder="MESS-XXXXXX"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-green-500/25 disabled:opacity-50"
              >
                {loading ? "Sending Request..." : <><MailPlus className="w-4 h-4" /> Request to Join</>}
              </button>

              <button
                type="button"
                onClick={() => { setStep("choose"); setError(""); }}
                className="w-full text-slate-500 hover:text-slate-300 text-sm py-2 transition-colors"
              >
                ← Back to choice
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
