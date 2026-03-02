"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AuditEntry {
  id: string;
  tableName: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  action: string;
  createdAt: string;
  editedBy: { name: string };
}

export default function AuditLogPage() {
  const { status } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      setLoading(true);
      let query = filter === "all" ? "" : `&table=${filter}`;
      if (fromDate) query += `&from=${fromDate}`;
      if (toDate) query += `&to=${toDate}`;
      fetch(`/api/audit-log?limit=200${query}`)
        .then((r) => r.json())
        .then((data) => {
          setLogs(data);
          setLoading(false);
        });
    }
  }, [status, filter, fromDate, toDate]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
        <h1 className="text-2xl font-bold text-gray-800">🔍 Audit Log</h1>
        <p className="text-sm text-gray-500">Every change is permanently recorded</p>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border space-y-3">
        {/* Table filter */}
        <div className="flex flex-wrap gap-2">
          {[
            { value: "all", label: "All" },
            { value: "MealEntry", label: "🍛 Meals" },
            { value: "Deposit", label: "💰 Deposits" },
            { value: "BazarTrip", label: "🛒 Bazar" },
            { value: "WashroomCleaning", label: "🚿 Cleaning" },
            { value: "ManagerRotation", label: "🔄 Handover" },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                filter === t.value
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Date range filter */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-600">📅 Date range:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2.5 border rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2.5 border rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500"
          />
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(""); setToDate(""); }}
              className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 font-medium"
            >
              ✕ Clear dates
            </button>
          )}
        </div>
      </div>

      {/* Log Entries */}
      <div className="space-y-2">
        {logs.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow-sm border text-center text-gray-400">
            No audit logs yet
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm border">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    log.action === "CREATE"
                      ? "bg-green-100 text-green-700"
                      : log.action === "UPDATE"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {log.action}
                  </span>
                  <span className="text-gray-500 text-xs">by {log.editedBy.name}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                <span className="font-medium text-gray-800">{log.fieldName}</span>
                <span className="text-gray-400"> ({log.tableName})</span>
              </div>
              {log.action === "UPDATE" && (
                <div className="mt-1 text-sm">
                  <span className="text-red-500 line-through">{log.oldValue}</span>
                  <span className="text-gray-400"> → </span>
                  <span className="text-green-600 font-medium">{log.newValue}</span>
                </div>
              )}
              {log.action === "CREATE" && log.newValue && (
                <div className="mt-1 text-sm text-green-600">{log.newValue}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
