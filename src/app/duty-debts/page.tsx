"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Member { id: string; name: string; }
interface DutyDebtEntry {
  id: string;
  dutyType: string;
  status: string;
  reason: string | null;
  createdAt: string;
  settledAt: string | null;
  owedBy: Member;
  owedTo: Member;
}

export default function DutyDebtsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<DutyDebtEntry[]>([]);
  const [filter, setFilter] = useState<"PENDING" | "SETTLED" | "">("");

  const isManager = (session?.user as { role?: string })?.role === "MANAGER";
  const userId = session?.user?.id;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchData = () => {
    setLoading(true);
    const url = filter ? `/api/duty-debt?status=${filter}` : "/api/duty-debt";
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setDebts(data.debts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (status === "authenticated") fetchData();
  }, [status, filter]);

  const settleDebt = async (id: string) => {
    if (!confirm("Mark this debt as settled?")) return;
    const res = await fetch("/api/duty-debt", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) fetchData();
    else alert((await res.json()).error || "Failed");
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const myDebtsOwed = debts.filter(d => d.owedBy.id === userId && d.status === "PENDING").length;
  const myDebtsCovered = debts.filter(d => d.owedTo.id === userId && d.status === "PENDING").length;

  return (
    <div className="space-y-6 pb-8">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">⚖️ Duty Debts</h1>

      {/* My summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl p-4 border ${myDebtsOwed > 0 ? "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800" : "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400">You Owe</p>
          <p className="text-2xl font-bold">{myDebtsOwed}</p>
        </div>
        <div className={`rounded-xl p-4 border ${myDebtsCovered > 0 ? "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800" : "bg-gray-50 border-gray-200 dark:bg-gray-950 dark:border-gray-700"}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Owed to You</p>
          <p className="text-2xl font-bold">{myDebtsCovered}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["", "PENDING", "SETTLED"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full text-xs font-medium ${filter === f ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"}`}>
            {f || "All"}
          </button>
        ))}
      </div>

      {/* Debt List */}
      {debts.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No duty debts found.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
          <div className="divide-y dark:divide-gray-700">
            {debts.map(d => (
              <div key={d.id} className="p-3 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    d.dutyType === "WASHROOM" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                  }`}>
                    {d.dutyType}
                  </span>
                  <span className="text-red-600 dark:text-red-400 font-medium">{d.owedBy.name}</span>
                  <span className="text-gray-400">owes</span>
                  <span className="text-green-600 dark:text-green-400 font-medium">{d.owedTo.name}</span>
                  <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                    d.status === "SETTLED" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                  }`}>
                    {d.status}
                  </span>
                </div>
                {d.reason && <p className="text-xs text-gray-400">{d.reason}</p>}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{new Date(d.createdAt).toLocaleDateString()}</span>
                  {d.status === "PENDING" && (isManager || d.owedTo.id === userId) && (
                    <button onClick={() => settleDebt(d.id)} className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
                      Settle
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
