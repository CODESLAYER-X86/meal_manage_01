"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

interface AuditEntry {
  id: string;
  tableName: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  action: string;
  createdAt: string;
  editedBy: { name: string };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [bill, setBill] = useState<BillData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      const now = new Date();
      Promise.all([
        fetch(`/api/billing?month=${now.getMonth() + 1}&year=${now.getFullYear()}`).then((r) => r.json()),
        fetch("/api/audit-log?limit=10").then((r) => r.json()),
      ]).then(([billData, logs]) => {
        setBill(billData);
        setAuditLogs(logs);
        setLoading(false);
      });
    }
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const isManager = session.user?.role === "MANAGER";
  const myBill = bill?.members.find((m) => m.id === session.user?.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <span className="text-sm text-gray-500">
          {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
      </div>

      {/* My Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">My Meals</p>
          <p className="text-2xl font-bold text-gray-800">{myBill?.totalMeals || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">My Deposit</p>
          <p className="text-2xl font-bold text-green-600">৳{myBill?.totalDeposit || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">Meal Rate</p>
          <p className="text-2xl font-bold text-indigo-600">৳{bill?.mealRate || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">My Net Due</p>
          <p className={`text-2xl font-bold ${(myBill?.netDue || 0) > 0 ? "text-red-600" : "text-green-600"}`}>
            {(myBill?.netDue || 0) > 0 ? `৳${myBill?.netDue} owed` : `৳${Math.abs(myBill?.netDue || 0)} refund`}
          </p>
        </div>
      </div>

      {/* Manager Quick Actions */}
      {isManager && (
        <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100">
          <h2 className="text-lg font-semibold text-indigo-800 mb-3">⚡ Manager Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/manager/meals" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
              ✏️ Enter Meals
            </Link>
            <Link href="/manager/deposits" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">
              💰 Record Deposit
            </Link>
            <Link href="/manager/bazar" className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition">
              🛒 Add Bazar Entry
            </Link>
            <Link href="/manager/members" className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition">
              👥 Members
            </Link>
            <Link href="/manager/handover" className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition">
              🔄 Hand Over
            </Link>
          </div>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* All Members Summary */}
        <div className="bg-white p-5 rounded-xl shadow-sm border">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">📊 This Month Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Total Expense</span>
              <span className="font-medium">৳{bill?.totalExpense || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Meals</span>
              <span className="font-medium">{bill?.totalMeals || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Meal Rate</span>
              <span className="font-medium text-indigo-600">৳{bill?.mealRate || 0}/meal</span>
            </div>
            <hr className="my-2" />
            {bill?.members.map((m) => (
              <div key={m.id} className="flex justify-between">
                <span className="text-gray-600">{m.name}</span>
                <span className="font-medium">{m.totalMeals} meals — ৳{m.mealCost}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Audit Log */}
        <div className="bg-white p-5 rounded-xl shadow-sm border">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-800">🔍 Recent Changes</h2>
            <Link href="/audit-log" className="text-sm text-indigo-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <p className="text-gray-400">No changes recorded yet</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-2 bg-gray-50 rounded-lg">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">{log.fieldName}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-600">
                    {log.action === "UPDATE" ? (
                      <>
                        <span className="text-red-500 line-through">{log.oldValue}</span> →{" "}
                        <span className="text-green-600">{log.newValue}</span>
                        <span className="text-gray-400 text-xs ml-1">(by {log.editedBy.name})</span>
                      </>
                    ) : (
                      <>
                        {log.action}: {log.newValue}
                        <span className="text-gray-400 text-xs ml-1">(by {log.editedBy.name})</span>
                      </>
                    )}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
