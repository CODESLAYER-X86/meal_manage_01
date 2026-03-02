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

export default function BazarDutyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [duties, setDuties] = useState<BazarDutyEntry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [bazarDaysPerWeek, setBazarDaysPerWeek] = useState(3);
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
    fetch(`/api/bazar-duty?month=${month}&year=${year}`)
      .then(r => r.json())
      .then(data => {
        setDuties(data.duties || []);
        setMembers(data.members || []);
        setBazarDaysPerWeek(data.bazarDaysPerWeek ?? 3);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (status === "authenticated") fetchData();
  }, [status, month, year]);

  const generateRotation = async () => {
    if (!confirm("Generate bazar rotation for this month?")) return;
    const res = await fetch("/api/bazar-duty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, year }),
    });
    if (res.ok) fetchData();
    else alert((await res.json()).error || "Failed");
  };

  const deleteRotation = async () => {
    if (!confirm("Delete all bazar duties for this month?")) return;
    const res = await fetch(`/api/bazar-duty?month=${month}&year=${year}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  const markDone = async (id: string) => {
    const res = await fetch("/api/bazar-duty", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "done" }),
    });
    if (res.ok) fetchData();
  };

  const reassignDuty = async () => {
    if (!reassignId || !reassignMember) return;
    const res = await fetch("/api/bazar-duty", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reassignId, action: "reassign", newMemberId: reassignMember, reason: reassignReason }),
    });
    if (res.ok) {
      setReassignId(null);
      setReassignMember("");
      setReassignReason("");
      fetchData();
    } else alert((await res.json()).error || "Failed");
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
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">🛒 Bazar Duty</h1>
        <div className="flex gap-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString("default", { month: "short" })}</option>
            ))}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {monthName} • {bazarDaysPerWeek} bazar days per week • {duties.length} duties scheduled
      </p>

      {/* Manager Actions */}
      {isManager && (
        <div className="flex gap-2">
          {duties.length === 0 ? (
            <button onClick={generateRotation} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
              Generate Rotation
            </button>
          ) : (
            <button onClick={deleteRotation} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700">
              Delete & Regenerate
            </button>
          )}
        </div>
      )}

      {/* Reassign Modal */}
      {reassignId && (
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm text-yellow-800 dark:text-yellow-200">Reassign Duty</h3>
          <p className="text-xs text-yellow-600 dark:text-yellow-400">This will create a duty debt for the original member.</p>
          <select value={reassignMember} onChange={e => setReassignMember(e.target.value)} className="w-full rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm">
            <option value="">Select member...</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input type="text" placeholder="Reason (optional)" value={reassignReason} onChange={e => setReassignReason(e.target.value)} className="w-full rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button onClick={reassignDuty} className="flex-1 bg-yellow-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-yellow-700">Reassign</button>
            <button onClick={() => setReassignId(null)} className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 py-2 rounded-lg text-sm font-medium">Cancel</button>
          </div>
        </div>
      )}

      {/* Duty List */}
      {duties.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No bazar duties for this month.{isManager && " Generate a rotation to get started."}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
          <div className="divide-y dark:divide-gray-700">
            {duties.map(d => {
              const dateStr = new Date(d.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              const isPast = new Date(d.date) < new Date(new Date().toDateString());
              const isMyDuty = d.memberId === userId;

              return (
                <div key={d.id} className={`p-3 flex flex-wrap items-center gap-2 text-sm ${isPast && d.status === "PENDING" ? "bg-red-50 dark:bg-red-950" : ""}`}>
                  <span className="text-gray-500 dark:text-gray-400 text-xs w-28">{dateStr}</span>
                  <span className={`font-medium ${isMyDuty ? "text-indigo-600 dark:text-indigo-400" : "text-gray-800 dark:text-gray-200"}`}>
                    {d.member.name} {isMyDuty && "(You)"}
                  </span>
                  {d.originalMemberId && <span className="text-xs text-yellow-500">(swapped)</span>}

                  <div className="ml-auto flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      d.status === "DONE" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : d.status === "SKIPPED" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                    }`}>
                      {d.status}
                    </span>

                    {d.status === "PENDING" && (isMyDuty || isManager) && (
                      <button onClick={() => markDone(d.id)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">
                        ✓ Done
                      </button>
                    )}

                    {d.status === "PENDING" && isManager && (
                      <button onClick={() => setReassignId(d.id)} className="text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700">
                        Swap
                      </button>
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
