"use client";

import { useState } from "react";
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
  const { update } = useSession();

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
      // Refresh session to pick up new messId
      await update();
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
    router.push("/dashboard");
    router.refresh();
  };

  // Success screen after creating a mess
  if (createdCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/20 p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6 text-green-600">
              <PartyPopper className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Mess Created!</h1>
            <p className="text-slate-400 mb-6">Share this invite code with your roommates</p>

            <div className="bg-white/[0.04] border-2 border-dashed border-white/10 rounded-xl p-6 mb-6">
              <p className="text-sm text-slate-400 mb-2">Invite Code</p>
              <p className="text-3xl font-mono font-bold text-blue-600 tracking-widest">
                {createdCode}
              </p>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(createdCode);
              }}
              className="w-full flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/[0.08] text-slate-300 font-medium py-2.5 rounded-lg transition-colors mb-3"
            >
              <Clipboard className="w-4 h-4" /> Copy Code
            </button>

            <button
              onClick={goToDashboard}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" /> Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/20 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4 text-blue-600">
              <Home className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              {step === "choose" && "Get Started"}
              {step === "create" && "Create a Mess"}
              {step === "join" && "Join a Mess"}
            </h1>
            <p className="text-slate-400 mt-1">
              {step === "choose" && "Create a new mess or join an existing one"}
              {step === "create" && "Set up your mess and invite your roommates"}
              {step === "join" && "Enter the invite code — manager will approve your request"}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          {/* Choose Step */}
          {step === "choose" && (
            <div className="space-y-4">
              <button
                onClick={() => { setStep("create"); setError(""); }}
                className="w-full flex items-center gap-4 p-4 border-2 border-white/10 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all group"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors text-blue-600">
                  <Crown className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white">I&apos;m a Manager</p>
                  <p className="text-sm text-slate-400">Create a mess and invite members</p>
                </div>
                <span className="ml-auto text-slate-400">→</span>
              </button>

              <button
                onClick={() => { setStep("join"); setError(""); }}
                className="w-full flex items-center gap-4 p-4 border-2 border-white/10 rounded-xl hover:border-green-400 hover:bg-green-50 transition-all group"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors text-green-600">
                  <Users className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white">Join a Mess</p>
                  <p className="text-sm text-slate-400">Enter an invite code to join</p>
                </div>
                <span className="ml-auto text-slate-400">→</span>
              </button>
            </div>
          )}

          {/* Create Step */}
          {step === "create" && (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center gap-2">
                  <Home className="w-4 h-4" /> Mess Name
                </label>
                <input
                  type="text"
                  value={messName}
                  onChange={(e) => setMessName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                  placeholder="e.g. 42/A Mirpur Mess"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Creating..." : <><Rocket className="w-4 h-4" /> Create Mess</>}
              </button>

              <button
                type="button"
                onClick={() => { setStep("choose"); setError(""); }}
                className="w-full text-slate-400 hover:text-slate-300 text-sm py-2"
              >
                ← Back
              </button>
            </form>
          )}

          {/* Join Step */}
          {step === "join" && (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center gap-2">
                  <Key className="w-4 h-4" /> Invite Code
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-2.5 border border-white/10 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-white placeholder-gray-400 font-mono text-center text-lg tracking-widest"
                  placeholder="MESS-XXXXXX"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Sending Request..." : <><MailPlus className="w-4 h-4" /> Request to Join</>}
              </button>

              <button
                type="button"
                onClick={() => { setStep("choose"); setError(""); }}
                className="w-full text-slate-400 hover:text-slate-300 text-sm py-2"
              >
                ← Back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
