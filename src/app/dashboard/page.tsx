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

interface MealPlan {
  id: string;
  date: string;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  author: { id: string; name: string };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [bill, setBill] = useState<BillData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [todayMenu, setTodayMenu] = useState<MealPlan | null>(null);
  const [tomorrowMenu, setTomorrowMenu] = useState<MealPlan | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dueThreshold, setDueThreshold] = useState(500);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const tmrw = new Date(now);
      tmrw.setDate(tmrw.getDate() + 1);
      const tmrwStr = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, "0")}-${String(tmrw.getDate()).padStart(2, "0")}`;

      Promise.all([
        fetch(`/api/billing?month=${now.getMonth() + 1}&year=${now.getFullYear()}`).then((r) => r.json()),
        fetch("/api/audit-log?limit=10").then((r) => r.json()),
        fetch(`/api/meal-plan?date=${todayStr}`).then((r) => r.json()),
        fetch(`/api/meal-plan?date=${tmrwStr}`).then((r) => r.json()),
        fetch("/api/announcements?limit=3").then((r) => r.json()),
        fetch("/api/mess").then((r) => r.json()).catch(() => null),
      ]).then(([billData, logs, todayPlan, tmrwPlan, announcementsData, messData]) => {
        setBill(billData);
        setAuditLogs(logs);
        setTodayMenu(todayPlan && todayPlan.id ? todayPlan : null);
        setTomorrowMenu(tmrwPlan && tmrwPlan.id ? tmrwPlan : null);
        setAnnouncements(Array.isArray(announcementsData) ? announcementsData : []);
        if (messData?.mess?.dueThreshold) setDueThreshold(messData.mess.dueThreshold);
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
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
          <p className={`text-lg sm:text-2xl font-bold truncate ${(myBill?.netDue || 0) > 0 ? "text-red-600" : "text-green-600"}`}>
            {(myBill?.netDue || 0) > 0 ? `৳${myBill?.netDue} owed` : `৳${Math.abs(myBill?.netDue || 0)} refund`}
          </p>
        </div>
      </div>

      {/* Today's & Tomorrow's Menu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Today */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-indigo-100">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📅</span>
            <h2 className="text-base font-semibold text-gray-800">Today&apos;s Menu</h2>
          </div>
          {todayMenu && (todayMenu.breakfast || todayMenu.lunch || todayMenu.dinner) ? (
            <div className="space-y-2">
              {todayMenu.breakfast && (
                <div className="flex items-start gap-2">
                  <span>🌅</span>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Breakfast</p>
                    <p className="text-sm text-gray-800">{todayMenu.breakfast}</p>
                  </div>
                </div>
              )}
              {todayMenu.lunch && (
                <div className="flex items-start gap-2">
                  <span>☀️</span>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Lunch</p>
                    <p className="text-sm text-gray-800">{todayMenu.lunch}</p>
                  </div>
                </div>
              )}
              {todayMenu.dinner && (
                <div className="flex items-start gap-2">
                  <span>🌙</span>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Dinner</p>
                    <p className="text-sm text-gray-800">{todayMenu.dinner}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No menu planned for today</p>
          )}
        </div>
        {/* Tomorrow */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🔮</span>
            <h2 className="text-base font-semibold text-gray-800">Tomorrow&apos;s Menu</h2>
          </div>
          {tomorrowMenu && (tomorrowMenu.breakfast || tomorrowMenu.lunch || tomorrowMenu.dinner) ? (
            <div className="space-y-2">
              {tomorrowMenu.breakfast && (
                <div className="flex items-start gap-2">
                  <span>🌅</span>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Breakfast</p>
                    <p className="text-sm text-gray-800">{tomorrowMenu.breakfast}</p>
                  </div>
                </div>
              )}
              {tomorrowMenu.lunch && (
                <div className="flex items-start gap-2">
                  <span>☀️</span>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Lunch</p>
                    <p className="text-sm text-gray-800">{tomorrowMenu.lunch}</p>
                  </div>
                </div>
              )}
              {tomorrowMenu.dinner && (
                <div className="flex items-start gap-2">
                  <span>🌙</span>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Dinner</p>
                    <p className="text-sm text-gray-800">{tomorrowMenu.dinner}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No menu planned for tomorrow</p>
          )}
        </div>
      </div>

      {/* Quick Actions — for everyone */}
      <div className="bg-orange-50 p-5 rounded-xl border border-orange-100">
        <h2 className="text-lg font-semibold text-orange-800 mb-3">🛒 Bazar</h2>
        <Link href="/bazar" className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition inline-block">
          🛒 Add Bazar Entry
        </Link>
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
            <Link href="/manager/members" className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition">
              👥 Members
            </Link>
            <Link href="/manager/handover" className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition">
              🔄 Hand Over
            </Link>
          </div>
        </div>
      )}

      {/* Deposit Reminder Alert */}
      {myBill && myBill.netDue > dueThreshold && (
        <div className="bg-red-50 p-4 rounded-xl border border-red-200">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔔</span>
            <div>
              <h3 className="text-base font-semibold text-red-800">Deposit Reminder</h3>
              <p className="text-sm text-red-700 mt-0.5">
                You owe <strong>৳{myBill.netDue}</strong> which exceeds the threshold of ৳{dueThreshold}.
                Please deposit soon to stay current.
              </p>
              <Link href="/billing" className="inline-block mt-2 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition">
                View Billing →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Quick Duty & Bill Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/bills" className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-center hover:bg-rose-100 transition">
          <span className="text-xl">💳</span>
          <p className="text-xs font-medium text-rose-700 mt-1">Bills & Rent</p>
        </Link>
        <Link href="/bazar" className="bg-cyan-50 border border-cyan-200 p-3 rounded-xl text-center hover:bg-cyan-100 transition">
          <span className="text-xl">🛒</span>
          <p className="text-xs font-medium text-cyan-700 mt-1">Bazar Trips</p>
        </Link>
        <Link href="/duty-debts" className="bg-pink-50 border border-pink-200 p-3 rounded-xl text-center hover:bg-pink-100 transition">
          <span className="text-xl">⚖️</span>
          <p className="text-xs font-medium text-pink-700 mt-1">Duty Debts</p>
        </Link>
        <Link href="/transparency" className="bg-purple-50 border border-purple-200 p-3 rounded-xl text-center hover:bg-purple-100 transition">
          <span className="text-xl">👁️</span>
          <p className="text-xs font-medium text-purple-700 mt-1">Transparency</p>
        </Link>
      </div>

      {/* Latest Announcements */}
      {announcements.length > 0 && (
        <div className="bg-white p-5 rounded-xl shadow-sm border">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-800">📢 Announcements</h2>
            <Link href="/announcements" className="text-sm text-indigo-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {announcements.slice(0, 3).map((a) => (
              <div key={a.id} className={`p-3 rounded-lg border ${a.pinned ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100"}`}>
                <div className="flex items-center gap-2">
                  {a.pinned && <span className="text-xs">📌</span>}
                  <p className="text-sm font-medium text-gray-800">{a.title}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.body}</p>
                <p className="text-xs text-gray-400 mt-1">— {a.author.name}</p>
              </div>
            ))}
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
              <div key={m.id} className="flex justify-between gap-2">
                <span className="text-gray-600 truncate">{m.name}</span>
                <span className="font-medium whitespace-nowrap text-xs sm:text-sm">{m.totalMeals} meals · ৳{m.mealCost}</span>
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
