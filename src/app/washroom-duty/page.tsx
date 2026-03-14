"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Member { id: string; name: string; }
interface Duty {
  id: string;
  date: string;
  memberId: string;
  member: Member;
  washroomNumber: number;
  completed: boolean;
}
interface SwapReq {
  id: string;
  dutyType: string;
  fromDuty: Duty | null;
  toDuty: Duty | null;
  requesterId: string;
  status: string;
}

export default function WashroomDutyPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [duties, setDuties] = useState<Duty[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapReq[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [showAutoRotate, setShowAutoRotate] = useState(false);
  const [autoStart, setAutoStart] = useState("");
  const [autoEnd, setAutoEnd] = useState("");
  const [autoWashroomCount, setAutoWashroomCount] = useState(1);
  const [saving, setSaving] = useState(false);

  const isManager = session?.user?.role === "MANAGER";
  const userId = session?.user?.id;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dutyRes, swapRes] = await Promise.all([
        fetch(`/api/washroom-duty?month=${month}&year=${year}`),
        fetch("/api/duty-swap?status=PENDING"),
      ]);
      const dutyData = await dutyRes.json();
      const swapData = await swapRes.json();
      setDuties(dutyData.duties || []);
      setMembers(dutyData.members || []);
      setSwapRequests((swapData.requests || []).filter((r: SwapReq) => r.dutyType === "WASHROOM"));
    } catch { /* ignore */ }
    setLoading(false);
  }, [month, year]);

  useEffect(() => { if (session?.user?.messId) loadData(); }, [session, loadData]);

  if (!session?.user?.messId) {
    return <div className="p-6 text-center text-slate-400">Join a mess first</div>;
  }

  const handleAutoRotate = async () => {
    if (!autoStart || !autoEnd) return;
    setSaving(true);
    await fetch("/api/washroom-duty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoRotate: true, startDate: autoStart, endDate: autoEnd, washroomCount: autoWashroomCount }),
    });
    setSaving(false);
    setShowAutoRotate(false);
    loadData();
  };

  const handleComplete = async (id: string, completed: boolean) => {
    await fetch("/api/washroom-duty", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed }),
    });
    loadData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/washroom-duty?id=${id}`, { method: "DELETE" });
    loadData();
  };

  const handleSwapRequest = async (fromDutyId: string, toDutyId: string) => {
    await fetch("/api/duty-swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dutyType: "WASHROOM", fromDutyId, toDutyId }),
    });
    loadData();
  };

  const handleSwapAction = async (id: string, action: string) => {
    await fetch("/api/duty-swap", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    loadData();
  };

  const today = new Date().toISOString().split("T")[0];

  // Group duties by washroom number
  const washroomNumbers = [...new Set(duties.map((d) => d.washroomNumber))].sort();

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">🚿 Washroom Duty Schedule</h1>
        <button onClick={() => router.back()} className="text-sm text-slate-400 hover:text-slate-300">← Back</button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-center gap-4 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-3 rounded-xl border">
        <button onClick={() => { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); }} className="p-2 hover:bg-gray-100 rounded-lg">◀</button>
        <span className="font-semibold text-slate-100">
          {new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); }} className="p-2 hover:bg-gray-100 rounded-lg">▶</button>
      </div>

      {/* Manager actions */}
      {isManager && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowAutoRotate(!showAutoRotate)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
            🔄 Auto Rotate
          </button>
        </div>
      )}

      {/* Auto rotate form */}
      {showAutoRotate && isManager && (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-4 rounded-xl border space-y-3">
          <h3 className="font-semibold text-slate-300">Auto Rotate Schedule</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400">Start Date</label>
              <input type="date" value={autoStart} onChange={(e) => setAutoStart(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-slate-100" />
            </div>
            <div>
              <label className="text-xs text-slate-400">End Date</label>
              <input type="date" value={autoEnd} onChange={(e) => setAutoEnd(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-slate-100" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Washrooms</label>
              <input type="number" min={1} max={10} value={autoWashroomCount} onChange={(e) => setAutoWashroomCount(parseInt(e.target.value) || 1)} className="w-full px-3 py-2 border rounded-lg text-slate-100" />
            </div>
          </div>
          <button onClick={handleAutoRotate} disabled={saving} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">
            {saving ? "Generating..." : "Generate Schedule"}
          </button>
        </div>
      )}

      {/* Duty list grouped by washroom */}
      {loading ? (
        <div className="text-center py-10 text-slate-400">Loading...</div>
      ) : duties.length === 0 ? (
        <div className="text-center py-10 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl border">
          <p className="text-slate-400">No washroom duties scheduled this month</p>
        </div>
      ) : (
        washroomNumbers.map((wrNum) => (
          <div key={wrNum} className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-400 mt-4">🚿 Washroom #{wrNum}</h3>
            {duties.filter((d) => d.washroomNumber === wrNum).map((d) => {
              const dateStr = d.date.split("T")[0];
              const isPast = dateStr < today;
              const isMyDuty = d.memberId === userId;
              return (
                <div key={d.id} className={`bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-4 rounded-xl border flex items-center justify-between ${isMyDuty ? "border-cyan-200 bg-cyan-50/30" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${d.completed ? "bg-green-100" : isPast ? "bg-red-100" : "bg-gray-100"}`}>
                      {d.completed ? "✅" : isPast ? "⚠️" : "🚿"}
                    </div>
                    <div>
                      <p className="font-medium text-slate-100">{d.member.name} {isMyDuty && <span className="text-xs text-cyan-600">(You)</span>}</p>
                      <p className="text-xs text-slate-400">{new Date(dateStr).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.completed ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Done</span>
                    ) : isPast ? (
                      <span className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded-full">Missed</span>
                    ) : (
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">Pending</span>
                    )}
                    {(isManager || isMyDuty) && !d.completed && (
                      <button onClick={() => handleComplete(d.id, true)} className="px-2 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">✓</button>
                    )}
                    {isMyDuty && !d.completed && !isPast && (
                      <button
                        onClick={() => {
                          const otherDuties = duties.filter((od) => od.memberId !== userId && od.washroomNumber === wrNum && !od.completed && od.date.split("T")[0] >= today);
                          if (otherDuties.length === 0) { alert("No other future duties to swap with"); return; }
                          const target = otherDuties[0];
                          if (confirm(`Request swap with ${target.member.name} on ${target.date.split("T")[0]}?`)) {
                            handleSwapRequest(d.id, target.id);
                          }
                        }}
                        className="px-2 py-1 bg-amber-500 text-white text-xs rounded-lg hover:bg-amber-600"
                      >🔄</button>
                    )}
                    {isManager && <button onClick={() => handleDelete(d.id)} className="px-2 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600">✕</button>}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}

      {/* Pending swap requests */}
      {swapRequests.length > 0 && (
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-3">
          <h3 className="font-semibold text-amber-800">🔄 Pending Swap Requests</h3>
          {swapRequests.map((sr) => (
            <div key={sr.id} className="flex items-center justify-between bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-3 rounded-lg border">
              <div className="text-sm">
                <span className="font-medium">{sr.fromDuty?.member?.name}</span>
                <span className="text-slate-400 mx-1">↔</span>
                <span className="font-medium">{sr.toDuty?.member?.name}</span>
                <span className="text-xs text-slate-400 ml-2">
                  ({sr.fromDuty?.date?.split("T")[0]} ↔ {sr.toDuty?.date?.split("T")[0]})
                </span>
              </div>
              {(isManager || sr.toDuty?.memberId === userId) && (
                <div className="flex gap-1">
                  <button onClick={() => handleSwapAction(sr.id, "approve")} className="px-2 py-1 bg-green-600 text-white text-xs rounded">✓</button>
                  <button onClick={() => handleSwapAction(sr.id, "reject")} className="px-2 py-1 bg-red-500 text-white text-xs rounded">✕</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
