"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notVerified, setNotVerified] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "true";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      if (result.error === "email_not_verified") {
        setNotVerified(true);
        setError("");
      } else {
        setError("Invalid email or password");
        setNotVerified(false);
      }
      setLoading(false);
    } else {
      router.push("/");
    }
  };

  return (
    <>
      {justRegistered && (
        <div className="backdrop-blur-sm bg-emerald-500/10 border border-emerald-400/30 text-emerald-100 px-4 py-3 rounded-xl mb-6 text-sm flex items-start gap-3 animate-fadeIn">
          <span className="text-lg mt-0.5">📬</span>
          <span>Account created! Check your email to verify before logging in.</span>
        </div>
      )}

      {notVerified && (
        <div className="backdrop-blur-sm bg-amber-500/10 border border-amber-400/30 text-amber-200 px-4 py-3 rounded-xl mb-4 text-sm animate-fadeIn">
          <p className="font-semibold mb-1">📧 Email not verified</p>
          <p className="text-amber-300/80">Please check your inbox and click the verification link.</p>
          {!resendSent ? (
            <button
              onClick={async () => {
                await fetch("/api/auth/resend-verification", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email }),
                });
                setResendSent(true);
              }}
              className="mt-2 text-amber-200 hover:text-white underline underline-offset-2 text-xs transition-colors"
            >
              Resend verification email →
            </button>
          ) : (
            <p className="mt-2 text-emerald-400 text-xs font-medium">✅ Sent! Check your inbox.</p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="backdrop-blur-sm bg-red-500/10 border border-red-400/30 text-red-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-shake">
            <span>⚠️</span> {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-300">
            Email
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">✉</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400/50 text-white placeholder-slate-500 transition-all duration-200 backdrop-blur-sm"
              placeholder="you@example.com"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-300">
            Password
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔑</span>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400/50 text-white placeholder-slate-500 transition-all duration-200 backdrop-blur-sm"
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors text-sm"
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full relative overflow-hidden bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold transition-all duration-300 hover:from-indigo-600 hover:to-purple-700 hover:shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] group"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Logging in...
              </>
            ) : (
              "Log In"
            )}
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
        </button>
      </form>

      <div className="mt-8 text-center space-y-3">
        <Link href="/forgot-password" className="block text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
          Forgot your password?
        </Link>
        <div className="flex items-center gap-3 text-slate-600 text-xs">
          <div className="flex-1 h-px bg-white/10" />
          <span>or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        <p className="text-slate-400 text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
            Create one →
          </Link>
        </p>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8">
      {/* Animated background */}
      <div className="fixed inset-0 bg-[#0a0f1c]" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(99,102,241,0.15),_transparent_50%)]" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(168,85,247,0.12),_transparent_50%)]" />
      <div className="fixed top-1/4 left-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative z-10 max-w-md w-full">
        {/* Glass card */}
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] p-8 sm:p-10 rounded-3xl shadow-2xl shadow-black/20">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 mb-5 shadow-lg shadow-indigo-500/10">
              <span className="text-3xl">🍽️</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Welcome back</h1>
            <p className="text-slate-400 mt-1.5 text-sm">Sign in to your MessMate account</p>
          </div>

          <Suspense fallback={<div className="text-center text-slate-500 py-8">Loading...</div>}>
            <LoginForm />
          </Suspense>
        </div>

        {/* Subtle bottom text */}
        <p className="text-center text-slate-600 text-xs mt-6">
          MessMate — Meal management made simple
        </p>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
        .animate-shake { animation: shake 0.3s ease-out; }
        .delay-1000 { animation-delay: 1s; }
      `}</style>
    </div>
  );
}
