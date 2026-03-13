"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token");
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setMessage("No verification token provided.");
            return;
        }
        fetch("/api/auth/verify-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
        })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    setStatus("success");
                    setMessage(data.message);
                    setTimeout(() => router.push("/login"), 3000);
                } else {
                    setStatus("error");
                    setMessage(data.error || "Verification failed.");
                }
            })
            .catch(() => { setStatus("error"); setMessage("Something went wrong."); });
    }, [token, router]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full text-center">
                {status === "loading" && (
                    <>
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
                        <p className="text-gray-600">Verifying your email…</p>
                    </>
                )}
                {status === "success" && (
                    <>
                        <div className="text-5xl mb-4">✅</div>
                        <h1 className="text-xl font-bold text-gray-900 mb-2">Email Verified!</h1>
                        <p className="text-gray-500 text-sm mb-4">{message}</p>
                        <p className="text-xs text-gray-400">Redirecting to login in 3 seconds…</p>
                        <Link href="/login" className="inline-block mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors">
                            Go to Login
                        </Link>
                    </>
                )}
                {status === "error" && (
                    <>
                        <div className="text-5xl mb-4">❌</div>
                        <h1 className="text-xl font-bold text-gray-900 mb-2">Verification Failed</h1>
                        <p className="text-gray-500 text-sm mb-6">{message}</p>
                        <ResendForm />
                    </>
                )}
            </div>
        </div>
    );
}

function ResendForm() {
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleResend = async () => {
        setLoading(true);
        await fetch("/api/auth/resend-verification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });
        setSent(true);
        setLoading(false);
    };

    if (sent) return <p className="text-green-600 text-sm font-medium">If that email is registered, we sent a new link! Check your inbox.</p>;

    return (
        <div className="space-y-3">
            <p className="text-xs text-gray-400 mb-2">Enter your email to get a new verification link:</p>
            <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
            />
            <button
                onClick={handleResend}
                disabled={!email || loading}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
                {loading ? "Sending…" : "Resend Verification Email"}
            </button>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>}>
            <VerifyEmailContent />
        </Suspense>
    );
}
