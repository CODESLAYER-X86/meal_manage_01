"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

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

const DEFAULT_MEAL_ICONS: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snacks: "🍪", supper: "🌃" };
const MEAL_THEMES: Record<string, string> = {
  breakfast: "bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/20 text-amber-500",
  lunch: "bg-gradient-to-r from-blue-500/10 to-transparent border-blue-500/20 text-blue-400",
  dinner: "bg-gradient-to-r from-indigo-500/10 to-transparent border-indigo-500/20 text-indigo-400",
  snacks: "bg-gradient-to-r from-orange-500/10 to-transparent border-orange-500/20 text-orange-400"
};

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

  // Meal status state
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
      // Set meal types from mess config or status response
      if (statusData?.mealsList) {
        setMealTypesList(statusData.mealsList);
      } else {
        try {
          const mt = JSON.parse(messData.mess?.mealTypes || '["breakfast","lunch","dinner"]');
          if (Array.isArray(mt) && mt.length > 0) setMealTypesList(mt);
        } catch { /* use default */ }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
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
    // Parse meals JSON if available, else use legacy columns
    let mealsObj: Record<string, string> = {};
    if (plan?.meals) {
      try { mealsObj = JSON.parse(plan.meals); } catch { /* ignore */ }
    }
    const form: Record<string, string> = {};
    for (const mt of mealTypesList) {
      form[mt] = mealsObj[mt] || (plan as unknown as Record<string, string | null>)?.[mt] || "";
    }
    setEditForm(form);

    let cMeals: string[] = [];
    if (plan?.cancelledMeals) {
      try { cMeals = JSON.parse(plan.cancelledMeals); } catch {}
    }
    setEditCancelled(cMeals);

    let wObj: Record<string, string> = {};
    if (plan?.wastage) {
      try { wObj = JSON.parse(plan.wastage); } catch {}
    }
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
        // Update local state immediately so UI reflects the change
        setPlans((prev) => {
          const idx = prev.findIndex((p) => {
            const d = new Date(p.date);
            return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && d.getUTCDate() === editingDay;
          });
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = saved;
            return updated;
          }
          return [...prev, saved];
        });
        setEditingDay(null);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  // Refresh meal status
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border border-white/10 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">🍳 Meal Plan</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {isManager ? "Set what will be cooked each day" : "See what's being cooked each day"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => changeMonth(-1)} className="px-3 py-2.5 bg-white/[0.06] hover:bg-white/[0.08] rounded-lg text-sm font-medium transition-colors">
              ←
            </button>
            <span className="text-base sm:text-lg font-semibold text-slate-300 min-w-[140px] text-center">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button onClick={() => changeMonth(1)} className="px-3 py-2.5 bg-white/[0.06] hover:bg-white/[0.08] rounded-lg text-sm font-medium transition-colors">
              →
            </button>
          </div>
        </div>

      </div>



      {/* Meal Status Grid - Today/Tomorrow */}
      {mealStatusData && (() => {
        const meals = mealStatusData.mealsList || (mealStatusData.mealsPerDay === 2 ? ["lunch", "dinner"] : ["breakfast", "lunch", "dinner"]);
        const mealIcons: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙" };
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
          } catch { /* ignore */ } finally {
            setMealStatusToggling(null);
          }
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
          } catch { /* ignore */ } finally {
            setMealStatusToggling(null);
          }
        };

        return (
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border border-white/10 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">🍽️ Meal Status</h2>
                <p className="text-sm text-slate-400">Who&apos;s eating today/tomorrow</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStatusDate("today")}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${statusDate === "today" ? "bg-indigo-600 text-white" : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.08]"
                    }`}
                >
                  📅 Today
                </button>
                <button
                  onClick={() => setStatusDate("tomorrow")}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${statusDate === "tomorrow" ? "bg-indigo-600 text-white" : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.08]"
                    }`}
                >
                  🔮 Tomorrow
                </button>
              </div>
            </div>

            {/* Status Grid */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-3 text-slate-400 font-medium">Member</th>
                    {meals.map((meal) => (
                      <th key={meal} className="text-center py-2 px-2 text-slate-400 font-medium">
                        <span className="hidden sm:inline">{mealIcons[meal]} </span>
                        <span className="capitalize">{meal}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mealStatusData.members.map((member) => (
                    <tr key={member.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2.5 pr-3">
                        <span className="font-medium text-slate-300 text-sm">{member.name}</span>
                        {member.id === session?.user?.id && (
                          <span className="ml-1 text-xs text-slate-400">(you)</span>
                        )}
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
                          <td key={meal} className="text-center py-2.5 px-2">
                            {isCancelled ? (
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-500 text-sm" title="Canceled by manager completely">
                                🚫
                              </span>
                            ) : canToggle && !blocked ? (
                              <button
                                onClick={() => handleToggle(member.id, meal)}
                                disabled={isToggling}
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all ${isOff
                                  ? "bg-red-100 text-red-600 hover:bg-red-200"
                                  : "bg-green-100 text-green-600 hover:bg-green-200"
                                  } ${isToggling ? "opacity-50" : ""}`}
                                title={isOff ? "Click to turn ON" : "Click to turn OFF"}
                              >
                                {isOff ? "✕" : "✓"}
                              </button>
                            ) : blocked ? (
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-50 text-amber-500 text-sm" title="Blackout window">
                                🔒
                              </span>
                            ) : (
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm ${isOff ? "bg-red-50 text-red-400" : "bg-green-50 text-green-400"
                                }`}>
                                {isOff ? "✕" : "✓"}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Cook Count Row */}
                  <tr className="bg-indigo-50/50">
                    <td className="py-2.5 pr-3">
                      <span className="font-semibold text-indigo-700 text-sm">🧑‍🍳 Cook Count</span>
                    </td>
                    {meals.map((meal) => (
                      <td key={meal} className="text-center py-2.5 px-2">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold">
                          {mealStatusData.mealCounts?.[meal] ?? 0}
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Pending Meal Status Requests - Manager Only */}
            {isManager && mealStatusData.pendingRequests?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <h3 className="text-sm font-semibold text-amber-800 mb-2">⏳ Pending Meal Change Requests</h3>
                <div className="space-y-2">
                  {mealStatusData.pendingRequests.map((req) => {
                    const memberName = mealStatusData.members.find((m) => m.id === req.memberId)?.name || "Unknown";
                    return (
                      <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-slate-100">
                            {memberName} wants to turn <strong className="capitalize">{req.meal}</strong> {req.wantOff ? "OFF" : "ON"}
                          </p>
                          {req.reason && <p className="text-xs text-slate-400 mt-0.5">{req.reason}</p>}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveRequest(req.id, "approve")}
                            disabled={mealStatusToggling === req.id}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-50"
                          >
                            ✅ Approve
                          </button>
                          <button
                            onClick={() => handleApproveRequest(req.id, "reject")}
                            disabled={mealStatusToggling === req.id}
                            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded-lg disabled:opacity-50"
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

      {/* Meal Plan Calendar */}
      <div className="space-y-3">
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const plan = getPlanForDay(day);
          const dateObj = new Date(year, month - 1, day);
          const dayName = dateObj.toLocaleDateString("en", { weekday: "short" });
          const todayDate = new Date();
          todayDate.setHours(0, 0, 0, 0);
          dateObj.setHours(0, 0, 0, 0);
          const isToday = dateObj.getTime() === todayDate.getTime();
          const isPast = dateObj < todayDate;
          const isEditing = editingDay === day;

          return (
            <div
              key={day}
              className={`bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border overflow-hidden transition-colors ${isToday ? "border-indigo-300 ring-1 ring-indigo-200" : "border-white/10"
                } ${isPast ? "opacity-70" : ""}`}
            >
              <div
                className={`flex items-center justify-between px-5 py-4 ${isToday ? "bg-indigo-500/10 border-b border-indigo-500/20" : "bg-white/[0.02] border-b border-white/5"
                  } ${isManager && !isEditing ? "cursor-pointer hover:bg-white/[0.05] transition-colors" : ""}`}
                onClick={() => !isEditing && startEdit(day)}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-black tracking-tighter ${isToday ? "text-indigo-400" : "text-slate-200"}`}>
                    {day}
                  </span>
                  <span className="text-sm font-medium text-slate-400 uppercase tracking-widest">{dayName}</span>
                  {isToday && (
                    <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold uppercase tracking-widest rounded-full shadow-[0_0_10px_rgba(79,70,229,0.2)]">
                      Today
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isManager && !isEditing && (
                    <span className="text-xs text-slate-400 hidden sm:inline">tap to edit</span>
                  )}
                </div>
              </div>

              {/* Editing Form */}
              {isEditing && isManager ? (
                <div className="p-4 space-y-3 bg-indigo-50/30">
                  {mealTypesList.map((meal) => {
                    const themeClass = MEAL_THEMES[meal] || "bg-white/[0.04] border-white/10 text-slate-300";
                    return (
                    <div key={meal} className={`flex flex-col gap-3 p-4 rounded-xl border ${themeClass}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <label className="text-sm font-bold capitalize w-24 shrink-0 flex items-center gap-2">
                          <span className="text-xl">{DEFAULT_MEAL_ICONS[meal] || "🍽️"}</span> {meal}
                        </label>
                        <input
                          type="text"
                          value={editForm[meal] || ""}
                          onChange={(e) => setEditForm({ ...editForm, [meal]: e.target.value })}
                          placeholder={`What's for ${meal}?`}
                          className="flex-1 px-4 py-3 border border-white/10 bg-black/20 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-white/20 outline-none transition-all"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-4 pl-0 sm:pl-28">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={editCancelled.includes(meal)}
                            onChange={(e) => {
                              if (e.target.checked) setEditCancelled([...editCancelled, meal]);
                              else setEditCancelled(editCancelled.filter(m => m !== meal));
                            }}
                            className="w-4 h-4 rounded border-red-500/30 text-red-500 bg-red-500/10 focus:ring-red-500 transition-colors"
                          />
                          <span className="text-xs text-red-400/80 group-hover:text-red-400 font-semibold transition-colors">Cancel Meal (zeroes entries)</span>
                        </label>
                        {isPast && (
                          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                            <span className="text-xs text-amber-500/80 font-semibold min-w-max">Log Wastage:</span>
                            <input
                              type="text"
                              value={editWastage[meal] || ""}
                              onChange={(e) => setEditWastage({ ...editWastage, [meal]: e.target.value })}
                              placeholder="e.g. 5x rice, 2x chicken"
                              className="w-full px-3 py-2 text-xs bg-black/20 border border-amber-500/20 rounded-lg text-slate-200 placeholder:text-amber-500/30 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                 })}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "💾 Save Menu"}
                    </button>
                    <button
                      onClick={() => setEditingDay(null)}
                      className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-bold rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : plan && (plan.breakfast || plan.lunch || plan.dinner || plan.meals) ? (
                <div className="px-4 py-3">
                  <div className="space-y-2">
                    {(() => {
                      let mealsObj: Record<string, string> = {};
                      try { mealsObj = JSON.parse(plan?.meals || "{}"); } catch { /* ignore */ }
                      if (Object.keys(mealsObj).length === 0 && plan) {
                        if (plan.breakfast) mealsObj.breakfast = plan.breakfast;
                        if (plan.lunch) mealsObj.lunch = plan.lunch;
                        if (plan.dinner) mealsObj.dinner = plan.dinner;
                      }
                      return mealTypesList.map((mt) => {
                        const val = mealsObj[mt];
                        let cMeals: string[] = [];
                        try { cMeals = JSON.parse(plan.cancelledMeals || "[]"); } catch {}
                        const isCancelled = cMeals.includes(mt);

                        let wObj: Record<string, string> = {};
                        try { wObj = JSON.parse(plan.wastage || "{}"); } catch {}
                        const wastageVal = wObj[mt];

                        if (!val && !isCancelled && !wastageVal) return null;
                        const themeClass = MEAL_THEMES[mt] || "text-slate-300";
                        return (
                          <div key={mt} className="flex flex-col gap-1.5 mb-4 last:mb-0">
                            <div className={`flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] ${themeClass.split(' ')[0] /* Use gradient background */}`}>
                              <span className="text-2xl mt-0.5">{DEFAULT_MEAL_ICONS[mt] || "🍽️"}</span>
                              <div className="flex-1">
                                <div className="flex justify-between items-start">
                                  <p className="text-xs font-bold uppercase tracking-wider opacity-80">{mt}</p>
                                  {isCancelled && <span className="text-[10px] font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">Canceled</span>}
                                </div>
                                <p className={`text-base font-medium mt-1 leading-snug ${isCancelled ? 'line-through text-slate-500' : 'text-slate-100'}`}>{val || "..."}</p>
                              </div>
                            </div>
                            {wastageVal && (
                              <div className="pl-12 flex items-start">
                                <span className="text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">🗑️ Wastage Logs: {wastageVal}</span>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3">
                  <p className="text-sm text-slate-400 italic">No menu planned</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
