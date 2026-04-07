"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertTriangle, Send, Loader2 } from "lucide-react";

export default function ManagerNotifications() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (session?.user?.role !== "MANAGER") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  if (status === "loading" || !session) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/manager/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send notification");
      }

      setSuccess(`Successfully sent to ${data.sent} active devices (${data.failed} failed/dead endpoints removed).`);
      setTitle("");
      setMessage("");
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 border-b-2 border-red-500/20 pb-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <h1 className="text-3xl font-black tracking-tight text-white uppercase">Broadcast Alert</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Typographic Hero/Instructions (Left - 4 cols) */}
        <div className="md:col-span-4 space-y-4">
          <p className="text-xl font-bold text-slate-200 leading-tight">
            Force a push notification to every active member's phone.
          </p>
          <div className="bg-red-500/10 border-l-4 border-red-500 p-4">
            <p className="text-sm font-medium text-red-400">
              WARNING: This immediately pings the lock screen of everyone who has enabled push notifications. Use sparingly to avoid spam complaints.
            </p>
          </div>
          <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mt-8">
            Transmission Protocol Active
          </p>
        </div>

        {/* Brutalist Form (Right - 8 cols) */}
        <div className="md:col-span-8">
          <form onSubmit={handleSend} className="bg-black/40 border border-white/5 p-6 md:p-8 space-y-6">
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Alert Title
              </label>
              <input
                type="text"
                placeholder="e.g. Dinner Delay"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={40}
                required
                className="w-full bg-transparent border-0 border-b-2 border-white/20 px-0 py-3 text-2xl font-bold text-white placeholder:text-white/20 focus:ring-0 focus:border-red-500 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mt-8">
                Payload Message
              </label>
              <textarea
                placeholder="Details go here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={200}
                required
                rows={4}
                className="w-full bg-white/[0.02] border border-white/20 p-4 text-lg text-slate-200 placeholder:text-white/20 focus:ring-1 focus:ring-red-500 focus:border-red-500 transition-colors resize-none"
              />
              <div className="text-right text-xs font-mono text-slate-500">
                {message.length} / 200
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 text-red-300 px-4 py-3 text-sm font-medium border border-red-500/50">
                [ERROR] {error}
              </div>
            )}

            {success && (
              <div className="bg-emerald-500/20 text-emerald-400 px-4 py-3 text-sm font-medium border border-emerald-500/50">
                [SUCCESS] {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !title.trim() || !message.trim()}
              className="w-full md:w-auto mt-8 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold py-4 px-8 uppercase tracking-widest transition-all disabled:opacity-50 disabled:hover:bg-red-600"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Transmitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Deploy Alert
                </>
              )}
            </button>

          </form>
        </div>

      </div>
    </div>
  );
}
