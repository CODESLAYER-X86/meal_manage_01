"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid
} from "recharts";

interface CostBreakdown {
  name: string;
  value: number;
}

interface DailyTrend {
  day: number;
  cost: number;
}

interface MemberStat {
  id: string;
  name: string;
  totalMeals: number;
  mealCost: number;
  totalDeposit: number;
  netDue: number;
}

export default function AnalysisDashboard() {
  const { status } = useSession();
  const [data, setData] = useState<{ costBreakdown: CostBreakdown[]; dailyTrends: DailyTrend[]; error?: string } | null>(null);
  const [memberStats, setMemberStats] = useState<MemberStat[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Colors for Pie Chart
  const COLORS = ["#8b5cf6", "#ec4899", "#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#6366f1", "#14b8a6"];

  useEffect(() => {
    if (status === "authenticated") {
      const now = new Date();
      Promise.all([
        fetch("/api/analysis").then((r) => r.ok ? r.json() : null),
        fetch(`/api/billing?month=${now.getMonth() + 1}&year=${now.getFullYear()}`).then((r) => r.ok ? r.json() : null)
      ])
        .then(([analysisData, billingData]) => {
          setData(analysisData);
          if (billingData && billingData.members) {
            setMemberStats(billingData.members);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [status]);

  if (loading || status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (data?.error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center text-2xl">
          ⚠️
        </div>
        <div>
          <h2 className="text-xl font-bold text-red-400">Analysis Unavailable</h2>
          <p className="text-sm text-red-400/80 max-w-sm mt-1">{data.error}</p>
        </div>
      </div>
    );
  }

  if (!data && !memberStats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
        <div className="w-16 h-16 bg-white/[0.05] rounded-full flex items-center justify-center">
          📊
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-200">Not Enough Data</h2>
          <p className="text-sm text-slate-400 max-w-sm mt-1">We need more Bazar trips and Meal entries to generate insights.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-1">Data Analysis 📉</h1>
        <p className="text-sm text-slate-400">Discover insights about your mess spending and meal trends for the current month.</p>
      </header>

      <div className="grid lg:grid-cols-2 gap-6">
        
        {/* Cost Breakdown - Pie Chart */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-5 sm:p-6 rounded-2xl shadow-xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-200">Top Expenses This Month</h2>
            <p className="text-xs text-slate-400 mt-1">Breakdown of specific bazar items</p>
          </div>
          <div className="h-[300px] w-full">
            {data?.costBreakdown && data.costBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.costBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="rgba(255,255,255,0.05)"
                  >
                    {data.costBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(val: any) => `৳${Number(val).toLocaleString()}`}
                    contentStyle={{ backgroundColor: "#1e1e2d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    iconType="circle"
                    wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-slate-500">No bazar recorded this month.</div>
            )}
          </div>
        </div>

        {/* Meal Distribution per Person - Pie Chart */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-5 sm:p-6 rounded-2xl shadow-xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-200">Meal Distribution per Person</h2>
            <p className="text-xs text-slate-400 mt-1">Share of total meals eaten</p>
          </div>
          <div className="h-[300px] w-full">
            {memberStats && memberStats.some(m => m.totalMeals > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={memberStats.filter(m => m.totalMeals > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius={100}
                    dataKey="totalMeals"
                    nameKey="name"
                    stroke="rgba(255,255,255,0.05)"
                  >
                    {memberStats.filter(m => m.totalMeals > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(val: any) => [`${val} meals`, "Total Meals"]}
                    contentStyle={{ backgroundColor: "#1e1e2d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    iconType="circle"
                    wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-slate-500">No meals recorded this month.</div>
            )}
          </div>
        </div>

      </div>

      <div className="grid lg:grid-cols-2 gap-6">

        {/* Daily Expense Trend - Line Chart */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-5 sm:p-6 rounded-2xl shadow-xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-200">Daily Expense Trend</h2>
            <p className="text-xs text-slate-400 mt-1">Bazar costs per day</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.dailyTrends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="day" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `৳${v}`} />
                <RechartsTooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(val: any) => [`৳${Number(val)}`, "Cost"]}
                  labelFormatter={(val) => `Day ${val}`}
                  contentStyle={{ backgroundColor: "#1e1e2d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="cost" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: "#3b82f6", strokeWidth: 2, stroke: "#1e1e2d" }} 
                  activeDot={{ r: 6, fill: "#60a5fa" }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Total Deposits vs Individual Costs - Bar Chart */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-5 sm:p-6 rounded-2xl shadow-xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-200">Total Deposits vs Individual Costs</h2>
            <p className="text-xs text-slate-400 mt-1">Comparison per member</p>
          </div>
          <div className="h-[300px] w-full">
            {memberStats && memberStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={memberStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `৳${v/1000}k`} />
                  <RechartsTooltip
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    contentStyle={{ backgroundColor: "#1e1e2d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                  <Bar dataKey="mealCost" name="Cost" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalDeposit" name="Deposits" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-slate-500">No member data available.</div>
            )}
          </div>
        </div>

      </div>
      
    </div>
  );
}
