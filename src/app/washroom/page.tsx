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
  confirmedByManager: boolean;
  originalMemberId: string | null;
}

interface YearlyStats {
  [memberId: string]: { assigned: number; done: number };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const CLEANING_DAYS = [1, 15, 29];

export default function WashroomPage() {
  const { data: session } = useSession();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [duties, setDuties] = useState<Duty[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [washroomCount, setWashroomCount] = useState(0);
  const [yearlyStats, setYearlyStats] = useState<YearlyStats>({});
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Assignment form state
  const [assignDate, setAssignDate] = useState("");
  const [assignWR, setAssignWR] = useState(1);
  const [assignMember, setAssignMember] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Reassign state
  const [reassignId, setReassignId] = useState<string | null>(null);
  const [reassignMember, setReassignMember] = useState("");
  const [reassignReason, setReassignReason] = useState("");

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
        setYearlyStats(data.yearlyStats || {});
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

  // Manager: assign a duty
  const assignDuty = async () => {
    if (!assignDate || !assignMember) return;
    setAssigning(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/washroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: assignDate, washroomNumber: assignWR, memberId: assignMember }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to assign");
        return;
      }
      setSuccess("Duty assigned!");
      setAssignDate("");
      setAssignMember("");
      await fetchDuties();
    } catch {
      setError("Something went wrong");
    } finally {
      setAssigning(false);
    }
  };

  // Delete a single duty
  const deleteDuty = async (id: string) => {
    if (!confirm("Remove this assignment?")) return;
    setError("");
    try {
      const res = await fetch(`/api/washroom?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSuccess("Removed");
        await fetchDuties();
      }
    } catch {
      setError("Failed to delete");
    }
  };

  // Reassign
  const doReassign = async () => {
    if (!reassignId || !reassignMember) return;
    setError("");
    try {
      const res = await fetch("/api/washroom", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reassignId, action: "reassign", newMemberId: reassignMember, reason: reassignReason }),
      });
      if (res.ok) {
        setSuccess("Reassigned! Duty debt created.");
        setReassignId(null);
        setReassignMember("");
        setReassignReason("");
        await fetchDuties();
      } else {
        const d = await res.json();
        setError(d.error || "Failed");
      }
    } catch {
      setError("Failed");
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
        setDuties((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
      }
    } catch {
      // ignore
    }
  };

  const confirmDuty = async (id: string) => {
    try {
      const res = await fetch("/api/washroom", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "confirm" }),
      });
      if (res.ok) await fetchDuties();
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

  // Build available date options for the assign form (1, 15, 29 of selected month)
  const availableDates = CLEANING_DAYS.map((day) => {
    const d = new Date(year, month - 1, day);
    return { value: d.toISOString().split("T")[0], label: `${MONTH_NAMES[month - 1]} ${day}` };
  });

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

  // Group duties by date
  const dutiesByDate: Record<string, Duty[]> = {};
  for (const d of duties) {
    const key = new Date(d.date).getDate().toString();
    if (!dutiesByDate[key]) dutiesByDate[key] = [];
    dutiesByDate[key].push(d);
  }

  const wrColumns = Array.from({ length: washroomCount }, (_, i) => i + 1);

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
          {washroomCount} washroom{washroomCount !== 1 ? "s" : ""} · Fixed dates: 1st, 15th, 29th · Manager assigns manually
        </p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm mt-3">⚠️ {error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm mt-3">✅ {success}</div>}
      </div>

      {/* Manager: Assign Duty Form */}
      {isManager && (
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-5">
          <h2 className="text-base font-semibold text-indigo-800 mb-3">➕ Assign Cleaning Duty</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select value={assignDate} onChange={(e) => setAssignDate(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
              <option value="">Select date</option>
              {availableDates.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            <select value={assignWR} onChange={(e) => setAssignWR(Number(e.target.value))} className="rounded-lg border px-3 py-2 text-sm">
              {wrColumns.map((wn) => (
                <option key={wn} value={wn}>WR-{wn}</option>
              ))}
            </select>
            <select value={assignMember} onChange={(e) => setAssignMember(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
              <option value="">Select member</option>
              {members.map((m) => {
                const stats = yearlyStats[m.id];
                const count = stats?.assigned || 0;
                return <option key={m.id} value={m.id}>{m.name} ({count} this year)</option>;
              })}
            </select>
            <button onClick={assignDuty} disabled={assigning || !assignDate || !assignMember} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
              {assigning ? "Assigning..." : "Assign"}
            </button>
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {reassignId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm text-yellow-800">Reassign Duty</h3>
          <p className="text-xs text-yellow-600">This will create a duty debt for the original member.</p>
          <select value={reassignMember} onChange={(e) => setReassignMember(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm">
            <option value="">Select member...</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input type="text" placeholder="Reason (optional)" value={reassignReason} onChange={(e) => setReassignReason(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button onClick={doReassign} className="flex-1 bg-yellow-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-yellow-700">Reassign</button>
            <button onClick={() => setReassignId(null)} className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-lg text-sm font-medium">Cancel</button>
          </div>
        </div>
      )}

      {/* Yearly Stats */}
      {members.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">📊 {year} Yearly Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {members.map((m) => {
              const stats = yearlyStats[m.id] || { assigned: 0, done: 0 };
              const pct = stats.assigned > 0 ? Math.round((stats.done / stats.assigned) * 100) : 0;
              return (
                <div key={m.id} className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                  <p className="text-2xl font-bold text-indigo-600">{stats.done}/{stats.assigned}</p>
                  <p className="text-xs text-gray-400">done/assigned</p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Schedule Grid - grouped by date */}
      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading...</div>
      ) : duties.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <div className="text-5xl mb-4">🚿</div>
          <p className="text-gray-500 text-lg mb-2">No duties assigned for {MONTH_NAMES[month - 1]} {year}</p>
          {isManager ? (
            <p className="text-sm text-gray-400">Use the form above to assign cleaning duties on dates 1, 15, or 29</p>
          ) : (
            <p className="text-sm text-gray-400">Manager will assign cleaning duties</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {CLEANING_DAYS.map((day) => {
            const dayDuties = dutiesByDate[day.toString()] || [];
            const dateObj = new Date(year, month - 1, day);
            const isToday = dateObj.getTime() === today.getTime();
            const isPast = dateObj < today;
            const dayName = dateObj.toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" });

            return (
              <div key={day} className={`bg-white rounded-xl shadow-sm border p-5 ${isToday ? "border-indigo-300 bg-indigo-50/30" : "border-gray-200"}`}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className={`text-base font-semibold ${isToday ? "text-indigo-700" : "text-gray-800"}`}>{dayName}</h3>
                  {isToday && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">Today</span>}
                  {isPast && !isToday && <span className="text-xs text-gray-400">Past</span>}
                </div>

                {dayDuties.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No duties assigned for this date</p>
                ) : (
                  <div className="space-y-2">
                    {dayDuties.map((duty) => {
                      const isOwn = duty.memberId === session?.user?.id;
                      const canToggle = isOwn || !!isManager;

                      return (
                        <div key={duty.id} className={`flex flex-wrap items-center gap-2 p-3 rounded-lg border ${duty.status === "DONE" ? "bg-green-50 border-green-200" : duty.status === "SKIPPED" ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-100"}`}>
                          <span className="text-sm font-medium text-gray-500">WR-{duty.washroomNumber}</span>
                          <span className={`text-sm font-medium ${isOwn ? "text-indigo-700" : "text-gray-800"}`}>
                            {duty.member.name}{isOwn && " (you)"}
                          </span>
                          {duty.originalMemberId && <span className="text-xs text-yellow-600">(swapped)</span>}
                          {duty.confirmedByManager && <span className="text-xs text-green-600">✅ Confirmed</span>}

                          <div className="ml-auto flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => {
                                if (!canToggle) return;
                                const next = duty.status === "PENDING" ? "DONE" : duty.status === "DONE" ? "SKIPPED" : "PENDING";
                                markDuty(duty.id, next);
                              }}
                              disabled={!canToggle}
                              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${duty.status === "DONE" ? "bg-green-100 text-green-800 border-green-200" : duty.status === "SKIPPED" ? "bg-red-100 text-red-800 border-red-200" : "bg-yellow-100 text-yellow-800 border-yellow-200"} ${canToggle ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                            >
                              {duty.status === "DONE" ? "✅" : duty.status === "SKIPPED" ? "⏭️" : "⏳"} {duty.status}
                            </button>

                            {isManager && duty.status === "DONE" && !duty.confirmedByManager && (
                              <button onClick={() => confirmDuty(duty.id)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Confirm</button>
                            )}
                            {isManager && (
                              <button onClick={() => setReassignId(duty.id)} className="text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700">Swap</button>
                            )}
                            {isManager && (
                              <button onClick={() => deleteDuty(duty.id)} className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">✕</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
