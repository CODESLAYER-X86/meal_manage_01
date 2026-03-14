"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [extraSaving, setExtraSaving] = useState(false);
  const [extraMsg, setExtraMsg] = useState("");
  // Meal config state
  const [mealTypesInput, setMealTypesInput] = useState<string[]>(["breakfast", "lunch", "dinner"]);
  const [customMealName, setCustomMealName] = useState("");
  const [blackoutsInput, setBlackoutsInput] = useState<BlackoutInterval[]>([]);
  const [mealConfigSaving, setMealConfigSaving] = useState(false);
  const [mealConfigMsg, setMealConfigMsg] = useState("");

  const isManager = session?.user?.role === "MANAGER";

  const fetchData = useCallback(async () => {
    try {
      const [messRes, requestsRes] = await Promise.all([
        fetch("/api/mess"),
        isManager ? fetch("/api/join-requests") : Promise.resolve(null),
      ]);

      const messData = await messRes.json();
      setMess(messData.mess);
      if (messData.mess) {
        setWashroomInput(messData.mess.washroomCount || 0);
        setThresholdInput(messData.mess.dueThreshold ?? 500);
        setBazarDaysInput(messData.mess.bazarDaysPerWeek ?? 3);
        setHasGasInput(messData.mess.hasGas ?? false);
        setHasCookInput(messData.mess.hasCook ?? false);
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

      if (requestsRes) {
        const reqData = await requestsRes.json();
        setPendingRequests(reqData.requests || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [isManager]);

  useEffect(() => {
    if (session && !session.user?.messId) {
      router.push("/onboarding");
      return;
    }
    fetchData();
  }, [session, router, fetchData]);

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
        <h1 className="text-2xl font-bold text-white mb-1">🏠 {mess.name}</h1>
        <p className="text-slate-400 text-sm">Created by {mess.createdBy} · {mess.memberCount} members</p>

        {/* Invite Code */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
          <p className="text-sm text-slate-400 mb-2 font-medium">📨 Invite Code — Share with new members</p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <p className="text-xl sm:text-2xl font-mono font-bold text-indigo-600 tracking-widest break-all flex-1">
              {mess.inviteCode}
            </p>
            <button
              onClick={copyCode}
              className="px-4 py-2.5 bg-white/[0.06] border border-white/10 rounded-lg text-sm font-medium hover:bg-white/[0.04] transition-colors w-full sm:w-auto text-center"
            >
              {copied ? "✅ Copied!" : "📋 Copy"}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">Members who use this code will need your approval to join</p>
        </div>
      </div>

      {/* Pending Join Requests - Manager Only */}
      {isManager && pendingRequests.length > 0 && (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border-2 border-yellow-300 p-6">
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            ⏳ Pending Join Requests
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">
              {pendingRequests.length}
            </span>
          </h2>
          <p className="text-sm text-slate-400 mb-4">These people want to join your mess</p>
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
              >
                <div>
                  <p className="font-medium text-white">{req.user.name}</p>
                  <p className="text-sm text-slate-400 truncate">{req.user.email}</p>
                  {req.user.phone && (
                    <p className="text-xs text-slate-400">📱 {req.user.phone}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRequest(req.id, "approve")}
                    disabled={actionLoading === req.id}
                    className="px-3 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex-1 sm:flex-none"
                  >
                    {actionLoading === req.id ? "..." : "✅ Approve"}
                  </button>
                  <button
                    onClick={() => handleRequest(req.id, "reject")}
                    disabled={actionLoading === req.id}
                    className="px-3 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex-1 sm:flex-none"
                  >
                    ❌ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members List */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">👥 Members</h2>
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
                      👑 Manager
                    </span>
                  )}
                  {member.id === session?.user?.id && (
                    <span className="ml-1 text-xs text-slate-400">(you)</span>
                  )}
                </p>
                <p className="text-sm text-slate-400 truncate">{member.email}</p>
                {member.phone && (
                  <p className="text-xs text-slate-400 sm:hidden">📱 {member.phone}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {member.phone && (
                  <span className="text-sm text-slate-400 hidden sm:inline">📱 {member.phone}</span>
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
                        🚫 Kick
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
          <h2 className="text-lg font-semibold text-white mb-1">🍽️ Meal Configuration</h2>
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
              <p className="text-xs text-red-500 mt-1">⚠️ Select at least one meal type</p>
            )}
            <p className="mt-2 text-xs text-slate-400">Current: {mealTypesInput.length} meal{mealTypesInput.length !== 1 ? "s" : ""}/day — {mealTypesInput.join(", ")}</p>
          </div>

          {/* Blackout Windows */}
          <div className="mb-5">
            <label className="text-sm text-slate-300 font-medium block mb-2">
              ⏰ Blackout Windows (Restrictions)
            </label>
            <p className="text-xs text-slate-400 mb-3">
              Members cannot toggle meals ON/OFF during these times. They must send a special request instead.
            </p>

            {blackoutsInput.length === 0 && (
              <p className="text-sm text-slate-400 italic mb-3">No restrictions set — members can toggle meals anytime.</p>
            )}

            <div className="space-y-3">
              {blackoutsInput.map((bo, idx) => {
                const availableMeals = mealTypesInput;
                return (
                  <div key={idx} className="p-4 bg-white/[0.04] border border-white/10 rounded-lg">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="text-sm font-medium text-slate-300">Restriction #{idx + 1}</span>
                      <button
                        onClick={() => {
                          const updated = [...blackoutsInput];
                          updated.splice(idx, 1);
                          setBlackoutsInput(updated);
                        }}
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete restriction"
                      >
                        🗑️ Delete
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

                    {/* Time range */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-400">From:</span>
                      <input
                        type="time"
                        value={`${String(bo.startHour).padStart(2, '0')}:${String(bo.startMinute ?? 0).padStart(2, '0')}`}
                        onChange={(e) => {
                          const [h, m] = e.target.value.split(':').map(Number);
                          const updated = [...blackoutsInput];
                          updated[idx] = { ...updated[idx], startHour: h, startMinute: m };
                          setBlackoutsInput(updated);
                        }}
                        className="px-2 py-1.5 border border-white/10 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-400">To:</span>
                      <input
                        type="time"
                        value={`${String(bo.endHour).padStart(2, '0')}:${String(bo.endMinute ?? 0).padStart(2, '0')}`}
                        onChange={(e) => {
                          const [h, m] = e.target.value.split(':').map(Number);
                          const updated = [...blackoutsInput];
                          updated[idx] = { ...updated[idx], endHour: h, endMinute: m };
                          setBlackoutsInput(updated);
                        }}
                        className="px-2 py-1.5 border border-white/10 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    {(bo.startHour * 60 + (bo.startMinute ?? 0)) >= (bo.endHour * 60 + (bo.endMinute ?? 0)) && (
                      <p className="text-xs text-red-500 mt-1">⚠️ Start time must be before end time</p>
                    )}
                    {bo.meals.length === 0 && (
                      <p className="text-xs text-red-500 mt-1">⚠️ Select at least one meal</p>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() =>
                setBlackoutsInput([
                  ...blackoutsInput,
                  { meals: mealTypesInput.slice(0, 2), startHour: 6, startMinute: 0, endHour: 10, endMinute: 0 },
                ])
              }
              className="mt-3 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 text-sm font-medium rounded-lg transition-colors border border-white/10"
            >
              + Add another restriction
            </button>
          </div>

          {/* Save */}
          <button
            onClick={async () => {
              // Validate
              for (const bo of blackoutsInput) {
                if (bo.meals.length === 0) {
                  setMealConfigMsg("Each restriction must have at least one meal selected");
                  setTimeout(() => setMealConfigMsg(""), 3000);
                  return;
                }
                if (bo.startHour * 60 + (bo.startMinute ?? 0) >= bo.endHour * 60 + (bo.endMinute ?? 0)) {
                  setMealConfigMsg("Start time must be before end time in all restrictions");
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
              {mealConfigMsg.includes("Error") || mealConfigMsg.includes("must") ? "⚠️" : "✅"} {mealConfigMsg}
            </p>
          )}
          <p className="mt-3 text-xs text-slate-400">
            {mess && blackoutsInput.length > 0
              ? `Currently: ${mealTypesInput.length} meals/day (${mealTypesInput.join(", ")}) · ${blackoutsInput.length} restriction${blackoutsInput.length !== 1 ? "s" : ""} active`
              : `Currently: ${mealTypesInput.length} meals/day (${mealTypesInput.join(", ")}) · No restrictions — members can toggle anytime`}
          </p>
        </div>
      )}

      {/* Washroom Settings - Manager Only */}
      {isManager && (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-1">🚿 Washroom Cleaning</h2>
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
            <p className="mt-2 text-sm text-green-600">✅ {washroomMsg}</p>
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
          <h2 className="text-lg font-semibold text-white mb-1">💰 Deposit Reminder</h2>
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
              className="w-28 px-3 py-2.5 border border-white/10 rounded-lg text-sm text-white text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              onClick={handleThresholdSave}
              disabled={thresholdSaving || thresholdInput === (mess?.dueThreshold ?? 500)}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {thresholdSaving ? "Saving..." : "Save"}
            </button>
          </div>
          {thresholdMsg && (
            <p className="mt-2 text-sm text-green-600">✅ {thresholdMsg}</p>
          )}
          <p className="mt-3 text-xs text-slate-400">
            {mess && mess.dueThreshold > 0
              ? `Currently: ৳${mess.dueThreshold} · Members owing more than this will see a warning`
              : "Currently: Disabled · No deposit reminders will be shown"}
          </p>
        </div>
      )}

      {/* Mess Features - Manager Only */}
      {isManager && (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-1">⚙️ Mess Features</h2>
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
            {extraMsg && <p className="text-sm text-green-600">✅ {extraMsg}</p>}
          </div>
        </div>
      )}

      {/* Danger Zone - Manager Only */}
      {isManager && (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border-2 border-red-200 p-6">
          <h2 className="text-lg font-semibold text-red-700 mb-1">⚠️ Danger Zone</h2>
          <p className="text-sm text-slate-400 mb-4">Permanently delete this mess and all its data. This cannot be undone.</p>

          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors"
            >
              🗑️ Delete Mess
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
              <p className="text-sm text-red-700 font-medium">
                This will permanently delete <span className="font-bold">{mess.name}</span>, all meals, deposits, bazar entries, audit logs, and remove all members.
              </p>
              <div>
                <label className="block text-xs text-red-600 mb-1">
                  Type <span className="font-mono font-bold">{mess.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder={mess.name}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteMess}
                  disabled={deleting || deleteText !== mess.name}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? "Deleting..." : "💀 Permanently Delete"}
                </button>
                <button
                  onClick={() => { setDeleteConfirm(false); setDeleteText(""); }}
                  className="px-4 py-2 bg-white/[0.08] hover:bg-white/[0.12] text-slate-300 text-sm font-medium rounded-lg transition-colors"
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
