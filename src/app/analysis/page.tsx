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

interface MonthlyTrend {
  month: string;
  cost: number;
  meals: number;
  rate: number;
}

export default function AnalysisDashboard() {
  const { status } = useSession();
  const [data, setData] = useState<{ costBreakdown: CostBreakdown[]; monthlyTrends: MonthlyTrend[]; error?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Colors for Pie Chart
  const COLORS = ["#8b5cf6", "#ec4899", "#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#6366f1", "#14b8a6"];

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/analysis")
        .then((res) => res.json())
        .then((d) => {
          setData(d);
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

  if (!data || (!data.costBreakdown?.length && !data.monthlyTrends?.length)) {
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
        <p className="text-sm text-slate-400">Discover insights about your mess spending and meal trends.</p>
      </header>

      <div className="grid lg:grid-cols-2 gap-6">
        
        {/* Cost Breakdown - Pie Chart */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-5 sm:p-6 rounded-2xl shadow-xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-200">Top Expenses This Month</h2>
            <p className="text-xs text-slate-400 mt-1">Breakdown of bazar items</p>
          </div>
          <div className="h-[300px] w-full">
            {data.costBreakdown.length > 0 ? (
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

        {/* Meal Rate Trend - Line Chart */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-5 sm:p-6 rounded-2xl shadow-xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-200">6-Month Meal Rates Trend</h2>
            <p className="text-xs text-slate-400 mt-1">Average per-meal cost history</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `৳${v}`} />
                <RechartsTooltip
                  formatter={(val: any) => [`৳${Number(val)}`, "Meal Rate"]}
                  contentStyle={{ backgroundColor: "#1e1e2d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="rate" 
                  stroke="#8b5cf6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 2, stroke: "#1e1e2d" }} 
                  activeDot={{ r: 6, fill: "#ec4899" }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Aggregate Cost vs Meals - Bar Chart */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-5 sm:p-6 rounded-2xl shadow-xl shadow-black/20">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-200">Monthly Spending Overview</h2>
          <p className="text-xs text-slate-400 mt-1">Total Mess Cost vs Total Meals consumed</p>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.monthlyTrends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="month" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              
              <YAxis yAxisId="left" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `৳${v/1000}k`} />
              <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              
              <RechartsTooltip
                contentStyle={{ backgroundColor: "#1e1e2d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff" }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
              
              <Bar yAxisId="left" dataKey="cost" name="Total Cost (৳)" fill="#ec4899" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar yAxisId="right" dataKey="meals" name="Total Meals" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
    </div>
  );
}
