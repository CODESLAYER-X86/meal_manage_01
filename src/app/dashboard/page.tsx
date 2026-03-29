"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Calendar, Activity, DollarSign, Wallet, Utensils, 
  Coffee, Moon, Clock, CheckCircle, Package, ArrowRight, 
  Users, RefreshCw, Bell, CreditCard, ExternalLink, ShieldCheck, Zap,
  ShoppingCart, Search, ChevronRight, Lock
} from "lucide-react";

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
  meals?: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  author: { id: string; name: string };
}

interface BillPaymentStatus {
  members: { id: string; name: string }[];
  memberBills: Record<string, number>;
  paidAmounts: Record<string, number>;
  confirmedAmounts: Record<string, number>;
}

interface MealStatusData {
  mealsPerDay: number;
  mealsList?: string[];
  members: { id: string; name: string }[];
  statuses: Record<string, Record<string, boolean>>; // memberId -> meal -> isOff
  mealCounts: Record<string, number>; // meal -> count eating
  blackoutStatus: Record<string, boolean>; // meal -> isBlackedOut
  pendingRequests: { id: string; date: string; meal: string; memberId: string; wantOff: boolean; reason: string; status: string }[];
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [bill, setBill] = useState<BillData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [todayMenu, setTodayMenu] = useState<MealPlan | null>(null);
  const [tomorrowMenu, setTomorrowMenu] = useState<MealPlan | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [billPayStatus, setBillPayStatus] = useState<BillPaymentStatus | null>(null);
  const [dueThreshold, setDueThreshold] = useState(500);
  const [loading, setLoading] = useState(true);
  const [mealStatusToday, setMealStatusToday] = useState<MealStatusData | null>(null);
  const [mealStatusTmrw, setMealStatusTmrw] = useState<MealStatusData | null>(null);
  const [mealToggling, setMealToggling] = useState<string | null>(null);
  const [requestingMeal, setRequestingMeal] = useState<string | null>(null);
  const [requestReason, setRequestReason] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [mealTypesList, setMealTypesList] = useState<string[]>(["breakfast", "lunch", "dinner"]);

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
        fetch(`/api/billing?month=${now.getMonth() + 1}&year=${now.getFullYear()}`).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/audit-log?limit=10").then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/meal-plan?date=${todayStr}`).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/meal-plan?date=${tmrwStr}`).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/announcements?limit=3").then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/mess").then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/bill-payments?month=${now.getMonth() + 1}&year=${now.getFullYear()}`).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/meal-status?date=${todayStr}`).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/meal-status?date=${tmrwStr}`).then((r) => r.ok ? r.json() : null).catch(() => null),
      ]).then(([billData, logs, todayPlan, tmrwPlan, announcementsData, messData, billPayData, mealToday, mealTmrw]) => {
        setBill(billData);
        setAuditLogs(Array.isArray(logs) ? logs : []);
        setTodayMenu(todayPlan && todayPlan.id ? todayPlan : null);
        try {
          const mt = JSON.parse(messData?.mess?.mealTypes || '["breakfast","lunch","dinner"]');
          if (Array.isArray(mt) && mt.length > 0) setMealTypesList(mt);
        } catch { /* use default */ }
        setTomorrowMenu(tmrwPlan && tmrwPlan.id ? tmrwPlan : null);
        setAnnouncements(Array.isArray(announcementsData) ? announcementsData : []);
        if (messData?.mess?.dueThreshold !== undefined) setDueThreshold(messData.mess.dueThreshold);
        if (billPayData?.members) setBillPayStatus(billPayData);
        if (mealToday && mealToday.mealsPerDay !== undefined) setMealStatusToday(mealToday);
        if (mealTmrw && mealTmrw.mealsPerDay !== undefined) setMealStatusTmrw(mealTmrw);
        setLoading(false);
      }).catch((err) => {
        console.error("Dashboard data load failed:", err);
        setLoading(false);
      });
    }
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) return null;

  const isManager = session.user?.role === "MANAGER";
  const myBill = bill?.members.find((m) => m.id === session.user?.id);

  const getMealIcon = (mealType: string) => {
    switch (mealType.toLowerCase()) {
      case "breakfast": return <Coffee className="w-4 h-4 text-amber-500" />;
      case "lunch": return <Utensils className="w-4 h-4 text-orange-500" />;
      case "dinner": return <Moon className="w-4 h-4 text-indigo-400" />;
      default: return <Package className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2 pb-4 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Activity className="w-7 h-7 text-indigo-500" /> Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">Metrics, meals, and tasks overview.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400 font-medium bg-[#1a1a3e]/50 px-3 py-1.5 rounded-lg border border-white/10">
          <Calendar className="w-4 h-4 text-indigo-400" />
          {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric", day: "numeric" })}
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1a1a3e]/50 backdrop-blur-sm border border-white/10 p-5 rounded-2xl relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Utensils className="w-12 h-12 text-indigo-400" />
          </div>
          <p className="text-sm font-medium text-slate-400 flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-slate-500" /> My Meals
          </p>
          <p className="text-3xl font-bold text-white tracking-tight">{myBill?.totalMeals || 0}</p>
        </div>
        <div className="bg-[#1a1a3e]/50 backdrop-blur-sm border border-white/10 p-5 rounded-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet className="w-12 h-12 text-emerald-400" />
          </div>
          <p className="text-sm font-medium text-slate-400 flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-slate-500" /> My Deposit
          </p>
          <p className="text-3xl font-bold text-emerald-400 tracking-tight">৳{myBill?.totalDeposit || 0}</p>
        </div>
        <div className="bg-[#1a1a3e]/50 backdrop-blur-sm border border-white/10 p-5 rounded-2xl relative overflow-hidden group hover:border-blue-500/30 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity className="w-12 h-12 text-blue-400" />
          </div>
          <p className="text-sm font-medium text-slate-400 flex items-center gap-2 mb-1">
            <RefreshCw className="w-4 h-4 text-slate-500" /> Meal Rate
          </p>
          <p className="text-3xl font-bold text-blue-400 tracking-tight">৳{bill?.mealRate || 0}</p>
        </div>
        <div className="bg-[#1a1a3e]/50 backdrop-blur-sm border border-white/10 p-5 rounded-2xl relative overflow-hidden group hover:border-rose-500/30 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <CreditCard className="w-12 h-12 text-rose-400" />
          </div>
          <p className="text-sm font-medium text-slate-400 flex items-center gap-2 mb-1">
            <Search className="w-4 h-4 text-slate-500" /> My Net Due
          </p>
          <p className={`text-2xl font-bold tracking-tight truncate ${(myBill?.netDue || 0) > 0 ? "text-rose-400" : "text-emerald-400"}`}>
            {(myBill?.netDue || 0) > 0 ? `৳${myBill?.netDue} owed` : `৳${Math.abs(myBill?.netDue || 0)} refund`}
          </p>
        </div>
      </div>

      {/* Deposit Reminder Alert */}
      {myBill && myBill.netDue > dueThreshold && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl flex items-start gap-4 shadow-lg shadow-rose-500/5">
          <div className="p-2 bg-rose-500/20 rounded-lg shrink-0">
            <Bell className="w-6 h-6 text-rose-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-rose-400">Deposit Threshold Exceeded</h3>
            <p className="text-sm text-rose-200/80 mt-1 leading-relaxed">
              Your current balance is negative <strong className="text-rose-300 font-bold">৳{myBill.netDue}</strong>, exceeding the mess threshold of ৳{dueThreshold}. Please make a deposit.
            </p>
            <Link href="/billing" className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 text-rose-300 text-xs font-semibold rounded-lg hover:bg-rose-500/30 transition">
              Resolve Balance <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Secondary Action Grid / Main Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Menu & Actions */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Today's & Tomorrow's Menu */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#1a1a3e]/50 backdrop-blur-sm border border-white/10 p-5 rounded-2xl flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-indigo-500/20 rounded-lg"><Calendar className="w-4 h-4 text-indigo-400" /></div>
                <h3 className="font-semibold text-white">Today&apos;s Menu</h3>
              </div>
              <div className="flex-1">
                {todayMenu && (todayMenu.breakfast || todayMenu.lunch || todayMenu.dinner || todayMenu.meals) ? (
                  <div className="space-y-3">
                    {(() => {
                      let mealsObj: Record<string, string> = {};
                      try { mealsObj = JSON.parse(todayMenu.meals || "{}"); } catch { /* ignore */ }
                      if (Object.keys(mealsObj).length === 0) {
                        if (todayMenu.breakfast) mealsObj.breakfast = todayMenu.breakfast;
                        if (todayMenu.lunch) mealsObj.lunch = todayMenu.lunch;
                        if (todayMenu.dinner) mealsObj.dinner = todayMenu.dinner;
                      }
                      return mealTypesList.map((mt) => {
                        const val = mealsObj[mt];
                        if (!val) return null;
                        return (
                          <div key={mt} className="flex items-start gap-3">
                            <div className="pt-0.5">{getMealIcon(mt)}</div>
                            <div className="flex-1">
                              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{mt}</p>
                              <p className="text-sm text-slate-200 mt-0.5 leading-snug">{val}</p>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-6">
                    <Package className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-sm text-slate-400">No menu published for today</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-[#1a1a3e]/50 backdrop-blur-sm border border-white/10 p-5 rounded-2xl flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-violet-500/20 rounded-lg"><ArrowRight className="w-4 h-4 text-violet-400" /></div>
                <h3 className="font-semibold text-white">Tomorrow&apos;s Menu</h3>
              </div>
              <div className="flex-1">
                {tomorrowMenu && (tomorrowMenu.breakfast || tomorrowMenu.lunch || tomorrowMenu.dinner || tomorrowMenu.meals) ? (
                  <div className="space-y-3">
                    {(() => {
                      let mealsObj: Record<string, string> = {};
                      try { mealsObj = JSON.parse(tomorrowMenu.meals || "{}"); } catch { /* ignore */ }
                      if (Object.keys(mealsObj).length === 0) {
                        if (tomorrowMenu.breakfast) mealsObj.breakfast = tomorrowMenu.breakfast;
                        if (tomorrowMenu.lunch) mealsObj.lunch = tomorrowMenu.lunch;
                        if (tomorrowMenu.dinner) mealsObj.dinner = tomorrowMenu.dinner;
                      }
                      return mealTypesList.map((mt) => {
                        const val = mealsObj[mt];
                        if (!val) return null;
                        return (
                          <div key={mt} className="flex items-start gap-3">
                            <div className="pt-0.5">{getMealIcon(mt)}</div>
                            <div className="flex-1">
                              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{mt}</p>
                              <p className="text-sm text-slate-200 mt-0.5 leading-snug">{val}</p>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-6">
                    <Package className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-sm text-slate-400">No menu published for tomorrow</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* User Meal Status Toggles */}
          {(mealStatusToday || mealStatusTmrw) && (() => {
            const userId = session.user?.id;
            const isManagerUser = session.user?.role === "MANAGER";
            if (!userId) return null;

            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
            const tmrw = new Date(now);
            tmrw.setDate(tmrw.getDate() + 1);
            const tmrwStr = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, "0")}-${String(tmrw.getDate()).padStart(2, "0")}`;

            const toggleMeal = async (dateStr: string, meal: string) => {
              const key = `${dateStr}-${meal}`;
              setMealToggling(key);
              try {
                const res = await fetch("/api/meal-status", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ date: dateStr, meal, memberId: userId }),
                });
                if (res.ok) {
                  const [td, tm] = await Promise.all([
                    fetch(`/api/meal-status?date=${todayStr}`).then(r => r.json()).catch(() => null),
                    fetch(`/api/meal-status?date=${tmrwStr}`).then(r => r.json()).catch(() => null),
                  ]);
                  if (td?.mealsPerDay) setMealStatusToday(td);
                  if (tm?.mealsPerDay) setMealStatusTmrw(tm);
                }
              } catch { /* ignore */ } finally {
                setMealToggling(null);
              }
            };

            const submitRequest = async (dateStr: string, meal: string) => {
              setRequestSubmitting(true);
              try {
                const res = await fetch("/api/meal-status", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "request", date: dateStr, meal, reason: requestReason || "Need to change meal status" }),
                });
                if (res.ok) {
                  setRequestingMeal(null);
                  setRequestReason("");
                  const [td, tm] = await Promise.all([
                    fetch(`/api/meal-status?date=${todayStr}`).then(r => r.json()).catch(() => null),
                    fetch(`/api/meal-status?date=${tmrwStr}`).then(r => r.json()).catch(() => null),
                  ]);
                  if (td?.mealsPerDay) setMealStatusToday(td);
                  if (tm?.mealsPerDay) setMealStatusTmrw(tm);
                }
              } catch { /* ignore */ } finally {
                setRequestSubmitting(false);
              }
            };

            const renderDayStatus = (data: MealStatusData | null, dateStr: string, label: string, icon: React.ReactNode) => {
              if (!data) return null;
              const meals = data.mealsList || (data.mealsPerDay === 2 ? ["lunch", "dinner"] : ["breakfast", "lunch", "dinner"]);

              return (
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-3">
                    {icon} {label}
                  </h3>
                  <div className="space-y-2">
                    {meals.map((meal) => {
                      const myStatus = data.statuses?.[userId]?.[meal];
                      const isOff = myStatus === true;
                      const isBlackedOut = data.blackoutStatus?.[meal] === true;
                      const key = `${dateStr}-${meal}`;
                      const isToggling = mealToggling === key;
                      const hasPending = data.pendingRequests?.some(
                        (r) => r.memberId === userId && r.meal === meal && r.date === dateStr && r.status === "PENDING"
                      );

                      return (
                        <div key={meal} className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/5 rounded-xl hover:bg-white/[0.05] transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-slate-800 rounded-md">
                              {getMealIcon(meal)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-200 capitalize">{meal}</p>
                              <p className="text-[10px] text-slate-500 font-medium">
                                {data.mealCounts?.[meal] ?? 0} ACTIVE
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1">
                            {isBlackedOut && !isManagerUser ? (
                              hasPending ? (
                                <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                                  Pending Review
                                </span>
                              ) : requestingMeal === key ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    placeholder="Reason..."
                                    value={requestReason}
                                    onChange={(e) => setRequestReason(e.target.value)}
                                    className="w-24 px-2 py-1 text-xs bg-slate-800 border border-white/10 rounded focus:outline-none focus:border-indigo-500"
                                  />
                                  <button onClick={() => submitRequest(dateStr, meal)} disabled={requestSubmitting} className="px-2 py-1 bg-indigo-500 text-white text-xs rounded font-medium disabled:opacity-50">
                                    Send
                                  </button>
                                  <button onClick={() => { setRequestingMeal(null); setRequestReason(""); }} className="px-1 py-1 text-slate-400">
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setRequestingMeal(key)}
                                  className="text-[10px] font-semibold text-slate-400 bg-white/5 border border-white/10 px-2 py-1 rounded hover:text-slate-300 flex items-center gap-1"
                                >
                                  <Lock className="w-3 h-3" /> Locked
                                </button>
                              )
                            ) : (
                              <button
                                onClick={() => toggleMeal(dateStr, meal)}
                                disabled={isToggling}
                                className={`relative h-6 w-11 rounded-full transition-all flex items-center shrink-0 border duration-300
                                  ${isOff ? "bg-slate-800 border-white/10" : "bg-emerald-500/20 border-emerald-500/50"} 
                                  ${isToggling ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                                `}
                              >
                                <div className={`absolute w-4 h-4 rounded-full shadow-sm transition-transform duration-300 
                                  ${isOff ? "bg-slate-500 translate-x-1" : "bg-emerald-400 translate-x-6"}
                                `} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            };

            return (
              <div className="bg-[#1a1a3e]/50 backdrop-blur-sm border border-white/10 p-5 rounded-2xl">
                <div className="flex justify-between items-center mb-5 pb-3 border-b border-white/5">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-indigo-400" /> Meal Status Manage
                  </h2>
                  <Link href="/meal-plan" className="text-xs font-semibold text-indigo-400 flex items-center gap-1 hover:text-indigo-300 transition">
                    Expand Calendar <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="flex flex-col md:flex-row gap-6">
                  {renderDayStatus(mealStatusToday, todayStr, "Today", <Clock className="w-4 h-4 text-emerald-400" />)}
                  <div className="hidden md:block w-px bg-white/5" />
                  {renderDayStatus(mealStatusTmrw, tmrwStr, "Tomorrow", <Calendar className="w-4 h-4 text-blue-400" />)}
                </div>
              </div>
            );
          })()}

          {/* Quick Shortcuts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link href="/bazar" className="bg-[#1a1a3e]/50 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center text-center hover:bg-white/5 hover:border-indigo-500/50 transition-all group">
              <ShoppingCart className="w-6 h-6 text-orange-400 mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-semibold text-slate-300">Add Bazar</p>
            </Link>
            <Link href="/bills" className="bg-[#1a1a3e]/50 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center text-center hover:bg-white/5 hover:border-emerald-500/50 transition-all group">
              <CreditCard className="w-6 h-6 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-semibold text-slate-300">Pay Bills</p>
            </Link>
            <Link href="/transparency" className="bg-[#1a1a3e]/50 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center text-center hover:bg-white/5 hover:border-blue-500/50 transition-all group">
              <Search className="w-6 h-6 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-semibold text-slate-300">Transparency</p>
            </Link>
            <Link href="/audit-log" className="bg-[#1a1a3e]/50 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center text-center hover:bg-white/5 hover:border-purple-500/50 transition-all group">
              <ShieldCheck className="w-6 h-6 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-semibold text-slate-300">Audit Logs</p>
            </Link>
          </div>

        </div>

        {/* Right Column: Manager Tools, Bills, Announcements */}
        <div className="space-y-6">
          
          {/* Manager Quick Actions */}
          {isManager && (
            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-sm border border-indigo-500/20 p-5 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <Zap className="w-16 h-16 text-indigo-400" />
              </div>
              <h2 className="text-sm font-bold tracking-wider uppercase text-indigo-400 mb-4 flex items-center gap-2 relative z-10">
                <ShieldCheck className="w-4 h-4" /> Manager Operations
              </h2>
              <div className="grid grid-cols-2 gap-2 relative z-10">
                <Link href="/manager/meals" className="px-3 py-2 bg-white/5 hover:bg-indigo-500/20 border border-white/5 hover:border-indigo-500/30 rounded-lg text-xs font-medium text-slate-300 hover:text-indigo-200 transition-all flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" /> Count Meals
                </Link>
                <Link href="/manager/deposits" className="px-3 py-2 bg-white/5 hover:bg-emerald-500/20 border border-white/5 hover:border-emerald-500/30 rounded-lg text-xs font-medium text-slate-300 hover:text-emerald-200 transition-all flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5" /> Add Deposit
                </Link>
                <Link href="/manager/members" className="px-3 py-2 bg-white/5 hover:bg-purple-500/20 border border-white/5 hover:border-purple-500/30 rounded-lg text-xs font-medium text-slate-300 hover:text-purple-200 transition-all flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" /> Members Tool
                </Link>
                <Link href="/manager/handover" className="px-3 py-2 bg-white/5 hover:bg-orange-500/20 border border-white/5 hover:border-orange-500/30 rounded-lg text-xs font-medium text-slate-300 hover:text-orange-200 transition-all flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5" /> Hand Over
                </Link>
              </div>
            </div>
          )}

          {/* This Month Summary Box */}
          <div className="bg-[#1a1a3e]/50 backdrop-blur-sm border border-white/10 p-5 rounded-2xl">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> Month Status
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5">
                <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">Expense</span>
                <span className="font-semibold text-sm text-slate-200">৳{bill?.totalExpense || 0}</span>
              </div>
              <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5">
                <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">Meals</span>
                <span className="font-semibold text-sm text-slate-200">{bill?.totalMeals || 0}</span>
              </div>
              <div className="flex justify-between items-center bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
                <span className="text-xs text-indigo-300 font-medium tracking-wide uppercase">Rate</span>
                <span className="font-bold text-sm text-indigo-400">৳{bill?.mealRate || 0}</span>
              </div>
            </div>

            {/* Bill Payment Status Inline */}
            {billPayStatus && billPayStatus.members.length > 0 && (
              <div className="mt-5 pt-5 border-t border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Payments Tracker</h3>
                </div>
                <div className="space-y-2">
                  {billPayStatus.members.map((m) => {
                    const totalBill = billPayStatus.memberBills[m.id] || 0;
                    const paid = billPayStatus.paidAmounts[m.id] || 0;
                    const confirmed = billPayStatus.confirmedAmounts[m.id] || 0;
                    const isPaid = totalBill > 0 && confirmed >= totalBill;
                    const hasPending = paid > confirmed;
                    
                    return (
                      <div key={m.id} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-white/5 transition border border-transparent hover:border-white/5">
                        <span className="text-slate-300 font-medium truncate w-20" title={m.name}>{m.name}</span>
                        {isPaid ? (
                          <span className="text-emerald-400 flex items-center gap-1 font-semibold"><CheckCircle className="w-3 h-3" /> Paid</span>
                        ) : hasPending ? (
                          <span className="text-amber-400 flex items-center gap-1 font-semibold"><Clock className="w-3 h-3" /> Pend</span>
                        ) : confirmed > 0 ? (
                           <span className="text-blue-400 font-semibold">{Math.round((confirmed/totalBill)*100)}%</span>
                        ) : (
                          <span className="text-rose-400 font-semibold">0%</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Announcements */}
          {announcements.length > 0 && (
            <div className="bg-[#1a1a3e]/50 backdrop-blur-sm border border-white/10 p-5 rounded-2xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" /> Notice Board
                </h2>
                <Link href="/announcements" className="text-xs text-indigo-400 hover:text-indigo-300">All</Link>
              </div>
              <div className="space-y-3">
                {announcements.slice(0, 3).map((a) => (
                  <div key={a.id} className={`p-3 text-sm rounded-xl border ${a.pinned ? "bg-amber-500/10 border-amber-500/20 backdrop-blur" : "bg-white/5 border-white/5"} relative overflow-hidden group`}>
                    <h3 className="font-semibold text-slate-200 mb-1 pr-6 truncate">{a.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{a.body}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[10px] text-slate-500 font-medium">
                      <span>{a.author.name}</span>
                      <span>{new Date(a.createdAt).toLocaleDateString(undefined, { month:'short', day:'numeric' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
