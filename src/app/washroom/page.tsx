"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

interface Member {
  id: string;
  name: string;
}

interface Cleaning {
  id: string;
  date: string;
  washroomNumber: number;
  memberId: string;
  member: Member;
  status: string;
  note: string | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function WashroomPage() {
  const { data: session } = useSession();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [cleanings, setCleanings] = useState<Cleaning[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [washroomCount, setWashroomCount] = useState(0);
  const [yearlyStats, setYearlyStats] = useState<Record<string, number>>({});
  const [nextDueDates, setNextDueDates] = useState<Record<number, string | null>>({});
  const [intervalDays, setIntervalDays] = useState(14);
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Log cleaning form state
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);
  const [logWR, setLogWR] = useState(1);
  const [logMember, setLogMember] = useState("");
  const [logNote, setLogNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isManager = session?.user?.role === "MANAGER";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/washroom?month=${month}&year=${year}`);
      const data = await res.json();
      if (data.disabled) {
        setDisabled(true);
        setCleanings([]);
        setMembers([]);
        setWashroomCount(0);
      } else {
        setDisabled(false);
        setCleanings(data.cleanings || []);
        setMembers(data.members || []);
        setWashroomCount(data.washroomCount || 0);
        setYearlyStats(data.yearlyStats || {});
        setNextDueDates(data.nextDueDates || {});
        setIntervalDays(data.intervalDays || 14);
      }
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Manager: log a cleaning
  const logCleaning = async () => {
    if (!logDate || !logMember) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/washroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: logDate, washroomNumber: logWR, memberId: logMember, note: logNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to log cleaning");
        return;
      }
      setSuccess("Cleaning logged!");
      setLogMember("");
      setLogNote("");
      await fetchData();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete a cleaning record
  const deleteCleaning = async (id: string) => {
    if (!confirm("Remove this cleaning record?")) return;
    setError("");
    try {
      const res = await fetch(`/api/washroom?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSuccess("Removed");
        await fetchData();
      }
    } catch {
      setError("Failed to delete");
    }
  };

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m);
    setYear(y);
    setSuccess("");
    setError("");
  };

  if (!loading && disabled) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <div className="text-5xl mb-4">🚿</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Washroom Cleaning</h1>
          <p className="text-gray-500 text-lg mb-4">Washroom cleaning is not enabled for this mess.</p>
          {isManager ? (
            <p className="text-sm text-gray-400">
              Go to <a href="/mess-info" className="text-indigo-600 hover:underline font-medium">Mess Info</a> → Washroom Settings to enable it.
            </p>
          ) : (
            <p className="text-sm text-gray-400">Ask your manager to enable it from Mess Info settings.</p>
          )}
        </div>
      </div>
    );
  }

  const wrColumns = Array.from({ length: washroomCount }, (_, i) => i + 1);

  // Check if a next due date is overdue
  const isOverdue = (dateStr: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date(new Date().toISOString().split("T")[0]);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">🚿 Washroom Cleaning</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => changeMonth(-1)} className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">←</button>
            <span className="text-base sm:text-lg font-semibold text-gray-700 min-w-[140px] text-center">{MONTH_NAMES[month - 1]} {year}</span>
            <button onClick={() => changeMonth(1)} className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">→</button>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          {washroomCount} washroom{washroomCount !== 1 ? "s" : ""} · Next cleaning due every {intervalDays} days · Manager logs who cleaned
        </p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm mt-3">⚠️ {error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm mt-3">✅ {success}</div>}
      </div>

      {/* Next Due Dates */}
      {washroomCount > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">📅 Next Cleaning Due</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {wrColumns.map((wn) => {
              const dueDate = nextDueDates[wn];
              const overdue = isOverdue(dueDate);
              return (
                <div key={wn} className={`rounded-lg p-4 border ${overdue ? "bg-red-50 border-red-200" : dueDate ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
                  <p className="text-sm font-semibold text-gray-700">WR-{wn}</p>
                  {dueDate ? (
                    <>
                      <p className={`text-lg font-bold ${overdue ? "text-red-600" : "text-blue-600"}`}>
                        {new Date(dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      {overdue && <p className="text-xs text-red-500 font-medium">⚠️ Overdue!</p>}
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Never cleaned</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manager: Log Cleaning Form */}
      {isManager && (
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-5">
          <h2 className="text-base font-semibold text-indigo-800 mb-3">✍️ Log Washroom Cleaning</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-indigo-700 mb-1">Date</label>
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-indigo-700 mb-1">Washroom</label>
              <select value={logWR} onChange={(e) => setLogWR(Number(e.target.value))} className="w-full rounded-lg border px-3 py-2 text-sm">
                {wrColumns.map((wn) => (
                  <option key={wn} value={wn}>WR-{wn}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-indigo-700 mb-1">Cleaned by</label>
              <select value={logMember} onChange={(e) => setLogMember(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm">
                <option value="">Select member</option>
                {members.map((m) => {
                  const count = yearlyStats[m.id] || 0;
                  return <option key={m.id} value={m.id}>{m.name} ({count} this year)</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-indigo-700 mb-1">Note</label>
              <input
                type="text"
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Optional..."
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={logCleaning}
                disabled={submitting || !logDate || !logMember}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {submitting ? "Logging..." : "Log Cleaning"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Yearly Stats */}
      {members.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">📊 {year} Cleaning Count</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {members.map((m) => {
              const count = yearlyStats[m.id] || 0;
              return (
                <div key={m.id} className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                  <p className="text-2xl font-bold text-indigo-600">{count}</p>
                  <p className="text-xs text-gray-400">cleanings</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cleaning Log */}
      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading...</div>
      ) : cleanings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <div className="text-5xl mb-4">🚿</div>
          <p className="text-gray-500 text-lg mb-2">No cleanings recorded for {MONTH_NAMES[month - 1]} {year}</p>
          {isManager ? (
            <p className="text-sm text-gray-400">Use the form above to log when someone cleans a washroom</p>
          ) : (
            <p className="text-sm text-gray-400">Manager will log cleaning records</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">🧹 Cleaning Log — {MONTH_NAMES[month - 1]} {year}</h2>
            <p className="text-xs text-gray-400">{cleanings.length} record{cleanings.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="divide-y">
            {cleanings.map((c) => {
              const dateStr = new Date(c.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              const isOwn = c.memberId === session?.user?.id;

              return (
                <div key={c.id} className="p-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-gray-500 text-xs w-28">{dateStr}</span>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">WR-{c.washroomNumber}</span>
                  <span className={`font-medium ${isOwn ? "text-indigo-700" : "text-gray-800"}`}>
                    {c.member.name}{isOwn && " (you)"}
                  </span>
                  {c.note && <span className="text-xs text-gray-400 italic">— {c.note}</span>}

                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      ✅ Done
                    </span>
                    {isManager && (
                      <button onClick={() => deleteCleaning(c.id)} className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">✕</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
