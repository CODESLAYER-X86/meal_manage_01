"use client";

import { useEffect, useState } from "react";

interface MessMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

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

  // Change-manager modal state
  const [managerModal, setManagerModal] = useState<{ messId: string; messName: string } | null>(null);
  const [members, setMembers] = useState<MessMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");

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

  const openChangeManager = async (messId: string, messName: string) => {
    setManagerModal({ messId, messName });
    setSelectedMemberId("");
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/admin/messes/${messId}/members`);
      const data = await res.json();
      setMembers(data.members || []);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  const confirmChangeManager = async () => {
    if (!managerModal || !selectedMemberId) return;
    const member = members.find((m) => m.id === selectedMemberId);
    if (!confirm(`Make "${member?.name}" the manager of "${managerModal.messName}"?`)) return;
    const res = await fetch("/api/admin/messes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messId: managerModal.messId, newManagerId: selectedMemberId }),
    });
    if (res.ok) {
      setManagerModal(null);
      fetchMesses(page);
    } else {
      alert((await res.json()).error || "Failed to change manager");
    }
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
      {/* Change Manager Modal */}
      {managerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#12122a] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h2 className="text-base font-semibold text-white">Change Manager</h2>
            <p className="text-sm text-slate-500">
              Select a new manager for <span className="text-white font-medium">{managerModal.messName}</span>
            </p>
            {membersLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No members found</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {members.map((m) => (
                  <label
                    key={m.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer border transition-all ${
                      selectedMemberId === m.id
                        ? "border-violet-500/50 bg-violet-500/10"
                        : "border-white/5 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="newManager"
                      value={m.id}
                      checked={selectedMemberId === m.id}
                      onChange={() => setSelectedMemberId(m.id)}
                      className="accent-violet-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{m.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{m.email}</p>
                    </div>
                    {m.role === "MANAGER" && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-md">
                        Current
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setManagerModal(null)}
                className="flex-1 px-4 py-2 text-sm bg-white/5 border border-white/10 text-slate-500 rounded-xl hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmChangeManager}
                disabled={!selectedMemberId}
                className="flex-1 px-4 py-2 text-sm bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">All Messes</h1>
          <p className="text-sm text-slate-400 mt-0.5">{messes.length} mess{messes.length !== 1 ? "es" : ""} on platform</p>
        </div>
      </div>

      {messes.length === 0 ? (
        <div className="bg-[#1a1a3e]/50 border border-white/5 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">🏠</p>
          <p className="text-slate-500">No messes created yet</p>
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
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">Code: {m.inviteCode}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => openChangeManager(m.id, m.name)} className="px-2 py-1 text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition-colors">
                      👑 Manager
                    </button>
                    <button onClick={() => deleteMess(m.id, m.name)} className="px-2 py-1 text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 text-xs">
                  <div><span className="text-slate-400">Members:</span> <span className="text-white font-medium">{m._count.members}</span></div>
                  <div><span className="text-slate-400">Meals:</span> <span className="text-white font-medium">{m._count.mealEntries}</span></div>
                </div>
                <div className="text-[10px] text-slate-400">By {m.createdBy.name} · {new Date(m.createdAt).toLocaleDateString()}</div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                    <th className="text-left px-5 py-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Invite Code</th>
                    <th className="text-left px-5 py-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Creator</th>
                    <th className="text-center px-5 py-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Members</th>
                    <th className="text-center px-5 py-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Meals</th>
                    <th className="text-left px-5 py-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Created</th>
                    <th className="text-right px-5 py-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
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
                      <td className="px-5 py-4 text-slate-500 text-xs">{m.createdBy.name}</td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-full">{m._count.members}</span>
                      </td>
                      <td className="px-5 py-4 text-center text-slate-500 text-xs">{m._count.mealEntries}</td>
                      <td className="px-5 py-4 text-slate-400 text-xs">{new Date(m.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => openChangeManager(m.id, m.name)}
                            className="px-3 py-1.5 text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition-all duration-200"
                          >
                            👑 Manager
                          </button>
                          <button
                            onClick={() => deleteMess(m.id, m.name)}
                            className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-all duration-200"
                          >
                            Delete
                          </button>
                        </div>
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
            className="px-4 py-2 text-xs font-medium bg-white/5 border border-white/10 text-slate-500 rounded-xl hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-slate-400">
            Page <span className="text-white font-medium">{page}</span> of {pages}
          </span>
          <button
            onClick={() => fetchMesses(page + 1)}
            disabled={page >= pages}
            className="px-4 py-2 text-xs font-medium bg-white/5 border border-white/10 text-slate-500 rounded-xl hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
