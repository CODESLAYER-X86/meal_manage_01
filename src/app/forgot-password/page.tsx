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
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full">
                <div className="text-center mb-6">
                    <div className="text-4xl mb-3">🔑</div>
                    <h1 className="text-2xl font-bold text-gray-900">Forgot Password?</h1>
                    <p className="text-sm text-gray-500 mt-1">Enter your email and we&apos;ll send a reset link</p>
                </div>

                {submitted ? (
                    <div className="text-center space-y-4">
                        <div className="text-5xl">📬</div>
                        <p className="text-gray-700 font-medium">Check your inbox!</p>
                        <p className="text-sm text-gray-500">
                            If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link. It expires in 1 hour.
                        </p>
                        <Link href="/login" className="inline-block mt-2 text-sm text-indigo-600 hover:underline">
                            ← Back to login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none transition"
                            />
                        </div>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                        <button
                            type="submit"
                            disabled={loading || !email}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl disabled:opacity-50 transition-colors"
                        >
                            {loading ? "Sending…" : "Send Reset Link"}
                        </button>
                        <p className="text-center text-sm text-gray-500">
                            Remember it?{" "}
                            <Link href="/login" className="text-indigo-600 hover:underline font-medium">Log in</Link>
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
}
