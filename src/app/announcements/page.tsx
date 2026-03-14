"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  author: { id: string; name: string };
}

export default function AnnouncementsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isManager = session?.user?.role === "MANAGER";

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/announcements");
      const data = await res.json();
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchData();
  }, [status, fetchData]);

  const submit = async () => {
    setError("");
    if (!title.trim() || !body.trim()) {
      setError("Title and message are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), pinned }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed");
        return;
      }
      setShowForm(false);
      setTitle("");
      setBody("");
      setPinned(false);
      await fetchData();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const togglePin = async (id: string, current: boolean) => {
    await fetch("/api/announcements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, pinned: !current }),
    });
    await fetchData();
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    await fetch(`/api/announcements?id=${id}`, { method: "DELETE" });
    await fetchData();
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border border-white/10 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">📢 Announcements</h1>
            <p className="text-sm text-slate-400 mt-0.5">Important notices from the manager</p>
          </div>
          {isManager && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {showForm ? "✕ Cancel" : "➕ New Announcement"}
            </button>
          )}
        </div>
      </div>

      {/* Create Form */}
      {showForm && isManager && (
        <div className="bg-indigo-50 rounded-xl shadow-md shadow-black/10 border border-indigo-200 p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold text-indigo-900">📝 New Announcement</h2>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Gas bill due this week"
              className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Details..."
              rows={4}
              className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none resize-y"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-300">📌 Pin to top</span>
          </label>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">⚠️ {error}</p>}
          <button
            onClick={submit}
            disabled={submitting}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? "Posting..." : "📢 Post Announcement"}
          </button>
        </div>
      )}

      {/* Announcements List */}
      {announcements.length === 0 ? (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border border-white/10 p-10 text-center">
          <div className="text-5xl mb-4">📢</div>
          <p className="text-slate-400 text-lg">No announcements yet</p>
          {isManager && <p className="text-sm text-slate-400 mt-1">Post one above to notify your mess members</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div
              key={a.id}
              className={`bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border overflow-hidden ${a.pinned ? "border-amber-300 ring-1 ring-amber-200" : "border-white/10"
                }`}
            >
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.pinned && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                          📌 Pinned
                        </span>
                      )}
                      <h3 className="text-base font-semibold text-white">{a.title}</h3>
                    </div>
                    <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{a.body}</p>
                    <p className="text-xs text-slate-400 mt-3">
                      By {a.author.name} · {new Date(a.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      {" "}at {new Date(a.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  {isManager && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => togglePin(a.id, a.pinned)}
                        className="p-2 text-sm text-slate-400 hover:text-amber-600 rounded-lg hover:bg-gray-50"
                        title={a.pinned ? "Unpin" : "Pin"}
                      >
                        📌
                      </button>
                      <button
                        onClick={() => deleteAnnouncement(a.id)}
                        className="p-2 text-sm text-slate-400 hover:text-red-600 rounded-lg hover:bg-gray-50"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
