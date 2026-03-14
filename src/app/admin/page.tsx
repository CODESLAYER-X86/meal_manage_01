"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  totalUsers: number;
  totalMesses: number;
  activeMesses: number;
  totalMeals: number;
  totalDeposits: number;
  totalBazarTrips: number;
  totalAuditLogs: number;
  recentSignups: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-violet-400 text-sm">Loading stats…</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center max-w-sm">
          <p className="text-red-400 text-4xl mb-3">⚠️</p>
          <p className="text-red-300 font-medium">Failed to load stats</p>
          <p className="text-red-400/60 text-sm mt-1">Check API connection</p>
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Total Users", value: stats.totalUsers, icon: "👤", gradient: "from-blue-500 to-cyan-400", bgGlow: "shadow-blue-500/10" },
    { label: "Total Messes", value: stats.totalMesses, icon: "🏠", gradient: "from-emerald-500 to-green-400", bgGlow: "shadow-emerald-500/10" },
    { label: "Active Messes", value: stats.activeMesses, icon: "✅", gradient: "from-violet-500 to-purple-400", bgGlow: "shadow-violet-500/10" },
    { label: "New Signups (7d)", value: stats.recentSignups, icon: "📈", gradient: "from-pink-500 to-rose-400", bgGlow: "shadow-pink-500/10" },
    { label: "Total Meals", value: stats.totalMeals.toLocaleString(), icon: "🍽️", gradient: "from-orange-500 to-amber-400", bgGlow: "shadow-orange-500/10" },
    { label: "Total Deposits", value: `৳${stats.totalDeposits.toLocaleString()}`, icon: "💰", gradient: "from-yellow-500 to-orange-400", bgGlow: "shadow-yellow-500/10" },
    { label: "Bazar Trips", value: stats.totalBazarTrips, icon: "🛒", gradient: "from-cyan-500 to-teal-400", bgGlow: "shadow-cyan-500/10" },
    { label: "Audit Entries", value: stats.totalAuditLogs.toLocaleString(), icon: "📋", gradient: "from-gray-500 to-slate-400", bgGlow: "shadow-gray-500/10" },
  ];

  const quickLinks = [
    { href: "/admin/messes", label: "Manage Messes", desc: "View, inspect, or delete messes", icon: "🏠" },
    { href: "/admin/users", label: "Manage Users", desc: "Search, activate, deactivate", icon: "👤" },
    { href: "/admin/audit", label: "Audit Log", desc: "Global activity trail", icon: "📋" },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/20 via-indigo-600/10 to-purple-600/20 border border-violet-500/10 p-6 sm:p-8">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="relative">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Admin Overview</h1>
          <p className="text-slate-400 text-sm">Platform health & statistics at a glance</p>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`group relative bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl p-4 sm:p-5 hover:border-white/10 transition-all duration-300 shadow-2xl shadow-black/20 ${c.bgGlow}`}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{c.icon}</span>
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${c.gradient} opacity-20 group-hover:opacity-30 transition-opacity`} />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white mb-0.5">{c.value}</p>
            <p className="text-[11px] sm:text-xs text-slate-400 font-medium">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions + Info */}
      <div className="grid lg:grid-cols-3 gap-4">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl p-5 hover:border-violet-500/20 hover:bg-violet-500/5 transition-all duration-300"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{link.icon}</span>
              <div>
                <h3 className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">{link.label}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{link.desc}</p>
              </div>
              <span className="ml-auto text-slate-400 group-hover:text-violet-400 transition-colors">→</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Admin Info Box */}
      <div className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm">🔐</span>
          <h2 className="text-sm font-semibold text-white">Admin Account</h2>
        </div>
        <div className="space-y-2 text-xs">
          <p className="text-slate-400">
            Login: <span className="text-slate-400 font-mono bg-white/5 px-2 py-0.5 rounded">admin@messmeal.app</span>
          </p>
          <p className="text-slate-400">
            Recovery: POST to <span className="font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">/api/admin/recovery</span> with email + recoveryKey + newPassword
          </p>
        </div>
      </div>
    </div>
  );
}
