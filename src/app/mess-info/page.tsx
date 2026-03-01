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
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!mess) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">No mess found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Mess Info Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">🏠 {mess.name}</h1>
        <p className="text-gray-500 text-sm">Created by {mess.createdBy} · {mess.memberCount} members</p>

        {/* Invite Code */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
          <p className="text-sm text-gray-600 mb-2 font-medium">📨 Invite Code — Share with new members</p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <p className="text-xl sm:text-2xl font-mono font-bold text-indigo-600 tracking-widest break-all flex-1">
              {mess.inviteCode}
            </p>
            <button
              onClick={copyCode}
              className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors w-full sm:w-auto text-center"
            >
              {copied ? "✅ Copied!" : "📋 Copy"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Members who use this code will need your approval to join</p>
        </div>
      </div>

      {/* Pending Join Requests - Manager Only */}
      {isManager && pendingRequests.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border-2 border-yellow-300 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            ⏳ Pending Join Requests
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">
              {pendingRequests.length}
            </span>
          </h2>
          <p className="text-sm text-gray-500 mb-4">These people want to join your mess</p>
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{req.user.name}</p>
                  <p className="text-sm text-gray-500 truncate">{req.user.email}</p>
                  {req.user.phone && (
                    <p className="text-xs text-gray-400">📱 {req.user.phone}</p>
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">👥 Members</h2>
        <div className="space-y-3">
          {mess.members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900">
                  {member.name}
                  {member.role === "MANAGER" && (
                    <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                      👑 Manager
                    </span>
                  )}
                  {member.id === session?.user?.id && (
                    <span className="ml-1 text-xs text-gray-400">(you)</span>
                  )}
                </p>
                <p className="text-sm text-gray-500 truncate">{member.email}</p>
                {member.phone && (
                  <p className="text-xs text-gray-400 sm:hidden">📱 {member.phone}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {member.phone && (
                  <span className="text-sm text-gray-400 hidden sm:inline">📱 {member.phone}</span>
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
                          className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded-lg transition-colors"
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

      {/* Washroom Settings - Manager Only */}
      {isManager && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">🚿 Washroom Cleaning</h2>
          <p className="text-sm text-gray-500 mb-4">
            Configure washroom cleaning rotation. Set to 0 to disable.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-gray-700 font-medium">Washrooms:</label>
            <input
              type="number"
              min={0}
              max={10}
              value={washroomInput}
              onChange={(e) => setWashroomInput(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
              className="w-20 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
          <p className="mt-3 text-xs text-gray-400">
            {mess && mess.washroomCount > 0
              ? `Currently: ${mess.washroomCount} washroom${mess.washroomCount !== 1 ? "s" : ""} · Rotation is active`
              : "Currently: Disabled · Members won't see the washroom page"}
          </p>
        </div>
      )}

      {/* Deposit Reminder Threshold - Manager Only */}
      {isManager && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">💰 Deposit Reminder</h2>
          <p className="text-sm text-gray-500 mb-4">
            Set the net-due threshold (৳). Members with dues above this amount will see a reminder on their dashboard. Set to 0 to disable.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-gray-700 font-medium">Threshold (৳):</label>
            <input
              type="number"
              min={0}
              max={10000}
              step={100}
              value={thresholdInput}
              onChange={(e) => setThresholdInput(Math.max(0, Math.min(10000, parseInt(e.target.value) || 0)))}
              className="w-28 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
          <p className="mt-3 text-xs text-gray-400">
            {mess && mess.dueThreshold > 0
              ? `Currently: ৳${mess.dueThreshold} · Members owing more than this will see a warning`
              : "Currently: Disabled · No deposit reminders will be shown"}
          </p>
        </div>
      )}

      {/* Danger Zone - Manager Only */}
      {isManager && (
        <div className="bg-white rounded-xl shadow-sm border-2 border-red-200 p-6">
          <h2 className="text-lg font-semibold text-red-700 mb-1">⚠️ Danger Zone</h2>
          <p className="text-sm text-gray-500 mb-4">Permanently delete this mess and all its data. This cannot be undone.</p>

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
                  className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-colors"
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
