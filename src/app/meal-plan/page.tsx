"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Check, X, Lock, Ban, Clock, CalendarDays, Utensils, Users, ChefHat, AlertCircle } from "lucide-react";

interface MealPlan {
  id: string;
  date: string;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  meals?: string;
  cancelledMeals?: string;
  wastage?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MEAL_META: Record<string, { icon: string; accent: string; glow: string; label: string }> = {
  breakfast: { icon: "🌅", accent: "from-amber-500/20 via-amber-500/5 to-transparent", glow: "shadow-amber-500/10", label: "Breakfast" },
  lunch:     { icon: "☀️",  accent: "from-sky-500/20 via-sky-500/5 to-transparent",    glow: "shadow-sky-500/10",   label: "Lunch" },
  dinner:    { icon: "🌙",  accent: "from-indigo-500/20 via-indigo-500/5 to-transparent", glow: "shadow-indigo-500/10", label: "Dinner" },
  snacks:    { icon: "🍪",  accent: "from-orange-500/20 via-orange-500/5 to-transparent", glow: "shadow-orange-500/10", label: "Snacks" },
  supper:    { icon: "🌃",  accent: "from-teal-500/20 via-teal-500/5 to-transparent",  glow: "shadow-teal-500/10",  label: "Supper" },
};

const DAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export default function MealPlanPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [mealTypesList, setMealTypesList] = useState<string[]>(["breakfast", "lunch", "dinner"]);
  const [editCancelled, setEditCancelled] = useState<string[]>([]);
  const [editWastage, setEditWastage] = useState<Record<string, string>>({});

  const [mealStatusData, setMealStatusData] = useState<{
    mealsPerDay: number;
    mealsList?: string[];
    members: { id: string; name: string }[];
    statuses: Record<string, Record<string, boolean>>;
    mealCounts: Record<string, number>;
    blackoutStatus: Record<string, boolean>;
    cancelledMeals?: string[];
    pendingRequests: { id: string; date: string; meal: string; memberId: string; wantOff: boolean; reason: string; status: string }[];
  } | null>(null);
  const [mealStatusToggling, setMealStatusToggling] = useState<string | null>(null);
  const [statusDate, setStatusDate] = useState<"today" | "tomorrow">("today");

  const isManager = session?.user?.role === "MANAGER";

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const dateStr = statusDate === "today"
        ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
        : (() => { const t = new Date(now); t.setDate(t.getDate() + 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; })();

      const [plansRes, statusRes, messRes] = await Promise.all([
        fetch(`/api/meal-plan?month=${month}&year=${year}`),
        fetch(`/api/meal-status?date=${dateStr}`),
        fetch("/api/mess"),
      ]);
      const plansData = await plansRes.json();
      const statusData = await statusRes.json();
      const messData = await messRes.json();
      setPlans(Array.isArray(plansData) ? plansData : []);
      if (statusData?.mealsPerDay) setMealStatusData(statusData);
      if (statusData?.mealsList) {
        setMealTypesList(statusData.mealsList);
      } else {
        try {
          const mt = JSON.parse(messData.mess?.mealTypes || '["breakfast","lunch","dinner"]');
          if (Array.isArray(mt) && mt.length > 0) setMealTypesList(mt);
        } catch { /* use default */ }
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [month, year, statusDate]);

  useEffect(() => {
    if (status === "authenticated") fetchData();
  }, [status, fetchData]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m);
    setYear(y);
    setEditingDay(null);
  };

  const daysInMonth = new Date(year, month, 0).getDate();

  const getPlanForDay = (day: number) => {
    return plans.find((p) => {
      const d = new Date(p.date);
      return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
    });
  };

  const startEdit = (day: number) => {
    if (!isManager) return;
    const plan = getPlanForDay(day);
    let mealsObj: Record<string, string> = {};
    if (plan?.meals) { try { mealsObj = JSON.parse(plan.meals); } catch { /* ignore */ } }
    const form: Record<string, string> = {};
    for (const mt of mealTypesList) {
      form[mt] = mealsObj[mt] || (plan as unknown as Record<string, string | null>)?.[mt] || "";
    }
    setEditForm(form);
    let cMeals: string[] = [];
    if (plan?.cancelledMeals) { try { cMeals = JSON.parse(plan.cancelledMeals); } catch {} }
    setEditCancelled(cMeals);
    let wObj: Record<string, string> = {};
    if (plan?.wastage) { try { wObj = JSON.parse(plan.wastage); } catch {} }
    setEditWastage(wObj);
    setEditingDay(day);
  };

  const saveEdit = async () => {
    if (!editingDay) return;
    setSaving(true);
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(editingDay).padStart(2, "0")}`;
    try {
      const res = await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          meals: editForm,
          breakfast: editForm.breakfast?.trim() || "",
          lunch: editForm.lunch?.trim() || "",
          dinner: editForm.dinner?.trim() || "",
          cancelledMeals: editCancelled,
          wastage: editWastage,
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        setPlans((prev) => {
          const idx = prev.findIndex((p) => {
            const d = new Date(p.date);
            return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && d.getUTCDate() === editingDay;
          });
          if (idx >= 0) { const updated = [...prev]; updated[idx] = saved; return updated; }
          return [...prev, saved];
        });
        setEditingDay(null);
      } else {
        const errData = await res.json().catch(() => null);
        alert(`Failed to save: ${errData?.error || res.statusText}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally { setSaving(false); }
  };

  const refreshMealStatus = useCallback(async () => {
    try {
      const now = new Date();
      const dateStr = statusDate === "today"
        ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
        : (() => { const t = new Date(now); t.setDate(t.getDate() + 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; })();
      const res = await fetch(`/api/meal-status?date=${dateStr}`);
      const data = await res.json();
      if (data?.mealsPerDay) setMealStatusData(data);
    } catch { /* ignore */ }
  }, [statusDate]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20"></div>
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin"></div>
          </div>
          <p className="text-slate-400 text-sm font-medium">Loading meal plan...</p>
        </div>
      </div>
    );
  }

  const meals = mealStatusData?.mealsList || mealTypesList;

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10">

      {/* ── Header ── */}
      <div className="relative overflow-hidden bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 sm:p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center">
                <CalendarDays className="w-4.5 h-4.5 text-indigo-400" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Meal Plan</h1>
            </div>
            <p className="text-sm text-slate-400 pl-12">
              {isManager ? "Set what's being cooked each day" : "See what's on the menu"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeMonth(-1)}
              className="w-9 h-9 flex items-center justify-center bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] rounded-xl transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-300" />
            </button>
            <span className="text-base font-semibold text-slate-200 min-w-[150px] text-center">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button
              onClick={() => changeMonth(1)}
              className="w-9 h-9 flex items-center justify-center bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] rounded-xl transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Meal Status Card ── */}
      {mealStatusData && (() => {
        const now = new Date();
        const dateStr = statusDate === "today"
          ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
          : (() => { const t = new Date(now); t.setDate(t.getDate() + 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; })();

        const handleToggle = async (memberId: string, meal: string) => {
          const key = `${memberId}-${meal}`;
          setMealStatusToggling(key);
          try {
            const res = await fetch("/api/meal-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date: dateStr, meal, memberId }),
            });
            if (res.ok) await refreshMealStatus();
          } catch { /* ignore */ } finally { setMealStatusToggling(null); }
        };

        const handleApproveRequest = async (requestId: string, action: "approve" | "reject") => {
          setMealStatusToggling(requestId);
          try {
            const res = await fetch("/api/meal-status", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action, requestId }),
            });
            if (res.ok) await refreshMealStatus();
          } catch { /* ignore */ } finally { setMealStatusToggling(null); }
        };

        return (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
            {/* Card Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                  <Users className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Meal Status</h2>
                  <p className="text-xs text-slate-400">Who's eating {statusDate}</p>
                </div>
              </div>
              <div className="flex gap-1.5 p-1 bg-white/[0.04] border border-white/[0.06] rounded-xl">
                {(["today", "tomorrow"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setStatusDate(d)}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-lg capitalize transition-all ${
                      statusDate === d
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {d === "today" ? "📅 Today" : "🔮 Tomorrow"}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Table */}
            <div className="overflow-x-auto p-1">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Member</th>
                    {meals.map((meal) => {
                      const meta = MEAL_META[meal];
                      return (
                        <th key={meal} className="text-center py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          <span className="mr-1">{meta?.icon || "🍽️"}</span>
                          <span className="hidden sm:inline">{meta?.label || meal}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {mealStatusData.members.map((member) => (
                    <tr key={member.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-medium text-slate-200 text-sm">{member.name}</span>
                            {member.id === session?.user?.id && (
                              <span className="ml-1.5 text-[10px] text-indigo-400 font-semibold bg-indigo-500/10 px-1.5 py-0.5 rounded-full">you</span>
                            )}
                          </div>
                        </div>
                      </td>
                      {meals.map((meal) => {
                        const isOff = mealStatusData.statuses?.[member.id]?.[meal] === true;
                        const key = `${member.id}-${meal}`;
                        const isToggling = mealStatusToggling === key;
                        const canToggle = isManager || member.id === session?.user?.id;
                        const isBlackedOut = mealStatusData.blackoutStatus?.[meal] === true;
                        const blocked = isBlackedOut && !isManager && member.id === session?.user?.id;
                        const isCancelled = mealStatusData.cancelledMeals?.includes(meal) || false;

                        return (
                          <td key={meal} className="text-center py-3 px-3">
                            {isToggling ? (
                              <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl">
                                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                              </div>
                            ) : isCancelled ? (
                              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 text-sm" title="Canceled by manager">
                                <Ban className="w-4 h-4 text-red-400" />
                              </span>
                            ) : blocked ? (
                              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20" title="Blackout window active">
                                <Lock className="w-3.5 h-3.5 text-amber-400" />
                              </span>
                            ) : canToggle ? (
                              <button
                                onClick={() => handleToggle(member.id, meal)}
                                className={`inline-flex items-center justify-center w-9 h-9 rounded-xl text-sm font-bold transition-all active:scale-90 border ${
                                  isOff
                                    ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/25"
                                    : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/25"
                                }`}
                                title={isOff ? "Click to turn ON" : "Click to turn OFF"}
                              >
                                {isOff ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                              </button>
                            ) : (
                              <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border ${
                                isOff
                                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              }`}>
                                {isOff ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Cook Count Row */}
                  <tr className="bg-white/[0.02]">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <ChefHat className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Cook Count</span>
                      </div>
                    </td>
                    {meals.map((meal) => (
                      <td key={meal} className="text-center py-3 px-3">
                        <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-sm font-black">
                          {mealStatusData.mealCounts?.[meal] ?? 0}
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Pending Requests */}
            {isManager && mealStatusData.pendingRequests?.length > 0 && (
              <div className="p-5 border-t border-white/[0.06]">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-amber-300">Pending Meal Change Requests</h3>
                  <span className="px-2 py-0.5 text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/25 rounded-full">
                    {mealStatusData.pendingRequests.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {mealStatusData.pendingRequests.map((req) => {
                    const memberName = mealStatusData.members.find((m) => m.id === req.memberId)?.name || "Unknown";
                    return (
                      <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">{memberName}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Wants <span className="text-amber-300 font-bold capitalize">{req.meal}</span> {req.wantOff ? "OFF" : "ON"}
                          </p>
                          {req.reason && <p className="text-[11px] text-slate-500 mt-1 italic">"{req.reason}"</p>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleApproveRequest(req.id, "approve")}
                            disabled={mealStatusToggling === req.id}
                            className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-xs font-bold rounded-lg transition-all disabled:opacity-40"
                          >
                            ✅ Approve
                          </button>
                          <button
                            onClick={() => handleApproveRequest(req.id, "reject")}
                            disabled={mealStatusToggling === req.id}
                            className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 text-xs font-bold rounded-lg transition-all disabled:opacity-40"
                          >
                            ❌ Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Day Cards ── */}
      <div className="space-y-2">
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const plan = getPlanForDay(day);
          const dateObj = new Date(year, month - 1, day);
          const dayAbbr = DAY_ABBR[dateObj.getDay()];
          const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
          dateObj.setHours(0, 0, 0, 0);
          const isToday = dateObj.getTime() === todayDate.getTime();
          const isPast = dateObj < todayDate;
          const isEditing = editingDay === day;

          let mealsObj: Record<string, string> = {};
          try { mealsObj = JSON.parse(plan?.meals || "{}"); } catch {}
          if (Object.keys(mealsObj).length === 0 && plan) {
            if (plan.breakfast) mealsObj.breakfast = plan.breakfast;
            if (plan.lunch) mealsObj.lunch = plan.lunch;
            if (plan.dinner) mealsObj.dinner = plan.dinner;
          }
          let cMeals: string[] = [];
          try { cMeals = JSON.parse(plan?.cancelledMeals || "[]"); } catch {}
          let wObj: Record<string, string> = {};
          try { wObj = JSON.parse(plan?.wastage || "{}"); } catch {}

          const hasContent = mealTypesList.some((mt) => mealsObj[mt] || cMeals.includes(mt));

          return (
            <div
              key={day}
              className={`border rounded-2xl overflow-hidden transition-all duration-200 ${
                isToday
                  ? "border-indigo-500/40 bg-indigo-500/[0.04] shadow-lg shadow-indigo-500/5"
                  : "border-white/[0.06] bg-white/[0.02]"
              } ${isPast && !isEditing ? "opacity-60" : ""}`}
            >
              {/* Day Header */}
              <div
                className={`flex items-center justify-between px-4 py-3.5 border-b ${
                  isToday ? "border-indigo-500/20 bg-indigo-500/[0.06]" : "border-white/[0.05]"
                } ${isManager && !isEditing ? "cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.05]" : ""} transition-colors`}
                onClick={() => !isEditing && startEdit(day)}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-xl font-black transition-all ${
                    isToday
                      ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                      : "bg-white/[0.05] text-slate-300"
                  }`}>
                    <span className="text-lg leading-none">{day}</span>
                  </div>
                  <div>
                    <span className={`text-xs font-bold uppercase tracking-widest ${isToday ? "text-indigo-300" : "text-slate-500"}`}>
                      {dayAbbr}
                    </span>
                    {isToday && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Today</span>
                      </div>
                    )}
                  </div>

                  {/* Mini meal chips preview */}
                  {hasContent && !isEditing && (
                    <div className="hidden sm:flex items-center gap-1.5 ml-2">
                      {mealTypesList.map((mt) => {
                        const meta = MEAL_META[mt];
                        if (!mealsObj[mt] && !cMeals.includes(mt)) return null;
                        return (
                          <span
                            key={mt}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                              cMeals.includes(mt)
                                ? "bg-red-500/10 text-red-400 border-red-500/20 line-through"
                                : "bg-white/[0.05] text-slate-400 border-white/[0.07]"
                            }`}
                          >
                            {meta?.icon} {mealsObj[mt] ? mealsObj[mt].slice(0, 18) + (mealsObj[mt].length > 18 ? "…" : "") : mt}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                {isManager && !isEditing && (
                  <span className="text-[11px] text-slate-600 hidden sm:block font-medium">tap to edit</span>
                )}
              </div>

              {/* ── Edit Form ── */}
              {isEditing && isManager && (
                <div className="p-4 space-y-3 bg-[#0d1526]">
                  <div className="flex items-center gap-2 mb-4">
                    <Utensils className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-bold text-slate-300">Editing menu for {MONTH_NAMES[month - 1]} {day}</span>
                  </div>

                  {mealTypesList.map((meal) => {
                    const meta = MEAL_META[meal] || { icon: "🍽️", accent: "from-slate-500/10 to-transparent", label: meal };
                    const isCancelledEdit = editCancelled.includes(meal);
                    return (
                      <div key={meal} className={`rounded-xl border overflow-hidden ${isCancelledEdit ? "border-red-500/20 opacity-60" : "border-white/[0.07]"}`}>
                        <div className={`flex items-center gap-3 px-4 py-3 bg-gradient-to-r ${meta.accent}`}>
                          <span className="text-xl">{meta.icon}</span>
                          <span className="text-sm font-bold text-slate-200 capitalize">{meal}</span>
                          <div className="flex-1" />
                          <label className="flex items-center gap-1.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={isCancelledEdit}
                              onChange={(e) => {
                                if (e.target.checked) setEditCancelled([...editCancelled, meal]);
                                else setEditCancelled(editCancelled.filter((m) => m !== meal));
                              }}
                              className="w-3.5 h-3.5 rounded border-red-500/30 accent-red-500"
                            />
                            <span className="text-[11px] text-rose-400 font-semibold group-hover:text-rose-300 transition-colors">Cancel Meal</span>
                          </label>
                        </div>
                        <div className="px-4 pb-3 pt-2.5 bg-white/[0.02] space-y-2.5">
                          <input
                            type="text"
                            value={editForm[meal] || ""}
                            onChange={(e) => setEditForm({ ...editForm, [meal]: e.target.value })}
                            placeholder={`What's for ${meal}?`}
                            disabled={isCancelledEdit}
                            className="w-full px-4 py-2.5 bg-black/30 border border-white/[0.08] rounded-xl text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-40"
                          />
                          {isPast && (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-amber-400/80 font-semibold whitespace-nowrap">🗑️ Wastage:</span>
                              <input
                                type="text"
                                value={editWastage[meal] || ""}
                                onChange={(e) => setEditWastage({ ...editWastage, [meal]: e.target.value })}
                                placeholder="e.g. 5x rice, 2x chicken"
                                className="flex-1 px-3 py-1.5 text-xs bg-black/20 border border-amber-500/15 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition-all"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex gap-2.5 pt-1">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 active:scale-[0.98]"
                    >
                      {saving ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                      ) : (
                        <><Check className="w-4 h-4" /> Save Menu</>
                      )}
                    </button>
                    <button
                      onClick={() => setEditingDay(null)}
                      className="px-6 py-2.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] text-slate-300 text-sm font-bold rounded-xl transition-all active:scale-[0.98]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* ── Meal Display ── */}
              {!isEditing && hasContent && (
                <div className="px-4 py-3 space-y-2.5">
                  {mealTypesList.map((mt) => {
                    const val = mealsObj[mt];
                    const isCancelled = cMeals.includes(mt);
                    const wastageVal = wObj[mt];
                    if (!val && !isCancelled && !wastageVal) return null;
                    const meta = MEAL_META[mt] || { icon: "🍽️", accent: "from-slate-500/10 to-transparent", label: mt, glow: "" };
                    return (
                      <div key={mt} className="flex flex-col gap-1.5">
                        <div className={`flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r ${meta.accent} border border-white/[0.04]`}>
                          <span className="text-lg mt-0.5">{meta.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{meta.label}</p>
                              {isCancelled && (
                                <span className="text-[10px] font-black bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full border border-red-500/25 shrink-0">CANCELLED</span>
                              )}
                            </div>
                            <p className={`text-sm font-medium leading-snug ${isCancelled ? "line-through text-slate-600" : "text-slate-200"}`}>
                              {val || <span className="text-slate-600 italic text-xs">No menu set</span>}
                            </p>
                          </div>
                        </div>
                        {wastageVal && (
                          <div className="flex items-center gap-2 pl-12">
                            <AlertCircle className="w-3 h-3 text-amber-500/60 shrink-0" />
                            <span className="text-[11px] text-amber-400/70 bg-amber-500/8 px-2 py-0.5 rounded-lg border border-amber-500/15">
                              Wastage: {wastageVal}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Empty State ── */}
              {!isEditing && !hasContent && (
                <div className="px-4 py-3.5">
                  <p className="text-sm text-slate-600 italic">No menu planned</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
