"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Rating {
  id: string;
  date: string;
  meal: string;
  rating: number;
  comment: string | null;
  memberId: string;
  member: { id: string; name: string };
}

interface MealPlan {
  id: string;
  date: string;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
}

const MEALS = ["breakfast", "lunch", "dinner"] as const;
const MEAL_ICONS: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙" };
const STARS = [1, 2, 3, 4, 5];

export default function MealRatingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  // Monthly avg
  const [month] = useState(today.getMonth() + 1);
  const [year] = useState(today.getFullYear());
  const [monthlyRatings, setMonthlyRatings] = useState<Rating[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchDay = useCallback(async () => {
    setLoading(true);
    try {
      const [ratingsRes, planRes] = await Promise.all([
        fetch(`/api/meal-rating?date=${selectedDate}`),
        fetch(`/api/meal-plan?date=${selectedDate}`),
      ]);
      const ratingsData = await ratingsRes.json();
      const planData = await planRes.json();
      setRatings(Array.isArray(ratingsData) ? ratingsData : []);
      setPlan(planData?.id ? planData : null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const fetchMonthly = useCallback(async () => {
    try {
      const res = await fetch(`/api/meal-rating?month=${month}&year=${year}`);
      const data = await res.json();
      setMonthlyRatings(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  }, [month, year]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchDay();
      fetchMonthly();
    }
  }, [status, fetchDay, fetchMonthly]);

  const rate = async (meal: string, rating: number, comment?: string) => {
    setSubmitting(meal);
    try {
      await fetch("/api/meal-rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, meal, rating, comment }),
      });
      await fetchDay();
      await fetchMonthly();
    } catch {
      // ignore
    } finally {
      setSubmitting(null);
    }
  };

  // Calculate averages per meal for the month
  const mealAvgs: Record<string, { avg: number; count: number }> = {};
  for (const meal of MEALS) {
    const mealRatings = monthlyRatings.filter((r) => r.meal === meal);
    const sum = mealRatings.reduce((s, r) => s + r.rating, 0);
    mealAvgs[meal] = { avg: mealRatings.length > 0 ? sum / mealRatings.length : 0, count: mealRatings.length };
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border border-white/10 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-white">⭐ Meal Ratings</h1>
        <p className="text-sm text-slate-400 mt-0.5">Rate today&apos;s or yesterday&apos;s meals (1-5 stars)</p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setSelectedDate(todayStr)}
            className={`px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${selectedDate === todayStr ? "bg-indigo-600 text-white" : "bg-gray-100 text-slate-300 hover:bg-gray-200"
              }`}
          >
            Today
          </button>
          <button
            onClick={() => setSelectedDate(yesterdayStr)}
            className={`px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${selectedDate === yesterdayStr ? "bg-indigo-600 text-white" : "bg-gray-100 text-slate-300 hover:bg-gray-200"
              }`}
          >
            Yesterday
          </button>
        </div>
      </div>

      {/* Rate Each Meal */}
      <div className="space-y-3">
        {MEALS.map((meal) => {
          const menuItem = plan?.[meal];
          const myRating = ratings.find((r) => r.meal === meal && r.memberId === session?.user?.id);
          const allRatings = ratings.filter((r) => r.meal === meal);
          const avgRating = allRatings.length > 0 ? allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length : 0;

          return (
            <div key={meal} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border border-white/10 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{MEAL_ICONS[meal]}</span>
                  <h3 className="text-base font-semibold text-white capitalize">{meal}</h3>
                </div>
                {allRatings.length > 0 && (
                  <span className="text-sm text-slate-400">
                    Avg: {"⭐".repeat(Math.round(avgRating))} ({avgRating.toFixed(1)})
                  </span>
                )}
              </div>

              {menuItem && (
                <p className="text-sm text-slate-400 mb-3">🍽️ {menuItem}</p>
              )}

              {/* Star Buttons */}
              <div className="flex items-center gap-1 mb-2">
                {STARS.map((star) => (
                  <button
                    key={star}
                    onClick={() => rate(meal, star)}
                    disabled={submitting === meal}
                    className={`p-1.5 text-2xl transition-transform hover:scale-110 ${myRating && myRating.rating >= star ? "opacity-100" : "opacity-30"
                      } ${submitting === meal ? "opacity-50" : ""}`}
                    title={`${star} star${star > 1 ? "s" : ""}`}
                  >
                    ⭐
                  </button>
                ))}
                {myRating && (
                  <span className="ml-2 text-sm text-indigo-600 font-medium">
                    Your rating: {myRating.rating}/5
                  </span>
                )}
              </div>

              {/* Other people's ratings */}
              {allRatings.length > 0 && (
                <div className="mt-2 space-y-1">
                  {allRatings.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-medium text-slate-300">{r.member.name}</span>
                      <span>{"⭐".repeat(r.rating)}</span>
                      {r.comment && <span className="text-slate-400">— {r.comment}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Monthly Average */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border border-white/10 p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-white mb-3">📊 Monthly Average</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {MEALS.map((meal) => {
            const { avg, count } = mealAvgs[meal];
            return (
              <div key={meal} className="text-center">
                <p className="text-sm text-slate-400 capitalize">{MEAL_ICONS[meal]} {meal}</p>
                <p className="text-xl font-bold text-indigo-600">{avg > 0 ? avg.toFixed(1) : "—"}</p>
                <p className="text-xs text-slate-400">{count} rating{count !== 1 ? "s" : ""}</p>
                {avg > 0 && (
                  <div className="flex justify-center gap-0.5 mt-1">
                    {STARS.map((s) => (
                      <span key={s} className={`text-xs ${s <= Math.round(avg) ? "opacity-100" : "opacity-20"}`}>⭐</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
