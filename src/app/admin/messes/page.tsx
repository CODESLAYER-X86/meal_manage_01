"use client";

import { useEffect, useState } from "react";

interface MessEntry {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
  _count: { members: number; mealEntries: number; deposits: number };
}

export default function AdminMessesPage() {
  const [messes, setMesses] = useState<MessEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchMesses = (p: number) => {
    setLoading(true);
    fetch(`/api/admin/messes?page=${p}`)
      .then((r) => r.json())
      .then((d) => {
        setMesses(d.messes || []);
        setPage(d.page);
        setPages(d.pages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchMesses(1); }, []);

  const deleteMess = async (id: string, name: string) => {
    if (!confirm(`Delete mess "${name}"? All members will be removed. This cannot be undone.`)) return;
    const res = await fetch("/api/admin/messes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) fetchMesses(page);
    else alert("Failed to delete mess");
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">All Messes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{messes.length} mess{messes.length !== 1 ? "es" : ""} on platform</p>
        </div>
      </div>

      {messes.length === 0 ? (
        <div className="bg-[#1a1a3e]/50 border border-white/5 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">🏠</p>
          <p className="text-gray-400">No messes created yet</p>
        </div>
      ) : (
        <>
          {/* Card grid for mobile, Table for desktop */}
          <div className="sm:hidden space-y-3">
            {messes.map((m) => (
              <div key={m.id} className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{m.name}</h3>
                    <p className="text-[10px] font-mono text-gray-500 mt-0.5">Code: {m.inviteCode}</p>
                  </div>
                  <button onClick={() => deleteMess(m.id, m.name)} className="px-2 py-1 text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors">
                    Delete
                  </button>
                </div>
                <div className="flex gap-4 text-xs">
                  <div><span className="text-gray-500">Members:</span> <span className="text-white font-medium">{m._count.members}</span></div>
                  <div><span className="text-gray-500">Meals:</span> <span className="text-white font-medium">{m._count.mealEntries}</span></div>
                </div>
                <div className="text-[10px] text-gray-500">By {m.createdBy.name} · {new Date(m.createdAt).toLocaleDateString()}</div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="text-left px-5 py-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Invite Code</th>
                    <th className="text-left px-5 py-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Creator</th>
                    <th className="text-center px-5 py-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Members</th>
                    <th className="text-center px-5 py-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Meals</th>
                    <th className="text-left px-5 py-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Created</th>
                    <th className="text-right px-5 py-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {messes.map((m) => (
                    <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-medium text-white">{m.name}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs text-violet-400 bg-violet-500/10 px-2 py-1 rounded-md">{m.inviteCode}</span>
                      </td>
                      <td className="px-5 py-4 text-gray-400 text-xs">{m.createdBy.name}</td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-full">{m._count.members}</span>
                      </td>
                      <td className="px-5 py-4 text-center text-gray-400 text-xs">{m._count.mealEntries}</td>
                      <td className="px-5 py-4 text-gray-500 text-xs">{new Date(m.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => deleteMess(m.id, m.name)}
                          className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-all duration-200"
                        >
                          Delete
                        </button>
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
          <button
            onClick={() => fetchMesses(page - 1)}
            disabled={page <= 1}
            className="px-4 py-2 text-xs font-medium bg-white/5 border border-white/10 text-gray-400 rounded-xl hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-500">
            Page <span className="text-white font-medium">{page}</span> of {pages}
          </span>
          <button
            onClick={() => fetchMesses(page + 1)}
            disabled={page >= pages}
            className="px-4 py-2 text-xs font-medium bg-white/5 border border-white/10 text-gray-400 rounded-xl hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
