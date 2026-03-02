"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Member { id: string; name: string; }
interface BazarDutyEntry {
  id: string;
  date: string;
  memberId: string;
  status: string;
  originalMemberId: string | null;
  note: string | null;
  member: Member;
}
interface YearlyStats {
  [memberId: string]: { assigned: number; done: number };
}

export default function BazarDutyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [duties, setDuties] = useState<BazarDutyEntry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [yearlyStats, setYearlyStats] = useState<YearlyStats>({});

  // Assign form
  const [assignDate, setAssignDate] = useState("");
  const [assignMember, setAssignMember] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Reassign
  const [reassignId, setReassignId] = useState<string | null>(null);
  const [reassignMember, setReassignMember] = useState("");
  const [reassignReason, setReassignReason] = useState("");

  const isManager = (session?.user as { role?: string })?.role === "MANAGER";
  const userId = session?.user?.id;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchData = () => {
    setLoading(true);
    setError("");
    fetch(`/api/bazar-duty?month=${month}&year=${year}`)
      .then(r => r.json())
      .then(data => {
        setDuties(data.duties || []);
        setMembers(data.members || []);
        setYearlyStats(data.yearlyStats || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (status === "authenticated") fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, month, year]);

  // Manager assigns a duty
  const assignDuty = async () => {
    if (!assignDate || !assignMember) return;
    setAssigning(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/bazar-duty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: assignDate, memberId: assignMember }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        return;
      }
      setSuccess("Bazar duty assigned!");
      setAssignDate("");
      setAssignMember("");
      fetchData();
    } catch {
      setError("Something went wrong");
    } finally {
      setAssigning(false);
    }
  };

  const deleteDuty = async (id: string) => {
    if (!confirm("Remove this duty assignment?")) return;
    setError("");
    try {
      const res = await fetch(`/api/bazar-duty?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSuccess("Removed");
        fetchData();
      }
    } catch {
      setError("Failed");
    }
  };

  const markDone = async (id: string) => {
    const res = await fetch("/api/bazar-duty", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "done" }),
    });
    if (res.ok) fetchData();
  };

  const doReassign = async () => {
    if (!reassignId || !reassignMember) return;
    setError("");
    const res = await fetch("/api/bazar-duty", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reassignId, action: "reassign", newMemberId: reassignMember, reason: reassignReason }),
    });
    if (res.ok) {
      setSuccess("Reassigned! Duty debt created.");
      setReassignId(null);
      setReassignMember("");
      setReassignReason("");
      fetchData();
    } else {
      const d = await res.json();
      setError(d.error || "Failed");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-800">🛒 Bazar Duty</h1>
        <div className="flex gap-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="rounded-lg border px-2 py-1 text-sm">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString("default", { month: "short" })}</option>
            ))}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="rounded-lg border px-2 py-1 text-sm">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <p className="text-sm text-gray-500">{monthName} • Manager assigns duties manually • {duties.length} duties this month</p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">⚠️ {error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">✅ {success}</div>}

      {/* Manager: Assign Duty */}
      {isManager && (
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-5">
          <h2 className="text-base font-semibold text-indigo-800 mb-3">➕ Assign Bazar Duty</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="date" value={assignDate} onChange={(e) => setAssignDate(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
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

      {/* Yearly Stats */}
      {members.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-3">📊 {year} Yearly Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {members.map((m) => {
              const stats = yearlyStats[m.id] || { assigned: 0, done: 0 };
              return (
                <div key={m.id} className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                  <p className="text-xl font-bold text-indigo-600">{stats.done}/{stats.assigned}</p>
                  <p className="text-xs text-gray-400">done/assigned</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {reassignId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm text-yellow-800">Reassign Duty</h3>
          <p className="text-xs text-yellow-600">This will create a duty debt for the original member.</p>
          <select value={reassignMember} onChange={e => setReassignMember(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm">
            <option value="">Select member...</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input type="text" placeholder="Reason (optional)" value={reassignReason} onChange={e => setReassignReason(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button onClick={doReassign} className="flex-1 bg-yellow-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-yellow-700">Reassign</button>
            <button onClick={() => setReassignId(null)} className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-lg text-sm font-medium">Cancel</button>
          </div>
        </div>
      )}

      {/* Duty List */}
      {duties.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
          <p className="text-gray-500">No bazar duties for this month.{isManager && " Use the form above to assign duties."}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="divide-y">
            {duties.map(d => {
              const dateStr = new Date(d.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              const isPast = new Date(d.date) < new Date(new Date().toDateString());
              const isMyDuty = d.memberId === userId;

              return (
                <div key={d.id} className={`p-3 flex flex-wrap items-center gap-2 text-sm ${isPast && d.status === "PENDING" ? "bg-red-50" : ""}`}>
                  <span className="text-gray-500 text-xs w-28">{dateStr}</span>
                  <span className={`font-medium ${isMyDuty ? "text-indigo-600" : "text-gray-800"}`}>
                    {d.member.name} {isMyDuty && "(You)"}
                  </span>
                  {d.originalMemberId && <span className="text-xs text-yellow-500">(swapped)</span>}

                  <div className="ml-auto flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      d.status === "DONE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {d.status}
                    </span>

                    {d.status === "PENDING" && (isMyDuty || isManager) && (
                      <button onClick={() => markDone(d.id)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">✓ Done</button>
                    )}
                    {isManager && d.status === "PENDING" && (
                      <button onClick={() => setReassignId(d.id)} className="text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700">Swap</button>
                    )}
                    {isManager && (
                      <button onClick={() => deleteDuty(d.id)} className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">✕</button>
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
