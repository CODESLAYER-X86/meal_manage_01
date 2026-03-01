"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Vote {
  id: string;
  voterId: string;
  voter: { id: string; name: string };
  option: string;
}

interface VoteTopic {
  id: string;
  title: string;
  options: string[];
  targetDate: string | null;
  targetMeal: string | null;
  active: boolean;
  createdAt: string;
  votes: Vote[];
}

export default function MealVotePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [topics, setTopics] = useState<VoteTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [targetMeal, setTargetMeal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [voting, setVoting] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const isManager = session?.user?.role === "MANAGER";

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/meal-vote?active=${!showClosed}`);
      const data = await res.json();
      setTopics(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [showClosed]);

  useEffect(() => {
    if (status === "authenticated") fetchData();
  }, [status, fetchData]);

  const createTopic = async () => {
    setError("");
    if (!title.trim()) { setError("Title is required"); return; }
    const opts = optionsText.split("\n").map((o) => o.trim()).filter(Boolean);
    if (opts.length < 2) { setError("Enter at least 2 options (one per line)"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/meal-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          options: opts,
          targetDate: targetDate || null,
          targetMeal: targetMeal || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed");
        return;
      }
      setShowForm(false);
      setTitle("");
      setOptionsText("");
      setTargetDate("");
      setTargetMeal("");
      await fetchData();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const castVote = async (topicId: string, option: string) => {
    setVoting(topicId);
    try {
      await fetch("/api/meal-vote", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, option }),
      });
      await fetchData();
    } catch {
      // ignore
    } finally {
      setVoting(null);
    }
  };

  const closeTopic = async (topicId: string) => {
    if (!confirm("Close this vote? No more voting will be allowed.")) return;
    await fetch("/api/meal-vote", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId, close: true }),
    });
    await fetchData();
  };

  const deleteTopic = async (topicId: string) => {
    if (!confirm("Delete this vote permanently?")) return;
    await fetch(`/api/meal-vote?id=${topicId}`, { method: "DELETE" });
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🗳️ Meal Voting</h1>
            <p className="text-sm text-gray-500 mt-0.5">Vote on what to cook next!</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowClosed(!showClosed)}
              className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              {showClosed ? "Show Active" : "Show Closed"}
            </button>
            {isManager && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {showForm ? "✕ Cancel" : "➕ New Vote"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Create Form */}
      {showForm && isManager && (
        <div className="bg-purple-50 rounded-xl shadow-sm border border-purple-200 p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold text-purple-900">🗳️ Create New Vote</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. What should we cook for Friday dinner?"
              className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Options (one per line, minimum 2)
            </label>
            <textarea
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder={"Biryani\nKhichuri\nPasta\nFried Rice"}
              rows={4}
              className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none resize-y"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">For Date (optional)</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">For Meal (optional)</label>
              <select
                value={targetMeal}
                onChange={(e) => setTargetMeal(e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none"
              >
                <option value="">Any</option>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">⚠️ {error}</p>}
          <button
            onClick={createTopic}
            disabled={submitting}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating..." : "🗳️ Create Vote"}
          </button>
        </div>
      )}

      {/* Topics */}
      {topics.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <div className="text-5xl mb-4">🗳️</div>
          <p className="text-gray-500 text-lg">
            {showClosed ? "No closed votes" : "No active votes right now"}
          </p>
          {isManager && !showClosed && (
            <p className="text-sm text-gray-400 mt-1">Create one above to let members vote!</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {topics.map((topic) => {
            const myVote = topic.votes.find((v) => v.voterId === session?.user?.id);
            const totalVotes = topic.votes.length;

            // Count votes per option
            const voteCounts: Record<string, number> = {};
            for (const opt of topic.options) voteCounts[opt] = 0;
            for (const v of topic.votes) voteCounts[v.option] = (voteCounts[v.option] || 0) + 1;

            const maxVotes = Math.max(...Object.values(voteCounts), 1);

            return (
              <div key={topic.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${topic.active ? "border-gray-200" : "border-gray-100 opacity-80"}`}>
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{topic.title}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {topic.targetDate && new Date(topic.targetDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        {topic.targetMeal && ` · ${topic.targetMeal}`}
                        {!topic.active && " · 🔒 Closed"}
                        {" · "}{totalVotes} vote{totalVotes !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {isManager && (
                      <div className="flex gap-1 shrink-0">
                        {topic.active && (
                          <button onClick={() => closeTopic(topic.id)} className="p-2 text-xs text-gray-400 hover:text-orange-600 rounded-lg hover:bg-gray-50" title="Close voting">
                            🔒
                          </button>
                        )}
                        <button onClick={() => deleteTopic(topic.id)} className="p-2 text-xs text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-50" title="Delete">
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Options */}
                  <div className="space-y-2">
                    {topic.options.map((opt) => {
                      const count = voteCounts[opt] || 0;
                      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                      const isMyChoice = myVote?.option === opt;
                      const isWinner = !topic.active && count === maxVotes && count > 0;

                      return (
                        <button
                          key={opt}
                          onClick={() => topic.active && castVote(topic.id, opt)}
                          disabled={!topic.active || voting === topic.id}
                          className={`w-full text-left relative overflow-hidden rounded-lg border p-3 transition-colors ${
                            isMyChoice
                              ? "border-indigo-300 bg-indigo-50"
                              : isWinner
                              ? "border-green-300 bg-green-50"
                              : "border-gray-200 hover:border-indigo-200 hover:bg-gray-50"
                          } ${!topic.active ? "cursor-default" : "cursor-pointer"}`}
                        >
                          {/* Progress bar background */}
                          <div
                            className={`absolute inset-y-0 left-0 transition-all ${
                              isMyChoice ? "bg-indigo-100" : isWinner ? "bg-green-100" : "bg-gray-100"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                          <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isMyChoice && <span className="text-indigo-600">✓</span>}
                              {isWinner && <span>🏆</span>}
                              <span className={`text-sm font-medium ${isMyChoice ? "text-indigo-700" : "text-gray-800"}`}>
                                {opt}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 font-medium">{count} ({pct}%)</span>
                          </div>
                          {/* Voters */}
                          {count > 0 && (
                            <div className="relative mt-1.5">
                              <p className="text-xs text-gray-400">
                                {topic.votes.filter((v) => v.option === opt).map((v) => v.voter.name).join(", ")}
                              </p>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
