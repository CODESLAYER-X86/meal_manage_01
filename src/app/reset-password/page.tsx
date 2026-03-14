"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ResetForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token") || "";
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (password !== confirm) { setError("Passwords do not match."); return; }
        setLoading(true);
        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, newPassword: password }),
            });
            const data = await res.json();
            if (data.success) {
                setSuccess(true);
                setTimeout(() => router.push("/login"), 3000);
            } else {
                setError(data.error || "Something went wrong.");
            }
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const requirements = [
        { label: "8+ chars", ok: password.length >= 8 },
        { label: "Uppercase", ok: /[A-Z]/.test(password) },
        { label: "Lowercase", ok: /[a-z]/.test(password) },
        { label: "Number", ok: /[0-9]/.test(password) },
    ];

    const allMet = requirements.every(r => r.ok);
    const passwordsMatch = confirm.length > 0 && password === confirm;

    if (!token) {
        return (
            <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20">
                    <span className="text-3xl">⚠️</span>
                </div>
                <p className="text-slate-300">Invalid or expired reset link.</p>
                <Link href="/forgot-password" className="inline-block text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                    Request a new one →
                </Link>
            </div>
        );
    }

    if (success) {
        return (
            <div className="text-center space-y-4 animate-fadeIn">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-3xl">✅</span>
                </div>
                <p className="text-white font-semibold">Password reset successfully!</p>
                <p className="text-sm text-slate-500">Redirecting to login…</p>
                <Link href="/login" className="inline-block mt-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all">
                    Go to Login
                </Link>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">New Password</label>
                <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔑</span>
                    <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="New password"
                        className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400/50 text-white placeholder-slate-500 transition-all duration-200 backdrop-blur-sm"
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

            {/* Requirements */}
            {password.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {requirements.map(r => (
                        <span
                            key={r.label}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-300 ${r.ok
                                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                                    : "bg-white/5 text-slate-500 border border-white/5"
                                }`}
                        >
                            <span className="text-[10px]">{r.ok ? "✓" : "○"}</span>
                            {r.label}
                        </span>
                    ))}
                </div>
            )}

            <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">Confirm Password</label>
                <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔑</span>
                    <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        placeholder="Re-enter new password"
                        className={`w-full pl-10 pr-10 py-3 bg-white/5 border rounded-xl focus:ring-2 text-white placeholder-slate-500 transition-all duration-200 backdrop-blur-sm ${confirm.length > 0
                                ? passwordsMatch
                                    ? "border-emerald-500/40 focus:ring-emerald-400/50"
                                    : "border-red-500/40 focus:ring-red-400/50"
                                : "border-white/10 focus:ring-indigo-400/50"
                            }`}
                    />
                    {confirm.length > 0 && (
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm">
                            {passwordsMatch ? "✅" : "❌"}
                        </span>
                    )}
                </div>
            </div>

            {error && <p className="text-sm text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</p>}

            <button
                type="submit"
                disabled={loading || !allMet || !passwordsMatch}
                className="w-full relative overflow-hidden bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold transition-all duration-300 hover:from-indigo-600 hover:to-purple-700 hover:shadow-lg hover:shadow-indigo-500/25 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] group"
            >
                <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading ? (
                        <>
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Resetting…
                        </>
                    ) : (
                        "Reset Password"
                    )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </button>
        </form>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8">
            {/* Background */}
            <div className="fixed inset-0 bg-[#0a0f1c]" />
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.12),_transparent_50%)]" />
            <div className="fixed top-1/4 right-1/3 w-64 h-64 bg-indigo-500/8 rounded-full blur-3xl animate-pulse" />
            <div className="fixed bottom-1/4 left-1/3 w-80 h-80 bg-purple-500/8 rounded-full blur-3xl animate-pulse delay-1000" />

            <div className="relative z-10 max-w-md w-full">
                <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] p-8 sm:p-10 rounded-3xl shadow-2xl shadow-black/20">
                    <div className="text-center mb-7">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 mb-5 shadow-lg shadow-indigo-500/10">
                            <span className="text-3xl">🔐</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Reset Password</h1>
                        <p className="text-slate-400 mt-1.5 text-sm">Choose a new secure password</p>
                    </div>
                    <Suspense fallback={<div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" /></div>}>
                        <ResetForm />
                    </Suspense>
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
                .delay-1000 { animation-delay: 1s; }
            `}</style>
        </div>
    );
}
