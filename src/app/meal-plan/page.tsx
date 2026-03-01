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
}

interface MealOffRequest {
  id: string;
  memberId: string;
  member: { id: string; name: string };
  fromDate: string;
  toDate: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedAt: string | null;
  createdAt: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function MealPlanPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [mealOffs, setMealOffs] = useState<MealOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ breakfast: "", lunch: "", dinner: "" });
  const [saving, setSaving] = useState(false);

  // Meal-off form state
  const [showOffForm, setShowOffForm] = useState(false);
  const [offFrom, setOffFrom] = useState("");
  const [offTo, setOffTo] = useState("");
  const [offReason, setOffReason] = useState("");
  const [offSubmitting, setOffSubmitting] = useState(false);
  const [offError, setOffError] = useState("");

  // Approve/reject loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isManager = session?.user?.role === "MANAGER";

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, offsRes] = await Promise.all([
        fetch(`/api/meal-plan?month=${month}&year=${year}`),
        fetch(`/api/meal-off?status=`),
      ]);
      const plansData = await plansRes.json();
      const offsData = await offsRes.json();
      setPlans(Array.isArray(plansData) ? plansData : []);
      setMealOffs(Array.isArray(offsData) ? offsData : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [month, year]);

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
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return plans.find((p) => {
      const d = new Date(p.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day;
    });
  };

  const startEdit = (day: number) => {
    if (!isManager) return;
    const plan = getPlanForDay(day);
    setEditForm({
      breakfast: plan?.breakfast || "",
      lunch: plan?.lunch || "",
      dinner: plan?.dinner || "",
    });
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
          breakfast: editForm.breakfast.trim(),
          lunch: editForm.lunch.trim(),
          dinner: editForm.dinner.trim(),
        }),
      });
      if (res.ok) {
        await fetchData();
        setEditingDay(null);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  // Meal-off request submission
  const submitMealOff = async () => {
    setOffError("");
    if (!offFrom || !offTo) {
      setOffError("Please select both dates");
      return;
    }
    setOffSubmitting(true);
    try {
      const res = await fetch("/api/meal-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate: offFrom, toDate: offTo, reason: offReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOffError(data.error || "Failed to submit");
        return;
      }
      setShowOffForm(false);
      setOffFrom("");
      setOffTo("");
      setOffReason("");
      await fetchData();
    } catch {
      setOffError("Something went wrong");
    } finally {
      setOffSubmitting(false);
    }
  };

  // Approve/reject meal-off
  const handleMealOffAction = async (id: string, action: "approve" | "reject") => {
    setActionLoading(id);
    try {
      await fetch("/api/meal-off", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      await fetchData();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  // Cancel own meal-off
  const cancelMealOff = async (id: string) => {
    if (!confirm("Cancel this meal-off request?")) return;
    setActionLoading(id);
    try {
      await fetch(`/api/meal-off?id=${id}`, { method: "DELETE" });
      await fetchData();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  // Get meal-off requests for this month
  const monthMealOffs = mealOffs.filter((mo) => {
    const from = new Date(mo.fromDate);
    const to = new Date(mo.toDate);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    return from <= monthEnd && to >= monthStart;
  });

  const getOffForDay = (day: number) => {
    const dateObj = new Date(year, month - 1, day);
    dateObj.setHours(0, 0, 0, 0);
    return mealOffs.filter((mo) => {
      if (mo.status !== "APPROVED") return false;
      const from = new Date(mo.fromDate);
      const to = new Date(mo.toDate);
      from.setHours(0, 0, 0, 0);
      to.setHours(0, 0, 0, 0);
      return dateObj >= from && dateObj <= to;
    });
  };

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

        {/* Request Meal-Off Button */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowOffForm(!showOffForm)}
            className="px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-sm font-medium rounded-lg transition-colors"
          >
            {showOffForm ? "✕ Cancel" : "🏖️ Request Meal Off"}
          </button>
        </div>
      </div>

      {/* Meal-Off Request Form */}
      {showOffForm && (
        <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold text-amber-900">🏖️ Request Meal Off</h2>
          <p className="text-sm text-amber-700">
            Going on vacation or won't eat? Request up to 7 days off. The manager will approve it.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={offFrom}
                min={today}
                onChange={(e) => {
                  setOffFrom(e.target.value);
                  if (offTo && e.target.value > offTo) setOffTo(e.target.value);
                }}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={offTo}
                min={offFrom || today}
                onChange={(e) => setOffTo(e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <input
              type="text"
              value={offReason}
              onChange={(e) => setOffReason(e.target.value)}
              placeholder="e.g. Going home for Eid"
              className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"
            />
          </div>
          {offError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">⚠️ {offError}</p>
          )}
          <button
            onClick={submitMealOff}
            disabled={offSubmitting}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {offSubmitting ? "Submitting..." : "📩 Submit Request"}
          </button>
        </div>
      )}

      {/* Pending Meal-Off Requests (Manager sees all, members see their own) */}
      {mealOffs.filter((mo) => isManager ? mo.status === "PENDING" : mo.memberId === session?.user?.id).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            {isManager ? "📋 Pending Meal-Off Requests" : "📋 My Meal-Off Requests"}
          </h2>
          <div className="space-y-3">
            {mealOffs
              .filter((mo) => isManager ? mo.status === "PENDING" : mo.memberId === session?.user?.id)
              .map((mo) => {
                const from = new Date(mo.fromDate);
                const to = new Date(mo.toDate);
                const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                return (
                  <div
                    key={mo.id}
                    className={`p-4 rounded-lg border ${
                      mo.status === "PENDING"
                        ? "bg-yellow-50 border-yellow-200"
                        : mo.status === "APPROVED"
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">
                          {mo.member.name}
                          <span className="ml-2 text-sm text-gray-500">
                            {from.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            {days > 1 && ` → ${to.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                            {" "}({days} day{days > 1 ? "s" : ""})
                          </span>
                        </p>
                        {mo.reason && (
                          <p className="text-sm text-gray-500 mt-0.5">💬 {mo.reason}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {mo.status === "PENDING" && "⏳ Waiting for manager approval"}
                          {mo.status === "APPROVED" && `✅ Approved ${mo.reviewedAt ? new Date(mo.reviewedAt).toLocaleDateString() : ""}`}
                          {mo.status === "REJECTED" && `❌ Rejected ${mo.reviewedAt ? new Date(mo.reviewedAt).toLocaleDateString() : ""}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {/* Manager: approve/reject pending */}
                        {isManager && mo.status === "PENDING" && (
                          <>
                            <button
                              onClick={() => handleMealOffAction(mo.id, "approve")}
                              disabled={actionLoading === mo.id}
                              className="px-3 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                              {actionLoading === mo.id ? "..." : "✅ Approve"}
                            </button>
                            <button
                              onClick={() => handleMealOffAction(mo.id, "reject")}
                              disabled={actionLoading === mo.id}
                              className="px-3 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                              ❌ Reject
                            </button>
                          </>
                        )}
                        {/* Member: cancel own pending */}
                        {!isManager && mo.status === "PENDING" && mo.memberId === session?.user?.id && (
                          <button
                            onClick={() => cancelMealOff(mo.id)}
                            disabled={actionLoading === mo.id}
                            className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Approved Meal-Offs This Month */}
      {monthMealOffs.filter((mo) => mo.status === "APPROVED").length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">🏖️ Approved Meal-Offs This Month</h2>
          <div className="flex flex-wrap gap-2">
            {monthMealOffs
              .filter((mo) => mo.status === "APPROVED")
              .map((mo) => {
                const from = new Date(mo.fromDate);
                const to = new Date(mo.toDate);
                const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                return (
                  <div key={mo.id} className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm">
                    <span className="font-medium text-green-800">{mo.member.name}</span>
                    <span className="text-green-600 ml-1">
                      {from.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {days > 1 && ` → ${to.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

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
          const offMembers = getOffForDay(day);
          const hasPlan = plan?.breakfast || plan?.lunch || plan?.dinner;
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
                  {offMembers.length > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      🏖️ {offMembers.map((m) => m.member.name).join(", ")} off
                    </span>
                  )}
                  {isManager && !isEditing && (
                    <span className="text-xs text-gray-400 hidden sm:inline">tap to edit</span>
                  )}
                </div>
              </div>

              {/* Editing Form */}
              {isEditing && isManager ? (
                <div className="p-4 space-y-3 bg-indigo-50/30">
                  {(["breakfast", "lunch", "dinner"] as const).map((meal) => (
                    <div key={meal} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <label className="text-sm font-medium text-gray-600 capitalize w-20 shrink-0">
                        {meal === "breakfast" ? "🌅 Breakfast" : meal === "lunch" ? "☀️ Lunch" : "🌙 Dinner"}
                      </label>
                      <input
                        type="text"
                        value={editForm[meal]}
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
              ) : hasPlan ? (
                <div className="px-4 py-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {plan?.breakfast && (
                      <div className="flex items-start gap-2">
                        <span className="text-base">🌅</span>
                        <div>
                          <p className="text-xs text-gray-400 font-medium">Breakfast</p>
                          <p className="text-sm text-gray-800">{plan.breakfast}</p>
                        </div>
                      </div>
                    )}
                    {plan?.lunch && (
                      <div className="flex items-start gap-2">
                        <span className="text-base">☀️</span>
                        <div>
                          <p className="text-xs text-gray-400 font-medium">Lunch</p>
                          <p className="text-sm text-gray-800">{plan.lunch}</p>
                        </div>
                      </div>
                    )}
                    {plan?.dinner && (
                      <div className="flex items-start gap-2">
                        <span className="text-base">🌙</span>
                        <div>
                          <p className="text-xs text-gray-400 font-medium">Dinner</p>
                          <p className="text-sm text-gray-800">{plan.dinner}</p>
                        </div>
                      </div>
                    )}
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
