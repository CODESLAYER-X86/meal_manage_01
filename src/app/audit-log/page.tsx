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

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      const query = filter === "all" ? "" : `&table=${filter}`;
      fetch(`/api/audit-log?limit=100${query}`)
        .then((r) => r.json())
        .then((data) => {
          setLogs(data);
          setLoading(false);
        });
    }
  }, [status, filter]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">🔍 Audit Log</h1>
        <p className="text-sm text-gray-500">Every change is permanently recorded</p>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-xl shadow-sm border flex gap-2">
        {["all", "MealEntry", "Deposit", "BazarTrip", "ManagerRotation"].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === t
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t === "all" ? "All" : t}
          </button>
        ))}
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
                  <span className="font-medium text-gray-700">{log.editedBy.name}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                <span className="font-medium">{log.tableName}</span>
                <span className="text-gray-400"> → </span>
                <span>{log.fieldName}</span>
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
