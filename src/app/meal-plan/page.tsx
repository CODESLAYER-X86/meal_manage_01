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
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DEFAULT_MEAL_ICONS: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snacks: "🍪", supper: "🌃" };

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


  // Approve/reject loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Meal status state
  const [mealStatusData, setMealStatusData] = useState<{
    mealsPerDay: number;
    mealsList?: string[];
    members: { id: string; name: string }[];
    statuses: Record<string, Record<string, boolean>>;
    mealCounts: Record<string, number>;
    blackoutStatus: Record<string, boolean>;
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

  // Meal-off request submission
  const today = new Date().toISOString().split("T")[0];

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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🍳 Meal Plan</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isManager ? "Set what will be cooked each day" : "See what's being cooked each day"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => changeMonth(-1)} className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
              ←
            </button>
            <span className="text-base sm:text-lg font-semibold text-gray-700 min-w-[140px] text-center">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button onClick={() => changeMonth(1)} className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">🍽️ Meal Status</h2>
                <p className="text-sm text-gray-500">Who&apos;s eating today/tomorrow</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStatusDate("today")}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    statusDate === "today" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  📅 Today
                </button>
                <button
                  onClick={() => setStatusDate("tomorrow")}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    statusDate === "tomorrow" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-3 text-gray-500 font-medium">Member</th>
                    {meals.map((meal) => (
                      <th key={meal} className="text-center py-2 px-2 text-gray-500 font-medium">
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
                        <span className="font-medium text-gray-700 text-sm">{member.name}</span>
                        {member.id === session?.user?.id && (
                          <span className="ml-1 text-xs text-gray-400">(you)</span>
                        )}
                      </td>
                      {meals.map((meal) => {
                        const isOff = mealStatusData.statuses?.[member.id]?.[meal] === true;
                        const key = `${member.id}-${meal}`;
                        const isToggling = mealStatusToggling === key;
                        const canToggle = isManager || member.id === session?.user?.id;
                        const isBlackedOut = mealStatusData.blackoutStatus?.[meal] === true;
                        const blocked = isBlackedOut && !isManager && member.id === session?.user?.id;

                        return (
                          <td key={meal} className="text-center py-2.5 px-2">
                            {canToggle && !blocked ? (
                              <button
                                onClick={() => handleToggle(member.id, meal)}
                                disabled={isToggling}
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all ${
                                  isOff
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
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm ${
                                isOff ? "bg-red-50 text-red-400" : "bg-green-50 text-green-400"
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
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-amber-800 mb-2">⏳ Pending Meal Change Requests</h3>
                <div className="space-y-2">
                  {mealStatusData.pendingRequests.map((req) => {
                    const memberName = mealStatusData.members.find((m) => m.id === req.memberId)?.name || "Unknown";
                    return (
                      <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {memberName} wants to turn <strong className="capitalize">{req.meal}</strong> {req.wantOff ? "OFF" : "ON"}
                          </p>
                          {req.reason && <p className="text-xs text-gray-500 mt-0.5">{req.reason}</p>}
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
          const hasPlan = plan && (() => {
            try {
              const m = JSON.parse(plan.meals || "{}");
              return Object.values(m).some((v) => !!v);
            } catch { return plan.breakfast || plan.lunch || plan.dinner; }
          })();
          const isEditing = editingDay === day;

          return (
            <div
              key={day}
              className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-colors ${
                isToday ? "border-indigo-300 ring-1 ring-indigo-200" : "border-gray-200"
              } ${isPast ? "opacity-70" : ""}`}
            >
              {/* Day Header */}
              <div
                className={`flex items-center justify-between px-4 py-3 ${
                  isToday ? "bg-indigo-50" : "bg-gray-50"
                } ${isManager && !isEditing ? "cursor-pointer hover:bg-gray-100" : ""}`}
                onClick={() => !isEditing && startEdit(day)}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${isToday ? "text-indigo-700" : "text-gray-800"}`}>
                    {day}
                  </span>
                  <span className="text-sm text-gray-500">{dayName}</span>
                  {isToday && (
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                      Today
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isManager && !isEditing && (
                    <span className="text-xs text-gray-400 hidden sm:inline">tap to edit</span>
                  )}
                </div>
              </div>

              {/* Editing Form */}
              {isEditing && isManager ? (
                <div className="p-4 space-y-3 bg-indigo-50/30">
                  {mealTypesList.map((meal) => (
                    <div key={meal} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <label className="text-sm font-medium text-gray-600 capitalize w-20 shrink-0">
                        {DEFAULT_MEAL_ICONS[meal] || "🍽️"} {meal}
                      </label>
                      <input
                        type="text"
                        value={editForm[meal] || ""}
                        onChange={(e) => setEditForm({ ...editForm, [meal]: e.target.value })}
                        placeholder={`What's for ${meal}?`}
                        className="flex-1 px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                      />
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "💾 Save"}
                    </button>
                    <button
                      onClick={() => setEditingDay(null)}
                      className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
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
                        if (!val) return null;
                        return (
                          <div key={mt} className="flex items-start gap-2">
                            <span className="text-base">{DEFAULT_MEAL_ICONS[mt] || "🍽️"}</span>
                            <div>
                              <p className="text-xs text-gray-400 font-medium capitalize">{mt}</p>
                              <p className="text-sm text-gray-800">{val}</p>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3">
                  <p className="text-sm text-gray-300 italic">No menu planned</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
