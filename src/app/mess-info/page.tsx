"use client";

import { useState, useEffect, useCallback } from "react";
import { Home, Pencil, Mailbox, Check, Clipboard, Hourglass, Smartphone, X, Users, Crown, Ban, Utensils, AlarmClock, Trash2, Droplets, Coins, Bot, Settings, AlertTriangle, Skull, RefreshCw } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface MessInfo {
  id: string;
  name: string;
  inviteCode: string;
  washroomCount: number;
  dueThreshold: number;
  bazarDaysPerWeek: number;
  hasGas: boolean;
  hasCook: boolean;
  autoMealEntry: boolean;
  mealsPerDay: number;
  mealTypes: string;
  mealBlackouts: string;
  createdBy: string;
  memberCount: number;
  members: {
    id: string;
    name: string;
    email: string;
    role: string;
    phone: string | null;
  }[];
}

interface JoinRequestInfo {
  id: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
}

interface BlackoutInterval {
  meals: string[];
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export default function MessInfoPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [mess, setMess] = useState<MessInfo | null>(null);
  const [pendingRequests, setPendingRequests] = useState<JoinRequestInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [kickConfirm, setKickConfirm] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [washroomInput, setWashroomInput] = useState(0);
  const [washroomSaving, setWashroomSaving] = useState(false);
  const [washroomMsg, setWashroomMsg] = useState("");
  const [thresholdInput, setThresholdInput] = useState(500);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdMsg, setThresholdMsg] = useState("");
  const [bazarDaysInput, setBazarDaysInput] = useState(3);
  const [hasGasInput, setHasGasInput] = useState(false);
  const [hasCookInput, setHasCookInput] = useState(false);
  const [autoMealEntryInput, setAutoMealEntryInput] = useState(false);
  const [autoMealSaving, setAutoMealSaving] = useState(false);
  const [autoMealMsg, setAutoMealMsg] = useState("");
  const [extraSaving, setExtraSaving] = useState(false);
  const [extraMsg, setExtraMsg] = useState("");
  // Meal config state
  const [mealTypesInput, setMealTypesInput] = useState<string[]>(["breakfast", "lunch", "dinner"]);
  const [customMealName, setCustomMealName] = useState("");
  const [blackoutsInput, setBlackoutsInput] = useState<BlackoutInterval[]>([]);
  const [mealConfigSaving, setMealConfigSaving] = useState(false);
  const [mealConfigMsg, setMealConfigMsg] = useState("");
  // Mess name editing
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState("");

  // Derive isManager from the API response, not the JWT (which can be stale)
  const isManager = mess?.members.some(
    (m) => m.id === session?.user?.id && m.role === "MANAGER"
  ) ?? false;

  const fetchData = useCallback(async () => {
    try {
      const messRes = await fetch("/api/mess", { cache: "no-store" });
      const messData = await messRes.json();
      setMess(messData.mess);

      if (!messData.mess) {
        setLoading(false);
        return;
      }

      // Check if the current user is a manager from the API response
      const userIsManager = messData.mess.members?.some(
        (m: { id: string; role: string }) => m.id === session?.user?.id && m.role === "MANAGER"
      );

      if (messData.mess) {
        setWashroomInput(messData.mess.washroomCount || 0);
        setThresholdInput(messData.mess.dueThreshold ?? 500);
        setBazarDaysInput(messData.mess.bazarDaysPerWeek ?? 3);
        setHasGasInput(messData.mess.hasGas ?? false);
        setHasCookInput(messData.mess.hasCook ?? false);
        setAutoMealEntryInput(messData.mess.autoMealEntry ?? false);
        try {
          const mt = JSON.parse(messData.mess.mealTypes || '["breakfast","lunch","dinner"]');
          if (Array.isArray(mt) && mt.length > 0) setMealTypesInput(mt);
        } catch {
          setMealTypesInput(["breakfast", "lunch", "dinner"]);
        }
        try {
          const parsed = JSON.parse(messData.mess.mealBlackouts || "[]");
          setBlackoutsInput(Array.isArray(parsed) ? parsed : []);
        } catch {
          setBlackoutsInput([]);
        }
      }

      // Fetch join requests if user is a manager (determined from API, not JWT)
      if (userIsManager) {
        try {
          const requestsRes = await fetch("/api/join-requests");
          const reqData = await requestsRes.json();
          setPendingRequests(reqData.requests || []);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session, fetchData]);

  const copyCode = () => {
    if (mess) {
      navigator.clipboard.writeText(mess.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRequest = async (requestId: string, action: "approve" | "reject") => {
    setActionLoading(requestId);
    try {
      const res = await fetch("/api/join-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, requestId }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleKick = async (memberId: string) => {
    setActionLoading(memberId);
    try {
      const res = await fetch("/api/join-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "kick", memberId }),
      });
      if (res.ok) {
        setKickConfirm(null);
        await fetchData();
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleWashroomSave = async () => {
    setWashroomSaving(true);
    setWashroomMsg("");
    try {
      const res = await fetch("/api/mess", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ washroomCount: washroomInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setWashroomMsg(washroomInput === 0 ? "Washroom cleaning disabled" : `Washroom count set to ${washroomInput}`);
        if (mess) {
          setMess({ ...mess, washroomCount: washroomInput });
        }
      } else {
        setWashroomMsg(data.error || "Failed to save");
      }
    } catch {
      setWashroomMsg("Something went wrong");
    } finally {
      setWashroomSaving(false);
      setTimeout(() => setWashroomMsg(""), 3000);
    }
  };

  const handleThresholdSave = async () => {
    setThresholdSaving(true);
    setThresholdMsg("");
    try {
      const res = await fetch("/api/mess", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueThreshold: thresholdInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setThresholdMsg(thresholdInput === 0 ? "Deposit reminder disabled" : `Threshold set to ৳${thresholdInput}`);
        if (mess) {
          setMess({ ...mess, dueThreshold: thresholdInput });
        }
      } else {
        setThresholdMsg(data.error || "Failed to save");
      }
    } catch {
      setThresholdMsg("Something went wrong");
    } finally {
      setThresholdSaving(false);
      setTimeout(() => setThresholdMsg(""), 3000);
    }
  };

  const handleDeleteMess = async () => {
    if (!mess || deleteText !== mess.name) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/mess", { method: "DELETE" });
      if (res.ok) {
        router.push("/onboarding");
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!mess) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">No mess found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Mess Info Card */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border border-white/10 p-6">
        {/* Mess Name with Edit */}
        {editingName ? (
          <div className="mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl"><Home className="w-5 h-5 inline-block" /></span>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={50}
                autoFocus
                className="text-2xl font-bold text-white bg-white/[0.06] border border-white/10 rounded-lg px-3 py-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none flex-1 min-w-0"
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setEditingName(false); setNameMsg(""); }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    // trigger save
                    (async () => {
                      const trimmed = nameInput.trim();
                      if (!trimmed || trimmed.length < 2) { setNameMsg("Name must be at least 2 characters"); return; }
                      if (trimmed === mess.name) { setEditingName(false); return; }
                      setNameSaving(true);
                      setNameMsg("");
                      try {
                        const res = await fetch("/api/mess", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: trimmed }),
                        });
                        if (res.ok) {
                          setMess({ ...mess, name: trimmed });
                          setEditingName(false);
                          setNameMsg("Name updated!");
                        } else {
                          const d = await res.json();
                          setNameMsg(d.error || "Failed to update");
                        }
                      } catch { setNameMsg("Error updating name"); }
                      finally { setNameSaving(false); setTimeout(() => setNameMsg(""), 3000); }
                    })();
                  }
                }}
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                disabled={nameSaving}
                onClick={async () => {
                  const trimmed = nameInput.trim();
                  if (!trimmed || trimmed.length < 2) { setNameMsg("Name must be at least 2 characters"); return; }
                  if (trimmed === mess.name) { setEditingName(false); return; }
                  setNameSaving(true);
                  setNameMsg("");
                  try {
                    const res = await fetch("/api/mess", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: trimmed }),
                    });
                    if (res.ok) {
                      setMess({ ...mess, name: trimmed });
                      setEditingName(false);
                      setNameMsg("Name updated!");
                    } else {
                      const d = await res.json();
                      setNameMsg(d.error || "Failed to update");
                    }
                  } catch { setNameMsg("Error updating name"); }
                  finally { setNameSaving(false); setTimeout(() => setNameMsg(""), 3000); }
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {nameSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => { setEditingName(false); setNameMsg(""); }}
                className="px-3 py-1.5 bg-white/[0.08] hover:bg-white/[0.12] text-slate-300 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
            {nameMsg && (
              <p className={`mt-1 text-sm ${nameMsg.includes("updated") ? "text-green-500" : "text-red-500"}`}>
                {nameMsg.includes("updated") ? <Check className="w-4 h-4 inline-block text-green-500" /> : <AlertTriangle className="w-4 h-4 inline-block text-red-500" />} {nameMsg}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white"><Home className="w-5 h-5 inline-block" /> {mess.name}</h1>
            {isManager && (
              <button
                onClick={() => { setNameInput(mess.name); setEditingName(true); }}
                className="px-2 py-1 text-slate-400 hover:text-indigo-400 hover:bg-white/[0.06] rounded-lg transition-colors text-sm"
                title="Edit mess name"
              >
                <Pencil className="w-4 h-4 inline-block" />
              </button>
            )}
          </div>
        )}
        {nameMsg && !editingName && (
          <p className={`mb-2 text-sm ${nameMsg.includes("updated") ? "text-green-500" : "text-red-500"}`}>
            {nameMsg.includes("updated") ? <Check className="w-4 h-4 inline-block text-green-500" /> : <AlertTriangle className="w-4 h-4 inline-block" />} {nameMsg}
          </p>
        )}
        <p className="text-slate-400 text-sm">Created by {mess.createdBy} · {mess.memberCount} members</p>

        {/* Invite Code - High Visibility Box */}
        <div className="mt-8 bg-[#1e293b]/50 border-2 border-indigo-500/40 rounded-2xl p-6 relative overflow-hidden shadow-2xl shadow-indigo-500/10">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
            <div className="p-2 bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/20">
              <Mailbox className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-indigo-400 font-black uppercase tracking-wider">Invitation Access</p>
              <p className="text-sm text-slate-300 font-medium">Share this code with your roommates to join</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-4">
            <div className="flex-1 bg-black/40 border border-white/10 rounded-xl px-6 py-5 flex items-center justify-center sm:justify-start">
              <p className="text-3xl sm:text-4xl font-mono font-black text-white tracking-[0.25em] drop-shadow-lg">
                {mess.inviteCode}
              </p>
            </div>
            
            <button
              onClick={copyCode}
              className={`flex items-center justify-center gap-3 px-8 py-5 rounded-xl font-black text-base transition-all shrink-0 shadow-2xl active:scale-95
                ${copied 
                  ? "bg-emerald-500 text-white shadow-emerald-500/40" 
                  : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/40"
                }`}
            >
              {copied ? (
                <><Check className="w-6 h-6 animate-bounce" /> Copied!</>
              ) : (
                <><Clipboard className="w-6 h-6" /> Copy Code</>
              )}
            </button>
          </div>
          
          <div className="mt-5 flex items-center justify-center sm:justify-start gap-2 text-xs text-slate-400 font-bold bg-white/5 p-3 rounded-lg border border-white/5">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>New members require your approval to become active</span>
          </div>
        </div>
      </div>

      {/* Pending Join Requests - Manager Only */}
      {isManager && pendingRequests.length > 0 && (
        <div className="bg-yellow-500/5 backdrop-blur-xl border border-yellow-500/30 rounded-xl shadow-lg shadow-yellow-500/5 p-6 animate-pulse">
          <h2 className="text-lg font-semibold text-yellow-200 mb-1 flex items-center gap-2">
            <Hourglass className="w-5 h-5 text-yellow-400 animate-spin" /> Pending Join Requests
            <span className="px-2 py-0.5 bg-yellow-400/20 text-yellow-300 text-xs font-bold rounded-full border border-yellow-400/30">
              {pendingRequests.length}
            </span>
          </h2>
          <p className="text-sm text-yellow-200/60 mb-4 font-medium">These people want to join your mess</p>
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-yellow-500/40 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold">
                    {req.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-white group-hover:text-yellow-100 transition-colors">{req.user.name}</p>
                    <p className="text-sm text-slate-400 font-medium truncate">{req.user.email}</p>
                    {req.user.phone && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Smartphone className="w-3 h-3" /> {req.user.phone}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleRequest(req.id, "approve")}
                    disabled={actionLoading === req.id}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {actionLoading === req.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Approve</>}
                  </button>
                  <button
                    onClick={() => handleRequest(req.id, "reject")}
                    disabled={actionLoading === req.id}
                    className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-sm font-bold rounded-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members List */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4"><Users className="w-5 h-5 inline-block" /> Members</h2>
        <div className="space-y-3">
          {mess.members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white/[0.04] rounded-lg"
            >
              <div className="min-w-0">
                <p className="font-medium text-white">
                  {member.name}
                  {member.role === "MANAGER" && (
                    <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                      <Crown className="w-3 h-3 inline-block -mt-0.5" /> Manager
                    </span>
                  )}
                  {member.id === session?.user?.id && (
                    <span className="ml-1 text-xs text-slate-400">(you)</span>
                  )}
                </p>
                <p className="text-sm text-slate-400 truncate">{member.email}</p>
                {member.phone && (
                  <p className="text-xs text-slate-400 sm:hidden"><Smartphone className="w-3 h-3 inline-block" /> {member.phone}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {member.phone && (
                  <span className="text-sm text-slate-400 hidden sm:inline"><Smartphone className="w-3 h-3 inline-block" /> {member.phone}</span>
                )}
                {/* Kick button - manager only, not for self, not for other managers */}
                {isManager && member.role !== "MANAGER" && member.id !== session?.user?.id && (
                  <>
                    {kickConfirm === member.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleKick(member.id)}
                          disabled={actionLoading === member.id}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          {actionLoading === member.id ? "..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => setKickConfirm(null)}
                          className="px-3 py-2 bg-white/[0.08] hover:bg-white/[0.12] text-slate-300 text-xs font-medium rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setKickConfirm(member.id)}
                        className="px-3 py-2 text-red-400 hover:text-red-600 hover:bg-red-50 text-xs font-medium rounded-lg transition-colors"
                        title={`Remove ${member.name} from mess`}
                      >
                        <Ban className="w-4 h-4 inline-block" /> Kick
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Meal Configuration - Manager Only */}
      {isManager && (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-1"><Utensils className="w-5 h-5 inline-block" /> Meal Configuration</h2>
          <p className="text-sm text-slate-400 mb-4">
            Set how many meals per day and configure blackout windows (time restrictions for toggling meals).
          </p>

          {/* Meal Types Selection */}
          <div className="mb-5">
            <label className="text-sm text-slate-300 font-medium block mb-2">Meal Types</label>
            <p className="text-xs text-slate-400 mb-3">Select which meals your mess has. You can also add custom meal names.</p>
            <div className="flex flex-wrap gap-3 mb-3">
              {["breakfast", "lunch", "dinner", "snacks", "supper"].map((meal) => (
                <label key={meal} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mealTypesInput.includes(meal)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setMealTypesInput([...mealTypesInput, meal]);
                      } else {
                        setMealTypesInput(mealTypesInput.filter((m) => m !== meal));
                      }
                    }}
                    className="rounded border-white/10 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="capitalize text-slate-300">{meal}</span>
                </label>
              ))}
            </div>
            {/* Custom meal tags */}
            {mealTypesInput.filter((m) => !["breakfast", "lunch", "dinner", "snacks", "supper"].includes(m)).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {mealTypesInput.filter((m) => !["breakfast", "lunch", "dinner", "snacks", "supper"].includes(m)).map((m) => (
                  <span key={m} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-700 text-sm rounded-full">
                    {m}
                    <button onClick={() => setMealTypesInput(mealTypesInput.filter((x) => x !== m))} className="text-indigo-400 hover:text-indigo-600">✕</button>
                  </span>
                ))}
              </div>
            )}
            {/* Add custom meal */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customMealName}
                onChange={(e) => setCustomMealName(e.target.value)}
                placeholder="Custom meal name..."
                maxLength={30}
                className="px-3 py-2 border border-white/10 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 w-48"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const name = customMealName.trim().toLowerCase();
                    if (name && !mealTypesInput.includes(name)) {
                      setMealTypesInput([...mealTypesInput, name]);
                      setCustomMealName("");
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  const name = customMealName.trim().toLowerCase();
                  if (name && !mealTypesInput.includes(name)) {
                    setMealTypesInput([...mealTypesInput, name]);
                    setCustomMealName("");
                  }
                }}
                className="px-3 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 text-sm font-medium rounded-lg transition-colors border border-white/10"
              >
                + Add
              </button>
            </div>
            {mealTypesInput.length === 0 && (
              <p className="text-xs text-red-500 mt-1"><AlertTriangle className="w-4 h-4 inline-block" /> Select at least one meal type</p>
            )}
            <p className="mt-2 text-xs text-slate-400">Current: {mealTypesInput.length} meal{mealTypesInput.length !== 1 ? "s" : ""}/day — {mealTypesInput.join(", ")}</p>
          </div>

          {/* Meal Entry Cutoff Times */}
          <div className="mb-5">
            <label className="text-sm text-slate-300 font-medium block mb-2">
              <AlarmClock className="w-5 h-5 inline-block -mt-1" /> Meal Entry Time (Auto Lock)
            </label>
            <p className="text-xs text-slate-400 mb-3">
              After this time, meal status toggles are locked for the rest of the day. The auto meal entry will snapshot at this time.
            </p>

            {blackoutsInput.length === 0 && (
              <p className="text-sm text-slate-400 italic mb-3">No cutoff time set — members can toggle meals anytime.</p>
            )}

            <div className="space-y-3">
              {blackoutsInput.map((bo, idx) => {
                const availableMeals = mealTypesInput;
                return (
                  <div key={idx} className="p-4 bg-white/[0.04] border border-white/10 rounded-lg">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="text-sm font-medium text-slate-300">Cutoff #{idx + 1}</span>
                      <button
                        onClick={() => {
                          const updated = [...blackoutsInput];
                          updated.splice(idx, 1);
                          setBlackoutsInput(updated);
                        }}
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete restriction"
                      >
                        <Trash2 className="w-4 h-4 inline-block" /> Delete
                      </button>
                    </div>

                    {/* Meal checkboxes */}
                    <div className="flex flex-wrap gap-3 mb-3">
                      <span className="text-xs text-slate-400 w-full">Applies to:</span>
                      {availableMeals.map((meal) => (
                        <label key={meal} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={bo.meals.includes(meal)}
                            onChange={(e) => {
                              const updated = [...blackoutsInput];
                              if (e.target.checked) {
                                updated[idx] = { ...updated[idx], meals: [...updated[idx].meals, meal] };
                              } else {
                                updated[idx] = { ...updated[idx], meals: updated[idx].meals.filter((m) => m !== meal) };
                              }
                              setBlackoutsInput(updated);
                            }}
                            className="rounded border-white/10 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="capitalize text-slate-300">{meal}</span>
                        </label>
                      ))}
                    </div>

                    {/* Cutoff time */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-400">Lock after:</span>
                      <input
                        type="time"
                        value={`${String(bo.startHour).padStart(2, '0')}:${String(bo.startMinute ?? 0).padStart(2, '0')}`}
                        onChange={(e) => {
                          const [h, m] = e.target.value.split(':').map(Number);
                          const updated = [...blackoutsInput];
                          updated[idx] = { ...updated[idx], startHour: h, startMinute: m, endHour: 23, endMinute: 59 };
                          setBlackoutsInput(updated);
                        }}
                        className="px-2 py-1.5 border border-white/10 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-500">Locked until end of day</span>
                    </div>
                    {bo.meals.length === 0 && (
                      <p className="text-xs text-red-500 mt-1"><AlertTriangle className="w-4 h-4 inline-block" /> Select at least one meal</p>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() =>
                setBlackoutsInput([
                  ...blackoutsInput,
                  { meals: mealTypesInput.slice(0, 2), startHour: 7, startMinute: 0, endHour: 23, endMinute: 59 },
                ])
              }
              className="mt-3 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 text-sm font-medium rounded-lg transition-colors border border-white/10"
            >
              + Add cutoff time
            </button>
          </div>

          {/* Save */}
          <button
            onClick={async () => {
              // Validate
              for (const bo of blackoutsInput) {
                if (bo.meals.length === 0) {
                  setMealConfigMsg("Each cutoff must have at least one meal selected");
                  setTimeout(() => setMealConfigMsg(""), 3000);
                  return;
                }
              }
              setMealConfigSaving(true);
              setMealConfigMsg("");
              try {
                const res = await fetch("/api/mess", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ mealTypes: mealTypesInput, mealBlackouts: blackoutsInput }),
                });
                if (res.ok) {
                  setMealConfigMsg("Meal settings saved!");
                  if (mess) setMess({ ...mess, mealsPerDay: mealTypesInput.length, mealTypes: JSON.stringify(mealTypesInput), mealBlackouts: JSON.stringify(blackoutsInput) });
                } else {
                  const d = await res.json();
                  setMealConfigMsg(d.error || "Failed to save");
                }
              } catch {
                setMealConfigMsg("Error saving settings");
              } finally {
                setMealConfigSaving(false);
                setTimeout(() => setMealConfigMsg(""), 3000);
              }
            }}
            disabled={mealConfigSaving}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {mealConfigSaving ? "Saving..." : "Save Meal Settings"}
          </button>
          {mealConfigMsg && (
            <p className={`mt-2 text-sm ${mealConfigMsg.includes("Error") || mealConfigMsg.includes("must") ? "text-red-600" : "text-green-600"}`}>
              {mealConfigMsg.includes("Error") || mealConfigMsg.includes("must") ? <AlertTriangle className="w-4 h-4 inline-block" /> : <Check className="w-4 h-4 inline-block text-green-500" />} {mealConfigMsg}
            </p>
          )}
          <p className="mt-3 text-xs text-slate-400">
            {mess && blackoutsInput.length > 0
              ? `Currently: ${mealTypesInput.length} meals/day (${mealTypesInput.join(", ")}) · ${blackoutsInput.length} cutoff${blackoutsInput.length !== 1 ? "s" : ""} active`
              : `Currently: ${mealTypesInput.length} meals/day (${mealTypesInput.join(", ")}) · No cutoffs — members can toggle anytime`}
          </p>
        </div>
      )}

      {/* Washroom Settings - Manager Only */}
      {isManager && (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-1"><Droplets className="w-5 h-5 inline-block" /> Washroom Cleaning</h2>
          <p className="text-sm text-slate-400 mb-4">
            Configure washroom cleaning rotation. Set to 0 to disable.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-300 font-medium">Washrooms:</label>
            <input
              type="number"
              min={0}
              max={10}
              value={washroomInput}
              onChange={(e) => setWashroomInput(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
              className="w-20 px-3 py-2.5 border border-white/10 rounded-lg text-sm text-white text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              onClick={handleWashroomSave}
              disabled={washroomSaving || washroomInput === (mess?.washroomCount ?? 0)}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {washroomSaving ? "Saving..." : "Save"}
            </button>
          </div>
          {washroomMsg && (
            <p className="mt-2 text-sm text-green-600"><Check className="w-4 h-4 inline-block text-green-500" /> {washroomMsg}</p>
          )}
          <p className="mt-3 text-xs text-slate-400">
            {mess && mess.washroomCount > 0
              ? `Currently: ${mess.washroomCount} washroom${mess.washroomCount !== 1 ? "s" : ""} · Rotation is active`
              : "Currently: Disabled · Members won't see the washroom page"}
          </p>
        </div>
      )}

      {/* Deposit Reminder Threshold - Manager Only */}
      {isManager && (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-1"><Coins className="w-5 h-5 inline-block" /> Deposit Reminder</h2>
          <p className="text-sm text-slate-400 mb-4">
            Set the net-due threshold (৳). Members with dues above this amount will see a reminder on their dashboard. Set to 0 to disable.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-300 font-medium">Threshold (৳):</label>
            <input
              type="number"
              min={0}
              max={10000}
              step={100}
              value={thresholdInput}
              onChange={(e) => setThresholdInput(Math.max(0, Math.min(10000, parseInt(e.target.value) || 0)))}
              className="w-24 px-3 py-2.5 border border-white/10 rounded-lg text-sm text-white text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              onClick={handleThresholdSave}
              disabled={thresholdSaving || thresholdInput === (mess?.dueThreshold ?? 500)}
              className="px-4 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {thresholdSaving ? "Saving..." : "Save"}
            </button>
          </div>
          {thresholdMsg && (
            <p className="mt-2 text-sm text-green-600"><Check className="w-4 h-4 inline-block text-green-500" /> {thresholdMsg}</p>
          )}
          <p className="mt-3 text-xs text-slate-400">
            {mess && mess.dueThreshold > 0
              ? `Currently: ৳${mess.dueThreshold} · Members owing more than this will see a warning`
              : "Currently: Disabled · No deposit reminders will be shown"}
          </p>
        </div>
      )}

      {/* Auto Meal Entry - Manager Only */}
      {isManager && (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-1"><Bot className="w-5 h-5 inline-block" /> Auto Meal Entry</h2>
          <p className="text-sm text-slate-400 mb-4">
            If enabled, members&apos; Meal Statuses are automatically finalized into billing entries every day. Disable this if you want to manually verify and input meals.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoMealEntryInput}
                onChange={(e) => setAutoMealEntryInput(e.target.checked)}
                className="w-5 h-5 rounded border-white/10 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-sm text-slate-300 font-medium">Enable Auto Entry</span>
            </label>
            <button
              onClick={async () => {
                setAutoMealSaving(true);
                setAutoMealMsg("");
                try {
                  const res = await fetch("/api/mess", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ autoMealEntry: autoMealEntryInput }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setAutoMealMsg("Auto Meal Entry Setting saved");
                    if (mess) setMess({ ...mess, autoMealEntry: autoMealEntryInput });
                  } else {
                    setAutoMealMsg(data.error || "Failed to save");
                  }
                } catch { setAutoMealMsg("Something went wrong"); }
                finally { setAutoMealSaving(false); setTimeout(() => setAutoMealMsg(""), 3000); }
              }}
              disabled={autoMealSaving || autoMealEntryInput === (mess?.autoMealEntry ?? false)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {autoMealSaving ? "Saving..." : "Save"}
            </button>
          </div>
          {autoMealMsg && (
            <p className="mt-2 text-sm text-green-600"><Check className="w-4 h-4 inline-block text-green-500" /> {autoMealMsg}</p>
          )}
        </div>
      )}


      {/* Mess Features - Manager Only */}
      {isManager && (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-1"><Settings className="w-5 h-5 inline-block" /> Mess Features</h2>
          <p className="text-sm text-slate-400 mb-4">Configure bazar rotation and utilities for your mess.</p>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-slate-300 font-medium w-40">Bazar Days/Week:</label>
              <select
                value={bazarDaysInput}
                onChange={(e) => setBazarDaysInput(Number(e.target.value))}
                className="px-3 py-2.5 border border-white/10 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
              >
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <option key={n} value={n}>{n} days</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-300 font-medium w-40">Has Gas Connection:</label>
              <button
                onClick={() => setHasGasInput(!hasGasInput)}
                className={`w-12 h-7 rounded-full transition-colors ${hasGasInput ? 'bg-green-500' : 'bg-white/[0.12]'}`}
              >
                <div className={`w-5 h-5 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-full shadow transition-transform ${hasGasInput ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-xs text-slate-400">{hasGasInput ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-300 font-medium w-40">Has Cook:</label>
              <button
                onClick={() => setHasCookInput(!hasCookInput)}
                className={`w-12 h-7 rounded-full transition-colors ${hasCookInput ? 'bg-green-500' : 'bg-white/[0.12]'}`}
              >
                <div className={`w-5 h-5 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-full shadow transition-transform ${hasCookInput ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-xs text-slate-400">{hasCookInput ? 'Enabled' : 'Disabled'}</span>
            </div>
            <button
              onClick={async () => {
                setExtraSaving(true);
                setExtraMsg("");
                try {
                  const res = await fetch("/api/mess", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bazarDaysPerWeek: bazarDaysInput, hasGas: hasGasInput, hasCook: hasCookInput }),
                  });
                  if (res.ok) {
                    setExtraMsg("Settings saved!");
                    if (mess) setMess({ ...mess, bazarDaysPerWeek: bazarDaysInput, hasGas: hasGasInput, hasCook: hasCookInput });
                  } else {
                    const d = await res.json();
                    setExtraMsg(d.error || "Failed");
                  }
                } catch { setExtraMsg("Error"); } finally {
                  setExtraSaving(false);
                  setTimeout(() => setExtraMsg(""), 3000);
                }
              }}
              disabled={extraSaving}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {extraSaving ? "Saving..." : "Save Features"}
            </button>
            {extraMsg && <p className="text-sm text-green-600"><Check className="w-4 h-4 inline-block text-green-500" /> {extraMsg}</p>}
          </div>
        </div>
      )}

      {/* Danger Zone - Manager Only */}
      {isManager && (
        <div className="bg-[#1a1a3e]/50 backdrop-blur-xl border border-red-500/20 rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-red-400 mb-1"><AlertTriangle className="w-4 h-4 inline-block" /> Danger Zone</h2>
          <p className="text-sm text-slate-400 mb-4">Permanently delete this mess and all its data. This cannot be undone.</p>

          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4 inline-block" /> Delete Mess
            </button>
          ) : (
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 space-y-3">
              <p className="text-sm text-red-300 font-medium">
                This will permanently delete <span className="font-bold">{mess.name}</span>, all meals, deposits, bazar entries, audit logs, and remove all members.
              </p>
              <div>
                <label className="block text-xs text-red-400 mb-1">
                  Type <span className="font-mono font-bold">{mess.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  className="w-full px-3 py-2 bg-black/20 border border-red-500/30 rounded-lg text-sm text-white placeholder-red-500/30 focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none"
                  placeholder={mess.name}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteMess}
                  disabled={deleting || deleteText !== mess.name}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? "Deleting..." : <><Skull className="w-4 h-4 inline-block" /> Permanently Delete</>}
                </button>
                <button
                  onClick={() => { setDeleteConfirm(false); setDeleteText(""); }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
