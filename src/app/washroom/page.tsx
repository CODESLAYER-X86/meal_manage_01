"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

interface Member {
  id: string;
  name: string;
}

interface Duty {
  id: string;
  date: string;
  washroomNumber: number;
  memberId: string;
  member: Member;
  status: "PENDING" | "DONE" | "SKIPPED";
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
  const [duties, setDuties] = useState<Duty[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [washroomCount, setWashroomCount] = useState(0);
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isManager = session?.user?.role === "MANAGER";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const fetchDuties = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/washroom?month=${month}&year=${year}`);
      const data = await res.json();
      if (data.disabled) {
        setDisabled(true);
        setDuties([]);
        setMembers([]);
        setWashroomCount(0);
      } else {
        setDisabled(false);
        setDuties(data.duties || []);
        setMembers(data.members || []);
        setWashroomCount(data.washroomCount || 0);
      }
    } catch {
      setError("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchDuties();
  }, [fetchDuties]);

  const generateSchedule = async () => {
    setGenerating(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/washroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate schedule");
        return;
      }
      setSuccess(`Schedule generated! ${data.count} duties assigned.`);
      await fetchDuties();
    } catch {
      setError("Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  const deleteSchedule = async () => {
    if (!confirm(`Delete the entire ${MONTH_NAMES[month - 1]} ${year} washroom schedule?`)) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/washroom?month=${month}&year=${year}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete");
        return;
      }
      setSuccess(`Deleted ${data.deleted} duties.`);
      await fetchDuties();
    } catch {
      setError("Something went wrong");
    }
  };

  const markDuty = async (id: string, status: "DONE" | "SKIPPED" | "PENDING") => {
    try {
      const res = await fetch("/api/washroom", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        setDuties((prev) =>
          prev.map((d) => (d.id === id ? { ...d, status } : d))
        );
      }
    } catch {
      // ignore
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

  // If washroom cleaning is disabled for this mess
  if (!loading && disabled) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <div className="text-5xl mb-4">🚿</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Washroom Cleaning</h1>
          <p className="text-gray-500 text-lg mb-4">
            Washroom cleaning rotation is not enabled for this mess.
          </p>
          {isManager ? (
            <p className="text-sm text-gray-400">
              Go to <a href="/mess-info" className="text-indigo-600 hover:underline font-medium">Mess Info</a> → Washroom Settings to enable it and set the number of washrooms.
            </p>
          ) : (
            <p className="text-sm text-gray-400">Ask your manager to enable it from Mess Info settings.</p>
          )}
        </div>
      </div>
    );
  }

  // Group duties by date
  const daysInMonth = new Date(year, month, 0).getDate();
  const dutiesByDate: Record<string, Duty[]> = {};
  for (const d of duties) {
    const key = new Date(d.date).getDate().toString();
    if (!dutiesByDate[key]) dutiesByDate[key] = [];
    dutiesByDate[key].push(d);
  }

  // Stats: count per member
  const memberStats: Record<string, { total: number; done: number }> = {};
  for (const m of members) {
    memberStats[m.id] = { total: 0, done: 0 };
  }
  for (const d of duties) {
    if (memberStats[d.memberId]) {
      memberStats[d.memberId].total++;
      if (d.status === "DONE") memberStats[d.memberId].done++;
    }
  }

  // Build washroom column numbers array
  const wrColumns = Array.from({ length: washroomCount }, (_, i) => i + 1);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">🚿 Washroom Cleaning</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => changeMonth(-1)} className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
              ←
            </button>
            <span className="text-base sm:text-lg font-semibold text-gray-700 min-w-[140px] text-center">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button onClick={() => changeMonth(1)} className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
              →
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {washroomCount} washroom{washroomCount !== 1 ? "s" : ""} · {members.length} members · Cleaning every 14 days
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm mb-4">
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm mb-4">
            ✅ {success}
          </div>
        )}

        {/* Manager Controls */}
        {isManager && (
          <div className="flex gap-2">
            {duties.length === 0 ? (
              <button
                onClick={generateSchedule}
                disabled={generating}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {generating ? "Generating..." : `🔄 Generate ${MONTH_NAMES[month - 1]} Schedule`}
              </button>
            ) : (
              <button
                onClick={deleteSchedule}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors"
              >
                🗑️ Delete & Regenerate
              </button>
            )}
          </div>
        )}
      </div>

      {/* Member Stats */}
      {duties.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">📊 Monthly Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {members.map((m) => {
              const stats = memberStats[m.id] || { total: 0, done: 0 };
              const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
              return (
                <div key={m.id} className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                  <p className="text-2xl font-bold text-indigo-600">{stats.done}/{stats.total}</p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div
                      className="bg-green-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Schedule Table */}
      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading...</div>
      ) : duties.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <div className="text-5xl mb-4">🚿</div>
          <p className="text-gray-500 text-lg mb-2">No schedule for {MONTH_NAMES[month - 1]} {year}</p>
          {isManager ? (
            <p className="text-sm text-gray-400">Click the button above to generate the rotation</p>
          ) : (
            <p className="text-sm text-gray-400">Ask your manager to generate the schedule</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Day</th>
                  {wrColumns.map((wn) => (
                    <th key={wn} className="text-left px-4 py-3 text-gray-600 font-medium">
                      🚿 WR-{wn}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(dutiesByDate)
                  .map(Number)
                  .sort((a, b) => a - b)
                  .map((day) => {
                  const dayDuties = dutiesByDate[day.toString()] || [];
                  const dateObj = new Date(year, month - 1, day);
                  const isToday = dateObj.getTime() === today.getTime();
                  const isPast = dateObj < today;
                  const dayName = dateObj.toLocaleDateString("en", { weekday: "short" });

                  return (
                    <tr
                      key={day}
                      className={`border-b border-gray-100 ${isToday ? "bg-indigo-50" : isPast ? "bg-gray-50/50" : ""}`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isToday ? "text-indigo-700" : "text-gray-900"}`}>
                            {day}
                          </span>
                          <span className="text-xs text-gray-400">{dayName}</span>
                          {isToday && (
                            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">
                              Today
                            </span>
                          )}
                        </div>
                      </td>
                      {wrColumns.map((wn) => {
                        const duty = dayDuties.find((d) => d.washroomNumber === wn);
                        return (
                          <td key={wn} className="px-4 py-2.5">
                            {duty ? (
                              <DutyCell
                                duty={duty}
                                isOwn={duty.memberId === session?.user?.id}
                                isManager={!!isManager}
                                onMark={markDuty}
                              />
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DutyCell({
  duty,
  isOwn,
  isManager,
  onMark,
}: {
  duty: Duty;
  isOwn: boolean;
  isManager: boolean;
  onMark: (id: string, status: "DONE" | "SKIPPED" | "PENDING") => void;
}) {
  const canToggle = isOwn || isManager;

  const statusColors = {
    PENDING: "bg-yellow-50 text-yellow-800 border-yellow-200",
    DONE: "bg-green-50 text-green-800 border-green-200",
    SKIPPED: "bg-red-50 text-red-800 border-red-200",
  };

  const statusIcons = { PENDING: "⏳", DONE: "✅", SKIPPED: "⏭️" };

  const cycleStatus = () => {
    if (!canToggle) return;
    const next = duty.status === "PENDING" ? "DONE" : duty.status === "DONE" ? "SKIPPED" : "PENDING";
    onMark(duty.id, next);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`text-sm font-medium ${isOwn ? "text-indigo-700" : "text-gray-700"}`}>
        {duty.member.name}
        {isOwn && <span className="text-xs text-gray-400 ml-1">(you)</span>}
      </span>
      <button
        onClick={cycleStatus}
        disabled={!canToggle}
        className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors min-h-[36px] ${statusColors[duty.status]} ${canToggle ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
        title={canToggle ? "Click to change status" : ""}
      >
        {statusIcons[duty.status]} {duty.status}
      </button>
    </div>
  );
}
