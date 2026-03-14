"use client";

import { useEffect, useState } from "react";

interface UserEntry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isAdmin: boolean;
  isActive: boolean;
  messId: string | null;
  createdAt: string;
  mess: { id: string; name: string } | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchUsers = (p: number, q: string) => {
    setLoading(true);
    fetch(`/api/admin/users?page=${p}&search=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users || []);
        setPage(d.page);
        setPages(d.pages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(1, ""); }, []);

  const doSearch = () => fetchUsers(1, search);

  const doAction = async (id: string, action: string) => {
    const labels: Record<string, string> = {
      deactivate: "Deactivate this user?",
      activate: "Activate this user?",
      makeAdmin: "Grant admin privileges?",
      removeAdmin: "Remove admin privileges?",
      kickFromMess: "Remove user from their mess?",
    };
    if (!confirm(labels[action] || `Perform ${action}?`)) return;

    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) fetchUsers(page, search);
    else alert((await res.json()).error || "Failed");
  };

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`Permanently delete user "${name}"? This cannot be undone.`)) return;
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) fetchUsers(page, search);
    else alert((await res.json()).error || "Failed to delete user");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Users</h1>
        <p className="text-sm text-slate-400 mt-0.5">Manage platform users</p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            className="w-full bg-[#1a1a3e]/50 border border-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors"
          />
        </div>
        <button
          onClick={doSearch}
          className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:from-violet-500 hover:to-indigo-500 transition-all shadow-xl shadow-black/20 shadow-violet-500/20"
        >
          Search
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-[#1a1a3e]/50 border border-white/5 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">👤</p>
          <p className="text-slate-400">No users found</p>
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="sm:hidden space-y-3">
            {users.map((u) => (
              <div key={u.id} className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${u.isAdmin ? "bg-gradient-to-br from-violet-500 to-pink-500 text-white" : "bg-white/10 text-slate-400"}`}>
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white">{u.name}</h3>
                      <p className="text-[10px] text-slate-400">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {u.isAdmin && <span className="px-1.5 py-0.5 text-[9px] bg-violet-500/20 text-violet-300 border border-violet-500/20 rounded-md font-medium">Admin</span>}
                    <span className={`w-2 h-2 rounded-full ${u.isActive ? "bg-emerald-400" : "bg-red-400"}`} />
                  </div>
                </div>
                <div className="flex gap-3 text-[11px]">
                  <span className={`px-2 py-0.5 rounded-md ${u.role === "MANAGER" ? "bg-indigo-500/10 text-indigo-400" : "bg-white/5 text-slate-400"}`}>{u.role}</span>
                  <span className="text-slate-400">{u.mess?.name || "No mess"}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {u.isActive ? (
                    <button onClick={() => doAction(u.id, "deactivate")} className="px-2.5 py-1 text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20">Deactivate</button>
                  ) : (
                    <button onClick={() => doAction(u.id, "activate")} className="px-2.5 py-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20">Activate</button>
                  )}
                  {!u.isAdmin ? (
                    <button onClick={() => doAction(u.id, "makeAdmin")} className="px-2.5 py-1 text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-lg hover:bg-violet-500/20">→Admin</button>
                  ) : (
                    <button onClick={() => doAction(u.id, "removeAdmin")} className="px-2.5 py-1 text-[10px] bg-white/5 text-slate-400 border border-white/10 rounded-lg hover:bg-white/10">✕Admin</button>
                  )}
                  {u.messId && (
                    <button onClick={() => doAction(u.id, "kickFromMess")} className="px-2.5 py-1 text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg hover:bg-orange-500/20">Kick</button>
                  )}
                  <button onClick={() => deleteUser(u.id, u.name)} className="px-2.5 py-1 text-[10px] bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/30">🗑 Delete</button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">User</th>
                    <th className="text-left px-5 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Role</th>
                    <th className="text-left px-5 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Mess</th>
                    <th className="text-center px-5 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Joined</th>
                    <th className="text-right px-5 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${u.isAdmin ? "bg-gradient-to-br from-violet-500 to-pink-500 text-white" : "bg-white/10 text-slate-400"}`}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{u.name}</span>
                              {u.isAdmin && <span className="px-1.5 py-0.5 text-[9px] bg-violet-500/20 text-violet-300 border border-violet-500/20 rounded-md font-medium">Admin</span>}
                            </div>
                            <p className="text-[11px] text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${u.role === "MANAGER" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : "bg-white/5 text-slate-400"}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-400 text-xs">{u.mess?.name || <span className="text-slate-400">—</span>}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.isActive ? "text-emerald-400" : "text-red-400"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-400" : "bg-red-400"}`} />
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {u.isActive ? (
                            <button onClick={() => doAction(u.id, "deactivate")} className="px-2.5 py-1 text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors">Deactivate</button>
                          ) : (
                            <button onClick={() => doAction(u.id, "activate")} className="px-2.5 py-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors">Activate</button>
                          )}
                          {!u.isAdmin ? (
                            <button onClick={() => doAction(u.id, "makeAdmin")} className="px-2.5 py-1 text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-lg hover:bg-violet-500/20 transition-colors">→Admin</button>
                          ) : (
                            <button onClick={() => doAction(u.id, "removeAdmin")} className="px-2.5 py-1 text-[10px] bg-white/5 text-slate-400 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">✕Admin</button>
                          )}
                          {u.messId && (
                            <button onClick={() => doAction(u.id, "kickFromMess")} className="px-2.5 py-1 text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg hover:bg-orange-500/20 transition-colors">Kick</button>
                          )}
                          <button onClick={() => deleteUser(u.id, u.name)} className="px-2.5 py-1 text-[10px] bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/30 transition-colors">🗑 Delete</button>
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
          <button onClick={() => fetchUsers(page - 1, search)} disabled={page <= 1} className="px-4 py-2 text-xs font-medium bg-white/5 border border-white/10 text-slate-400 rounded-xl hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            ← Prev
          </button>
          <span className="text-xs text-slate-400">Page <span className="text-white font-medium">{page}</span> of {pages}</span>
          <button onClick={() => fetchUsers(page + 1, search)} disabled={page >= pages} className="px-4 py-2 text-xs font-medium bg-white/5 border border-white/10 text-slate-400 rounded-xl hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
