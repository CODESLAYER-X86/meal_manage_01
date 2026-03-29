"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { BarChart3, TrendingUp, ShoppingCart, Users, Loader2, PieChart as PieIcon } from "lucide-react";

const COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899", "#3b82f6", "#ef4444", "#14b8a6"];

interface AnalyticsData {
  mealTrend: { date: string; totalMeals: number; entries: number }[];
  categorySpending: { category: string; totalSpent: number; itemCount: number }[];
  topPurchasedItems: { item: string; totalSpent: number; purchaseCount: number }[];
  messComparison: { name: string; members: number; totalMeals: number; totalDeposits: number; totalBazar: number; mealRate: number }[];
  memberActivity: { active: number; away: number };
  spendingTrend: { month: string; total: number }[];
  totals: { users: number; messes: number; mealEntries: number; deposits: number };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
          <p className="text-cyan-400 text-sm">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center max-w-sm">
          <p className="text-red-300 font-medium">Failed to load analytics</p>
          <p className="text-red-400/60 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const activityData = [
    { name: "Active", value: data.memberActivity.active },
    { name: "Away", value: data.memberActivity.away },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/20 via-indigo-600/10 to-purple-600/20 border border-violet-500/10 p-6 sm:p-8">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Cross-Mess Analytics</h1>
            <p className="text-slate-400 text-sm">Aggregated insights across all messes on the platform</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: data.totals.users, color: "text-blue-400" },
          { label: "Total Messes", value: data.totals.messes, color: "text-emerald-400" },
          { label: "Meal Entries", value: data.totals.mealEntries.toLocaleString(), color: "text-amber-400" },
          { label: "Total Deposits", value: `৳${data.totals.deposits.toLocaleString()}`, color: "text-cyan-400" },
        ].map((c) => (
          <div key={c.label} className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl p-4">
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Meal Consumption Trend */}
        <div className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Daily Meal Consumption (30 days)</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.mealTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e1e42", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }}
                labelStyle={{ color: "#94a3b8" }}
              />
              <Line type="monotone" dataKey="totalMeals" stroke="#06b6d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Spending Trend */}
        <div className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Monthly Bazar Spending</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.spendingTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e1e42", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }}
                formatter={(value: unknown) => [`৳${Number(value).toLocaleString()}`, "Spent"]}
              />
              <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Spending Pie */}
        <div className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieIcon className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Spending by Category</h3>
          </div>
          {data.categorySpending.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.categorySpending}
                  dataKey="totalSpent"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  strokeWidth={0}
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`}
                >
                  {data.categorySpending.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e1e42", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }}
                  formatter={(value: unknown) => [`৳${Number(value).toLocaleString()}`, "Spent"]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-slate-500 text-sm">No category data yet</div>
          )}
        </div>

        {/* Top Items */}
        <div className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Top Purchased Items</h3>
          </div>
          {data.topPurchasedItems.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.topPurchasedItems.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} />
                <YAxis type="category" dataKey="item" tick={{ fill: "#94a3b8", fontSize: 10 }} width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e1e42", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }}
                />
                <Bar dataKey="purchaseCount" fill="#f59e0b" radius={[0, 6, 6, 0]} name="Times Purchased" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-slate-500 text-sm">No item data yet</div>
          )}
        </div>

        {/* Mess Comparison - Meal Rate */}
        <div className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-pink-400" />
            <h3 className="text-sm font-semibold text-white">Meal Rate by Mess (৳/meal)</h3>
          </div>
          {data.messComparison.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.messComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e1e42", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }}
                  formatter={(value: unknown) => [`৳${Number(value)}`, "Meal Rate"]}
                />
                <Bar dataKey="mealRate" fill="#ec4899" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-slate-500 text-sm">No mess data yet</div>
          )}
        </div>

        {/* Member Activity */}
        <div className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Member Activity</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={activityData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={50}
                strokeWidth={0}
                label={({ name, value }) => `${name}: ${value}`}
              >
                <Cell fill="#10b981" />
                <Cell fill="#64748b" />
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "#1e1e42", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Mess Comparison Table */}
      {data.messComparison.length > 0 && (
        <div className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Mess-by-Mess Comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-slate-400 font-semibold">Mess</th>
                  <th className="px-4 py-3 text-right text-slate-400 font-semibold">Members</th>
                  <th className="px-4 py-3 text-right text-slate-400 font-semibold">Total Meals</th>
                  <th className="px-4 py-3 text-right text-slate-400 font-semibold">Deposits</th>
                  <th className="px-4 py-3 text-right text-slate-400 font-semibold">Bazar Spent</th>
                  <th className="px-4 py-3 text-right text-slate-400 font-semibold">Meal Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {data.messComparison.map((m) => (
                  <tr key={m.name} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white font-medium">{m.name}</td>
                    <td className="px-4 py-3 text-slate-300 text-right">{m.members}</td>
                    <td className="px-4 py-3 text-slate-300 text-right">{m.totalMeals.toLocaleString()}</td>
                    <td className="px-4 py-3 text-emerald-400 text-right">৳{m.totalDeposits.toLocaleString()}</td>
                    <td className="px-4 py-3 text-amber-400 text-right">৳{m.totalBazar.toLocaleString()}</td>
                    <td className="px-4 py-3 text-cyan-400 text-right font-semibold">৳{m.mealRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
