"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            // Always show success message regardless of response — security
            setSubmitted(true);
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8">
            {/* Background */}
            <div className="fixed inset-0 bg-[#0a0f1c]" />
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.12),_transparent_50%)]" />
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(99,102,241,0.1),_transparent_50%)]" />
            <div className="fixed top-1/3 left-1/3 w-64 h-64 bg-purple-500/8 rounded-full blur-3xl animate-pulse" />

            <div className="relative z-10 max-w-md w-full">
                <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] p-8 sm:p-10 rounded-3xl shadow-2xl shadow-black/20">
                    <div className="text-center mb-7">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-white/10 mb-5 shadow-lg shadow-purple-500/10">
                            <span className="text-3xl">🔑</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Forgot password?</h1>
                        <p className="text-slate-400 mt-1.5 text-sm">Enter your email and we&apos;ll send a reset link</p>
                    </div>

                    {submitted ? (
                        <div className="text-center space-y-4 animate-fadeIn">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                <span className="text-3xl">📬</span>
                            </div>
                            <p className="text-white font-medium">Check your inbox!</p>
                            <p className="text-sm text-slate-400">
                                If an account exists for <strong className="text-slate-300">{email}</strong>, we&apos;ve sent a password reset link. It expires in 1 hour.
                            </p>
                            <Link href="/login" className="inline-block mt-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                                ← Back to login
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-slate-300">Email address</label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">✉</span>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="your@email.com"
                                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400/50 text-white placeholder-slate-500 transition-all duration-200 backdrop-blur-sm"
                                    />
                                </div>
                            </div>
                            {error && <p className="text-sm text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</p>}
                            <button
                                type="submit"
                                disabled={loading || !email}
                                className="w-full relative overflow-hidden bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-3 rounded-xl font-semibold transition-all duration-300 hover:from-purple-600 hover:to-indigo-700 hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] group"
                            >
                                <span className="relative z-10">
                                    {loading ? "Sending…" : "Send Reset Link"}
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                            </button>
                            <p className="text-center text-sm text-slate-400">
                                Remember it?{" "}
                                <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">Sign in →</Link>
                            </p>
                        </form>
                    )}
                </div>

                <p className="text-center text-slate-600 text-xs mt-6">
                    MessMate — Meal management made simple
                </p>
            </div>

            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
            `}</style>
        </div>
    );
}
