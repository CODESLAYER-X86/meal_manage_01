"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface BillData {
  totalExpense: number;
  totalMeals: number;
  mealRate: number;
  members: {
    id: string;
    name: string;
    totalMeals: number;
    mealCost: number;
    totalDeposit: number;
    netDue: number;
  }[];
}

export default function BillingPage() {
  const { status } = useSession();
  const router = useRouter();
  const [bill, setBill] = useState<BillData | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      setLoading(true);
      fetch(`/api/billing?month=${month}&year=${year}`)
        .then((r) => r.json())
        .then((data) => {
          setBill(data);
          setLoading(false);
        });
    }
  }, [status, month, year]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const monthName = new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">📊 Monthly Bill</h1>

      {/* Month Selector */}
      <div className="bg-white p-4 rounded-xl shadow-sm border space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(year, i).toLocaleDateString("en-US", { month: "long" })}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/export?month=${month}&year=${year}`}
            download
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            📤 Export CSV
          </a>
          <a
            href={`/api/archive/export?month=${month}&year=${year}`}
            download
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            📦 Archive .messmate
          </a>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border text-center">
          <p className="text-sm text-gray-500">Total Expense</p>
          <p className="text-xl sm:text-2xl font-bold text-red-600">৳{bill?.totalExpense || 0}</p>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border text-center">
          <p className="text-sm text-gray-500">Total Meals</p>
          <p className="text-xl sm:text-2xl font-bold text-indigo-600">{bill?.totalMeals || 0}</p>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border text-center">
          <p className="text-sm text-gray-500">Meal Rate</p>
          <p className="text-xl sm:text-2xl font-bold text-indigo-600">৳{bill?.mealRate || 0}</p>
          <p className="text-xs text-gray-400">per meal</p>
        </div>
      </div>

      {/* Expense Chart — Visual Bar Comparison */}
      {bill && bill.members.length > 0 && (
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">📊 Member Expense Comparison</h2>
          <div className="space-y-3">
            {bill.members.map((m) => {
              const maxCost = Math.max(...bill.members.map((x) => x.mealCost), 1);
              const costPct = (m.mealCost / maxCost) * 100;
              const maxDeposit = Math.max(...bill.members.map((x) => x.totalDeposit), 1);
              const depositPct = (m.totalDeposit / maxDeposit) * 100;
              return (
                <div key={m.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 truncate">{m.name}</span>
                    <span className={`text-xs font-medium ${m.netDue > 0 ? "text-red-600" : "text-green-600"}`}>
                      {m.netDue > 0 ? `৳${m.netDue} owed` : `৳${Math.abs(m.netDue)} refund`}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-12">Cost</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3">
                        <div
                          className="bg-red-400 h-3 rounded-full transition-all"
                          style={{ width: `${costPct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-14 text-right">৳{m.mealCost}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-12">Deposit</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3">
                        <div
                          className="bg-green-400 h-3 rounded-full transition-all"
                          style={{ width: `${depositPct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-14 text-right">৳{m.totalDeposit}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-4 text-xs text-gray-400">
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-400 rounded-full" /> Meal Cost</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-400 rounded-full" /> Deposited</div>
          </div>
        </div>
      )}

      {/* Bill Breakdown Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <h2 className="p-4 text-lg font-semibold text-gray-800 border-b">
          📋 {monthName} — Per Member Breakdown
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm min-w-[500px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 sm:p-4">Member</th>
                <th className="text-center p-2 sm:p-4">Total Meals</th>
                <th className="text-right p-2 sm:p-4">Meal Cost</th>
                <th className="text-right p-2 sm:p-4">Deposited</th>
                <th className="text-right p-2 sm:p-4">Net Due</th>
                <th className="text-center p-2 sm:p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {bill?.members.map((m) => (
                <tr key={m.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 sm:p-4 font-medium">{m.name}</td>
                  <td className="p-2 sm:p-4 text-center">{m.totalMeals}</td>
                  <td className="p-2 sm:p-4 text-right">৳{m.mealCost}</td>
                  <td className="p-2 sm:p-4 text-right text-green-600">৳{m.totalDeposit}</td>
                  <td className={`p-2 sm:p-4 text-right font-bold ${m.netDue > 0 ? "text-red-600" : "text-green-600"}`}>
                    {m.netDue > 0 ? `৳${m.netDue}` : `-৳${Math.abs(m.netDue)}`}
                  </td>
                  <td className="p-2 sm:p-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.netDue > 0
                        ? "bg-red-100 text-red-700"
                        : m.netDue < 0
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {m.netDue > 0 ? "Owes" : m.netDue < 0 ? "Refund" : "Settled"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-bold">
              <tr className="border-t">
                <td className="p-2 sm:p-4">Total</td>
                <td className="p-2 sm:p-4 text-center">{bill?.totalMeals}</td>
                <td className="p-2 sm:p-4 text-right">৳{bill?.totalExpense}</td>
                <td className="p-2 sm:p-4 text-right text-green-600">
                  ৳{bill?.members.reduce((sum, m) => sum + m.totalDeposit, 0)}
                </td>
                <td className="p-2 sm:p-4 text-right">
                  ৳{bill?.members.reduce((sum, m) => sum + m.netDue, 0).toFixed(2)}
                </td>
                <td className="p-2 sm:p-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Formula Explanation */}
      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
        <p className="font-semibold mb-1">📐 How it&apos;s calculated:</p>
        <p>Meal Rate = Total Expense ÷ Total Meals = ৳{bill?.totalExpense} ÷ {bill?.totalMeals} = <strong>৳{bill?.mealRate}/meal</strong></p>
        <p>Your Cost = Your Meals × Meal Rate</p>
        <p>Net Due = Your Cost − Your Deposit (positive = you owe, negative = refund)</p>
      </div>
    </div>
  );
}
