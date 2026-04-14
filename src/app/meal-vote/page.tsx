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
  const [options, setOptions] = useState<string[]>(["", ""]);
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
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (opts.length < 2) { setError("Add at least 2 options"); return; }
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
      setOptions(["", ""]);
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
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20"></div>
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">🗳️ Meal Voting</h1>
            <p className="text-sm text-slate-400 mt-0.5">Vote on what to cook next!</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowClosed(!showClosed)}
              className="px-3.5 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 text-sm font-medium rounded-xl transition-colors border border-white/[0.07]"
            >
              {showClosed ? "Show Active" : "Show Closed"}
            </button>
            {isManager && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-600/20"
              >
                {showForm ? "✕ Cancel" : "➕ New Vote"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Create Form */}
      {showForm && isManager && (
        <div className="bg-white/[0.03] border border-indigo-500/20 rounded-2xl p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-bold text-white">🗳️ Create New Vote</h2>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Question</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. What should we cook for Friday dinner?"
              className="w-full px-4 py-2.5 bg-black/30 border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Options (minimum 2)
            </label>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 w-5 text-right shrink-0">{idx + 1}.</span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const next = [...options];
                      next[idx] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={["e.g. Biryani", "e.g. Khichuri", "e.g. Pasta", "e.g. Fried Rice"][idx] || `Option ${idx + 1}`}
                    className="flex-1 px-4 py-2.5 bg-black/30 border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Remove option"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setOptions([...options, ""])}
                className="text-sm text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 mt-1"
              >
                ➕ Add another option
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">For Date (optional)</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-black/30 border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">For Meal (optional)</label>
              <select
                value={targetMeal}
                onChange={(e) => setTargetMeal(e.target.value)}
                className="w-full px-4 py-2.5 bg-black/30 border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
              >
                <option value="">Any</option>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-rose-400 bg-rose-500/10 px-3.5 py-2.5 rounded-xl border border-rose-500/20">⚠️ {error}</p>}
          <button
            onClick={createTopic}
            disabled={submitting}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 shadow-lg shadow-indigo-600/20"
          >
            {submitting ? "Creating..." : "🗳️ Create Vote"}
          </button>
        </div>
      )}

      {/* Topics */}
      {topics.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-10 text-center">
          <div className="text-5xl mb-4">🗳️</div>
          <p className="text-slate-400 text-lg">
            {showClosed ? "No closed votes" : "No active votes right now"}
          </p>
          {isManager && !showClosed && (
            <p className="text-sm text-slate-500 mt-1">Create one above to let members vote!</p>
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
              <div key={topic.id} className={`bg-white/[0.03] border rounded-2xl overflow-hidden ${topic.active ? "border-white/[0.07]" : "border-white/[0.05] opacity-70"}`}>
                {/* Topic header */}
                <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-white">{topic.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 flex flex-wrap gap-1.5">
                      {topic.targetDate && (
                        <span>📅 {new Date(topic.targetDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      )}
                      {topic.targetMeal && <span className="capitalize">🍽️ {topic.targetMeal}</span>}
                      {!topic.active && <span className="text-amber-400">🔒 Closed</span>}
                      <span>{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
                      {myVote && <span className="text-indigo-400 font-medium">You voted: {myVote.option}</span>}
                    </p>
                  </div>
                  {isManager && (
                    <div className="flex gap-1 shrink-0">
                      {topic.active && (
                        <button onClick={() => closeTopic(topic.id)} className="p-2 text-xs text-slate-500 hover:text-amber-400 rounded-lg hover:bg-white/[0.04]" title="Close voting">
                          🔒
                        </button>
                      )}
                      <button onClick={() => deleteTopic(topic.id)} className="p-2 text-xs text-slate-500 hover:text-red-400 rounded-lg hover:bg-white/[0.04]" title="Delete">
                        🗑️
                      </button>
                    </div>
                  )}
                </div>

                {/* Poll options box */}
                <div className="mx-4 mb-4 sm:mx-5 sm:mb-5 rounded-xl border border-white/[0.07] overflow-hidden divide-y divide-white/[0.05]">
                  {topic.options.map((opt) => {
                    const count = voteCounts[opt] || 0;
                    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    const isMyChoice = myVote?.option === opt;
                    const isWinner = !topic.active && count === maxVotes && count > 0;
                    const voters = topic.votes.filter((v) => v.option === opt).map((v) => v.voter.name);

                    return (
                      <div
                        key={opt}
                        onClick={() => topic.active && !voting && castVote(topic.id, opt)}
                        className={`relative px-4 py-3 transition-colors ${topic.active && !voting ? "cursor-pointer" : "cursor-default"
                          } ${isMyChoice
                            ? "bg-indigo-500/10"
                            : isWinner
                              ? "bg-emerald-500/10"
                              : topic.active
                                ? "hover:bg-white/[0.03]"
                                : ""
                          }`}
                      >
                        {/* Progress bar fill */}
                        {totalVotes > 0 && (
                          <div
                            className={`absolute inset-y-0 left-0 transition-all duration-500 ${isMyChoice ? "bg-indigo-500/10" : isWinner ? "bg-emerald-500/10" : "bg-white/[0.03]"
                              }`}
                            style={{ width: `${pct}%`, opacity: 0.6 }}
                          />
                        )}

                        <div className="relative flex items-center gap-3">
                          {/* Radio circle indicator */}
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${isMyChoice
                            ? "border-indigo-500 bg-indigo-500"
                            : isWinner
                              ? "border-emerald-500 bg-emerald-500"
                              : "border-white/20"
                            }`}>
                            {(isMyChoice || isWinner) && (
                              <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            )}
                          </div>

                          {/* Option text */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-medium ${isMyChoice ? "text-indigo-300" : isWinner ? "text-emerald-300" : "text-slate-200"
                                }`}>
                                {isWinner && "🏆 "}{opt}
                              </span>
                              {isMyChoice && (
                                <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/15 px-1.5 py-0.5 rounded-full">(your vote)</span>
                              )}
                            </div>
                            {voters.length > 0 && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{voters.join(", ")}</p>
                            )}
                          </div>

                          {/* Count + percentage */}
                          <div className="text-right flex-shrink-0">
                            <span className={`text-sm font-black ${isMyChoice ? "text-indigo-300" : isWinner ? "text-emerald-300" : "text-slate-300"
                              }`}>
                              {count}
                            </span>
                            <span className="text-xs text-slate-500 ml-1">({pct}%)</span>
                          </div>
                        </div>

                        {/* Progress bar below text */}
                        {totalVotes > 0 && (
                          <div className="relative mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isMyChoice ? "bg-indigo-500" : isWinner ? "bg-emerald-500" : "bg-white/[0.12]"
                                }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Loading indicator */}
                {voting === topic.id && (
                  <div className="px-5 pb-4">
                    <p className="text-xs text-slate-500 text-center">Casting vote...</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
