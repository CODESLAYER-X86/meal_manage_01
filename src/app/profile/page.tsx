"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Profile data
  const [profile, setProfile] = useState<{ name: string; email: string; phone: string; role: string } | null>(null);

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
          setProfile(data);
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

    if (newPassword.length < 4) {
      setPassError("Password must be at least 4 characters");
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

  if (status === "loading" || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100">⚙️ My Profile</h1>

      {/* Profile Info Card */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 rounded-xl shadow-md shadow-black/10 border">
        <h2 className="text-lg font-semibold text-slate-300 mb-4">Profile Info</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Name</p>
            <p className="font-medium text-slate-100">{profile.name}</p>
          </div>
          <div>
            <p className="text-slate-500">Email</p>
            <p className="font-medium text-slate-100">{profile.email}</p>
          </div>
          <div>
            <p className="text-slate-500">Phone</p>
            <p className="font-medium text-slate-100">{profile.phone || "Not set"}</p>
          </div>
          <div>
            <p className="text-slate-500">Role</p>
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
              profile.role === "MANAGER"
                ? "bg-indigo-100 text-indigo-700"
                : "bg-gray-100 text-slate-400"
            }`}>
              {profile.role}
            </span>
          </div>
        </div>
      </div>

      {/* Change Email */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 rounded-xl shadow-md shadow-black/10 border">
        <h2 className="text-lg font-semibold text-slate-300 mb-4">📧 Change Email</h2>
        <form onSubmit={handleEmailChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">New Email</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Current Password (to confirm)</label>
            <input
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              placeholder="Enter your current password"
            />
          </div>
          {emailError && <p className="text-red-600 text-sm">❌ {emailError}</p>}
          {emailMsg && <p className="text-green-600 text-sm">✅ {emailMsg}</p>}
          <button
            type="submit"
            disabled={emailLoading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {emailLoading ? "Updating..." : "Update Email"}
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 rounded-xl shadow-md shadow-black/10 border">
        <h2 className="text-lg font-semibold text-slate-300 mb-4">🔒 Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              placeholder="Enter new password (min 4 chars)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              placeholder="Re-enter new password"
            />
          </div>
          {passError && <p className="text-red-600 text-sm">❌ {passError}</p>}
          {passMsg && <p className="text-green-600 text-sm">✅ {passMsg}</p>}
          <button
            type="submit"
            disabled={passLoading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {passLoading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
