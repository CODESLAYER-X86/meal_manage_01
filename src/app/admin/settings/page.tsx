"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminSettingsPage() {
  const { status } = useSession();
  const router = useRouter();

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

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Admin Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">Manage your Super Admin credentials</p>
      </div>

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
          <p className="text-xs text-slate-400 mb-5">Update your super admin password.</p>
          
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
