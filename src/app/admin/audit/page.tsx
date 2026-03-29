"use client";

import { useEffect, useState } from "react";

interface AuditEntry {
  id: string;
  tableName: string;
  recordId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  action: string;
  createdAt: string;
  editedBy: { name: string; email: string };
  mess: { name: string };
}

const ACTION_STYLES: Record<string, string> = {
  UPDATE: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  CREATE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  DELETE: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchLogs = (p: number) => {
    setLoading(true);
    fetch(`/api/admin/audit?page=${p}`)
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.logs || []);
        setPage(d.page);
        setPages(d.pages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs(1);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Global Audit Log</h1>
        <p className="text-sm text-slate-400 mt-0.5">All platform activity across every mess</p>
      </div>

      {logs.length === 0 ? (
        <div className="bg-[#1a1a3e]/50 border border-white/5 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-slate-400">No audit logs found</p>
        </div>
      ) : (
        <>
          {/* Mobile: Timeline Cards */}
          <div className="sm:hidden space-y-3">
            {logs.map((l) => (
              <div key={l.id} className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${ACTION_STYLES[l.action] || "bg-white/5 text-slate-400 border-white/10"}`}>
                    {l.action}
                  </span>
                  <span className="text-[10px] text-slate-400">{new Date(l.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-xs text-slate-400">
                  <span className="text-white font-medium">{l.editedBy.name}</span> in <span className="text-violet-400">{l.mess.name}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  <span className="text-slate-400">{l.tableName}</span> · <span className="text-slate-400">{l.fieldName}</span>
                </div>
                {(l.oldValue || l.newValue) && (
                  <div className="text-[11px] bg-white/[0.02] rounded-lg p-2 space-y-0.5">
                    {l.oldValue && <div className="text-red-400/70 line-through">{l.oldValue}</div>}
                    {l.newValue && <div className="text-emerald-400">{l.newValue}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden sm:block bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Time</th>
                    <th className="text-left px-5 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Mess</th>
                    <th className="text-left px-5 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">By</th>
                    <th className="text-center px-5 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                    <th className="text-left px-5 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Table</th>
                    <th className="text-left px-5 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Field</th>
                    <th className="text-left px-5 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map((l) => (
                    <tr key={l.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                      <td className="px-5 py-3 text-violet-400 text-xs font-medium">{l.mess.name}</td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{l.editedBy.name}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${ACTION_STYLES[l.action] || "bg-white/5 text-slate-400 border-white/10"}`}>
                          {l.action}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{l.tableName}</td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{l.fieldName}</td>
                      <td className="px-5 py-3 text-xs">
                        {l.oldValue && <span className="text-red-400/70 line-through mr-2">{l.oldValue}</span>}
                        {l.newValue && <span className="text-emerald-400">{l.newValue}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => fetchLogs(page - 1)} disabled={page <= 1} className="px-4 py-2 text-xs font-medium bg-white/5 border border-white/10 text-slate-400 rounded-xl hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            ← Prev
          </button>
          <span className="text-xs text-slate-400">Page <span className="text-white font-medium">{page}</span> of {pages}</span>
          <button onClick={() => fetchLogs(page + 1)} disabled={page >= pages} className="px-4 py-2 text-xs font-medium bg-white/5 border border-white/10 text-slate-400 rounded-xl hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
