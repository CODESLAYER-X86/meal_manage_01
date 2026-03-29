"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft, Users, Utensils, Wallet, ShoppingCart, Settings, Activity,
  Loader2, Crown, User, Phone, Mail, Calendar, AlertTriangle,
} from "lucide-react";

interface MessDetail {
  mess: {
    id: string;
    name: string;
    inviteCode: string;
    createdBy: { name: string; email: string };
    createdAt: string;
    settings: Record<string, unknown>;
  };
  members: { id: string; name: string; email: string; phone: string; role: string; isActive: boolean; joinDate: string }[];
  stats: { totalMealsThisMonth: number; totalDepositsThisMonth: number; totalBazarThisMonth: number; mealRate: number; memberCount: number };
  recentMeals: { date: string; member: string; breakfast: number; lunch: number; dinner: number; total: number }[];
  recentDeposits: { date: string; member: string; amount: number; note: string | null }[];
  recentBazar: { date: string; buyer: string; totalCost: number; itemCount: number; items: { name: string; quantity: number; unit: string; price: number }[] }[];
  recentActivity: { action: string; table: string; field: string; oldValue: string | null; newValue: string | null; editedBy: string; createdAt: string }[];
}

export default function MessDetailPage({ params }: { params: Promise<{ messId: string }> }) {
  const { messId } = use(params);
  const [data, setData] = useState<MessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"members" | "meals" | "deposits" | "bazar" | "activity" | "settings">("members");

  useEffect(() => {
    fetch(`/api/admin/messes/${messId}/detail`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [messId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center max-w-sm">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-300 font-medium">Failed to load mess</p>
          <p className="text-red-400/60 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const { mess, members, stats } = data;
  const tabs = [
    { key: "members", label: "Members", icon: Users, count: stats.memberCount },
    { key: "meals", label: "Meals", icon: Utensils, count: data.recentMeals.length },
    { key: "deposits", label: "Deposits", icon: Wallet, count: data.recentDeposits.length },
    { key: "bazar", label: "Bazar", icon: ShoppingCart, count: data.recentBazar.length },
    { key: "activity", label: "Activity", icon: Activity, count: data.recentActivity.length },
    { key: "settings", label: "Settings", icon: Settings },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <Link href="/admin/messes" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Messes
      </Link>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600/20 via-violet-600/10 to-purple-600/20 border border-indigo-500/10 p-6 sm:p-8">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="relative">
          <h1 className="text-2xl font-bold text-white">{mess.name}</h1>
          <p className="text-slate-400 text-sm mt-1">
            Created by {mess.createdBy.name} · Code: <span className="font-mono text-indigo-300">{mess.inviteCode}</span>
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Members", value: stats.memberCount, color: "text-blue-400" },
          { label: "Meals (Month)", value: stats.totalMealsThisMonth, color: "text-amber-400" },
          { label: "Deposits (Month)", value: `৳${stats.totalDepositsThisMonth.toLocaleString()}`, color: "text-emerald-400" },
          { label: "Bazar (Month)", value: `৳${stats.totalBazarThisMonth.toLocaleString()}`, color: "text-pink-400" },
          { label: "Meal Rate", value: `৳${stats.mealRate}`, color: "text-cyan-400" },
        ].map((c) => (
          <div key={c.label} className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl p-4">
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              tab === t.key
                ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                : "bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {"count" in t && t.count !== undefined && (
              <span className="ml-1 px-1.5 py-0.5 bg-white/10 rounded text-[10px]">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl overflow-hidden">
        {tab === "members" && (
          <div className="divide-y divide-white/[0.03]">
            {members.map((m) => (
              <div key={m.id} className="px-5 py-4 flex items-center gap-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                  m.role === "MANAGER" ? "bg-gradient-to-br from-violet-500 to-pink-500 text-white" : "bg-white/10 text-slate-400"
                }`}>
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{m.name}</p>
                    {m.role === "MANAGER" && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                    {!m.isActive && <span className="px-1.5 py-0.5 text-[9px] bg-red-500/20 text-red-300 rounded">Inactive</span>}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{m.email}</span>
                    {m.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{m.phone}</span>}
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{m.joinDate.split("T")[0]}</span>
                  </div>
                </div>
              </div>
            ))}
            {members.length === 0 && <div className="p-8 text-center text-slate-500 text-sm">No members</div>}
          </div>
        )}

        {tab === "meals" && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-white/5">
                <th className="px-4 py-3 text-left text-slate-400">Date</th>
                <th className="px-4 py-3 text-left text-slate-400">Member</th>
                <th className="px-4 py-3 text-right text-slate-400">Breakfast</th>
                <th className="px-4 py-3 text-right text-slate-400">Lunch</th>
                <th className="px-4 py-3 text-right text-slate-400">Dinner</th>
                <th className="px-4 py-3 text-right text-slate-400">Total</th>
              </tr></thead>
              <tbody className="divide-y divide-white/[0.03]">
                {data.recentMeals.map((m, i) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-slate-300">{m.date}</td>
                    <td className="px-4 py-2.5 text-white">{m.member}</td>
                    <td className="px-4 py-2.5 text-slate-300 text-right">{m.breakfast}</td>
                    <td className="px-4 py-2.5 text-slate-300 text-right">{m.lunch}</td>
                    <td className="px-4 py-2.5 text-slate-300 text-right">{m.dinner}</td>
                    <td className="px-4 py-2.5 text-cyan-400 text-right font-semibold">{m.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.recentMeals.length === 0 && <div className="p-8 text-center text-slate-500 text-sm">No meal entries this month</div>}
          </div>
        )}

        {tab === "deposits" && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-white/5">
                <th className="px-4 py-3 text-left text-slate-400">Date</th>
                <th className="px-4 py-3 text-left text-slate-400">Member</th>
                <th className="px-4 py-3 text-right text-slate-400">Amount</th>
                <th className="px-4 py-3 text-left text-slate-400">Note</th>
              </tr></thead>
              <tbody className="divide-y divide-white/[0.03]">
                {data.recentDeposits.map((d, i) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-slate-300">{d.date}</td>
                    <td className="px-4 py-2.5 text-white">{d.member}</td>
                    <td className="px-4 py-2.5 text-emerald-400 text-right font-semibold">৳{d.amount}</td>
                    <td className="px-4 py-2.5 text-slate-400">{d.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.recentDeposits.length === 0 && <div className="p-8 text-center text-slate-500 text-sm">No deposits this month</div>}
          </div>
        )}

        {tab === "bazar" && (
          <div className="divide-y divide-white/[0.03]">
            {data.recentBazar.map((t, i) => (
              <div key={i} className="px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-white">{t.date} — {t.buyer}</p>
                    <p className="text-[11px] text-slate-500">{t.itemCount} items</p>
                  </div>
                  <p className="text-sm font-bold text-amber-400">৳{t.totalCost}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {t.items.map((item, j) => (
                    <span key={j} className="px-2 py-0.5 bg-white/5 rounded-md text-[10px] text-slate-400">
                      {item.name} ({item.quantity} {item.unit}) ৳{item.price}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {data.recentBazar.length === 0 && <div className="p-8 text-center text-slate-500 text-sm">No bazar trips this month</div>}
          </div>
        )}

        {tab === "activity" && (
          <div className="divide-y divide-white/[0.03]">
            {data.recentActivity.map((a, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 shrink-0" />
                <div>
                  <p className="text-xs text-white">
                    <span className="font-medium">{a.editedBy}</span>{" "}
                    <span className="text-slate-400">{a.action}</span>{" "}
                    <span className="text-violet-300">{a.table}.{a.field}</span>
                  </p>
                  {(a.oldValue || a.newValue) && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {a.oldValue && <span className="line-through text-red-400/60 mr-2">{a.oldValue?.substring(0, 50)}</span>}
                      {a.newValue && <span className="text-green-400/60">{a.newValue?.substring(0, 50)}</span>}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-600 mt-0.5">{new Date(a.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {data.recentActivity.length === 0 && <div className="p-8 text-center text-slate-500 text-sm">No audit activity</div>}
          </div>
        )}

        {tab === "settings" && (
          <div className="p-5 space-y-3">
            {Object.entries(mess.settings).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                <span className="text-xs text-slate-400 font-medium">{key}</span>
                <span className="text-xs text-white font-mono bg-white/5 px-2 py-0.5 rounded">
                  {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
