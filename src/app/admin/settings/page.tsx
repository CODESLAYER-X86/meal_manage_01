"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Trash2, Shield, Clock, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";

export default function AdminSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isAdmin = (session?.user as any)?.isAdmin;

  // Email change
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [passError, setPassError] = useState("");
  const [passLoading, setPassLoading] = useState(false);

  // Platform settings (cleanup)
  const [cleanupEnabled, setCleanupEnabled] = useState(true);
  const [cleanupMonths, setCleanupMonths] = useState(2);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/profile")
        .then((r) => r.json())
        .then((data) => {
          setNewEmail(data.email || "");
        });

      // Fetch platform settings
      fetch("/api/admin/settings")
        .then((r) => r.json())
        .then((data) => {
          if (data.cleanup_enabled !== undefined) setCleanupEnabled(data.cleanup_enabled === "true");
          if (data.cleanup_months !== undefined) setCleanupMonths(Number(data.cleanup_months) || 2);
          setSettingsLoading(false);
        })
        .catch(() => setSettingsLoading(false));
    }
  }, [status]);

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg("");
    setEmailError("");
    setEmailLoading(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "email", newEmail, password: emailPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailMsg(data.message);
        setEmailPassword("");
      } else {
        setEmailError(data.error);
      }
    } catch {
      setEmailError("Failed to update email");
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg("");
    setPassError("");

    if (newPassword !== confirmPassword) {
      setPassError("New passwords don't match");
      return;
    }

    if (newPassword.length < 8) {
      setPassError("Password must be at least 8 characters");
      return;
    }

    setPassLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "password", currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPassMsg(data.message);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPassError(data.error);
      }
    } catch {
      setPassError("Failed to update password");
    } finally {
      setPassLoading(false);
    }
  };

  const saveSetting = async (key: string, value: string) => {
    setSettingsSaving(true);
    setSettingsMsg("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (res.ok) {
        setSettingsMsg(`✅ ${key} updated`);
        setTimeout(() => setSettingsMsg(""), 3000);
      } else {
        setSettingsMsg(`❌ ${data.error}`);
      }
    } catch {
      setSettingsMsg("❌ Failed to save");
    } finally {
      setSettingsSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-violet-400" /> Settings
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">Manage platform configuration and credentials</p>
      </div>

      {/* ===== Platform Data Cleanup Settings (Admin only) ===== */}
      {isAdmin && (
        <div className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 p-6 rounded-2xl shadow-xl shadow-black/20">
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-400" /> Data Cleanup Policy
          </h2>
          <p className="text-xs text-slate-400 mb-5">
            Control automatic data purging. This runs on the 1st of every month at 3 AM via Vercel Cron.
          </p>

          {settingsLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading settings...
            </div>
          ) : (
            <div className="space-y-5">
              {/* Toggle: Enable/Disable Cleanup */}
              <div className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/5 rounded-xl">
                <div className="flex items-center gap-3">
                  {cleanupEnabled ? (
                    <ToggleRight className="w-7 h-7 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-7 h-7 text-slate-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">
                      Auto-Cleanup {cleanupEnabled ? "Enabled" : "Disabled"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {cleanupEnabled
                        ? "Old data will be automatically deleted on schedule"
                        : "No data will be deleted automatically — all records are preserved"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const newVal = !cleanupEnabled;
                    setCleanupEnabled(newVal);
                    saveSetting("cleanup_enabled", String(newVal));
                  }}
                  disabled={settingsSaving}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                    cleanupEnabled
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                      : "bg-slate-500/20 text-slate-400 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  {cleanupEnabled ? "ON" : "OFF"}
                </button>
              </div>

              {/* Months Threshold */}
              {cleanupEnabled && (
                <div className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="text-sm font-medium text-white">Retention Period</p>
                      <p className="text-[11px] text-slate-400">
                        Data older than <span className="text-amber-300 font-semibold">{cleanupMonths} month{cleanupMonths !== 1 ? "s" : ""}</span> will be permanently deleted
                      </p>
                    </div>
                  </div>
                  <select
                    value={cleanupMonths}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCleanupMonths(val);
                      saveSetting("cleanup_months", String(val));
                    }}
                    disabled={settingsSaving}
                    className="bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
                  >
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m} className="bg-[#1a1a3e] text-white">
                        {m} month{m !== 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {settingsMsg && (
                <p className={`text-xs font-medium px-1 ${settingsMsg.startsWith("✅") ? "text-emerald-400" : "text-red-400"}`}>
                  {settingsMsg}
                </p>
              )}

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-xs text-amber-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  Only Platform Admins can change cleanup policy. Officers can view but not modify.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Account Security ===== */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Change Email */}
        <div className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 p-6 rounded-2xl shadow-xl shadow-black/20">
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            📧 Configuration Email
          </h2>
          <p className="text-xs text-slate-400 mb-5">Ensure this is an active, secure email.</p>
          
          <form onSubmit={handleEmailChange} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">New Email Address</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all placeholder-gray-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Current Password</label>
              <input
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all placeholder-gray-500"
                required
                placeholder="Required to confirm identity"
              />
            </div>
            {emailError && <p className="text-red-400 text-xs font-medium">❌ {emailError}</p>}
            {emailMsg && <p className="text-emerald-400 text-xs font-medium">✅ {emailMsg}</p>}
            <button
              type="submit"
              disabled={emailLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50"
            >
              {emailLoading ? "Updating..." : "Update Email"}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 p-6 rounded-2xl shadow-xl shadow-black/20">
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            🔒 Account Security
          </h2>
          <p className="text-xs text-slate-400 mb-5">Update your password.</p>
          
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all placeholder-gray-500"
                required
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all placeholder-gray-500"
                required
                placeholder="Min. 8 characters"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all placeholder-gray-500"
                required
                placeholder="Re-enter new password"
              />
            </div>
            {passError && <p className="text-red-400 text-xs font-medium">❌ {passError}</p>}
            {passMsg && <p className="text-emerald-400 text-xs font-medium">✅ {passMsg}</p>}
            <button
              type="submit"
              disabled={passLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50"
            >
              {passLoading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
