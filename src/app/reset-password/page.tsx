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
        { label: "At least 8 characters", ok: password.length >= 8 },
        { label: "One uppercase letter", ok: /[A-Z]/.test(password) },
        { label: "One lowercase letter", ok: /[a-z]/.test(password) },
        { label: "One number", ok: /[0-9]/.test(password) },
    ];

    if (!token) {
        return (
            <div className="text-center space-y-4">
                <div className="text-4xl">⚠️</div>
                <p className="text-gray-600">Invalid reset link.</p>
                <Link href="/forgot-password" className="text-indigo-600 text-sm hover:underline">Request a new one →</Link>
            </div>
        );
    }

    if (success) {
        return (
            <div className="text-center space-y-4">
                <div className="text-5xl">✅</div>
                <p className="text-gray-800 font-semibold">Password reset successfully!</p>
                <p className="text-sm text-gray-400">Redirecting to login…</p>
                <Link href="/login" className="inline-block mt-2 px-6 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg">Go to Login</Link>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="New password"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none transition"
                />
            </div>

            {/* Requirements checklist */}
            {password.length > 0 && (
                <div className="grid grid-cols-2 gap-1">
                    {requirements.map(r => (
                        <p key={r.label} className={`text-xs flex items-center gap-1 ${r.ok ? "text-green-600" : "text-gray-400"}`}>
                            <span>{r.ok ? "✓" : "○"}</span> {r.label}
                        </p>
                    ))}
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                    type="password"
                    required
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none transition"
                />
                {confirm && password !== confirm && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

            <button
                type="submit"
                disabled={loading || requirements.some(r => !r.ok) || password !== confirm}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl disabled:opacity-50 transition-colors"
            >
                {loading ? "Resetting…" : "Reset Password"}
            </button>
        </form>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full">
                <div className="text-center mb-6">
                    <div className="text-4xl mb-3">🔐</div>
                    <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
                    <p className="text-sm text-gray-500 mt-1">Choose a new secure password</p>
                </div>
                <Suspense fallback={<div className="flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" /></div>}>
                    <ResetForm />
                </Suspense>
            </div>
        </div>
    );
}
