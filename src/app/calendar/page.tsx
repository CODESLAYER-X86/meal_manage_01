"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface MealEntry {
  id: string;
  date: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  meals?: string;
  total: number;
  member: { id: string; name: string };
}

interface BazarTrip {
  id: string;
  date: string;
  totalCost: number;
  buyer: { name: string };
  items: { serialNo: number; itemName: string; quantity: number; unit: string; price: number }[];
}

interface WashroomEntry {
  id: string;
  date: string;
  washroomNumber: number;
  member: { id: string; name: string };
}

interface MealPlanEntry {
  id: string;
  date: string;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  meals?: string;
}

const DEFAULT_ICONS: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snacks: "🍪", supper: "🌃" };

export default function CalendarPage() {
  const { status } = useSession();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [bazarTrips, setBazarTrips] = useState<BazarTrip[]>([]);
  const [washroomCleanings, setWashroomCleanings] = useState<WashroomEntry[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlanEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [mealTypesList, setMealTypesList] = useState<string[]>(["breakfast", "lunch", "dinner"]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true);
      const m = currentMonth + 1;
      const safeFetch = (url: string) => fetch(url).then((r) => r.ok ? r.json() : null).catch(() => null);
      Promise.all([
        safeFetch(`/api/meals?month=${m}&year=${currentYear}`),
        safeFetch(`/api/bazar?month=${m}&year=${currentYear}`),
        safeFetch(`/api/washroom?month=${m}&year=${currentYear}`),
        safeFetch(`/api/meal-plan?month=${m}&year=${currentYear}`),
        safeFetch("/api/mess"),
      ]).then(([mealData, bazarData, washroomData, planData, messData]) => {
        setMeals(Array.isArray(mealData) ? mealData : []);
        setBazarTrips(Array.isArray(bazarData?.trips) ? bazarData.trips : []);
        setWashroomCleanings(Array.isArray(washroomData?.cleanings) ? washroomData.cleanings : []);
        setMealPlans(Array.isArray(planData) ? planData : []);
        try {
          const mt = JSON.parse(messData?.mess?.mealTypes || '["breakfast","lunch","dinner"]');
          if (Array.isArray(mt) && mt.length > 0) setMealTypesList(mt);
        } catch { /* use default */ }
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [status, currentMonth, currentYear]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const monthName = new Date(currentYear, currentMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const getMealsForDate = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return meals.filter((m) => m.date.startsWith(dateStr));
  };

  const getBazarForDate = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return bazarTrips.filter((t) => t.date.startsWith(dateStr));
  };

  const getWashroomForDate = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return washroomCleanings.filter((w) => w.date.startsWith(dateStr));
  };

  const getMealPlanForDate = (day: number): MealPlanEntry | undefined => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return mealPlans.find((p) => p.date.startsWith(dateStr));
  };

  const getTotalMealsForDate = (day: number) => {
    return getMealsForDate(day).reduce((sum, m) => sum + m.total, 0);
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDate(null);
  };

  const selectedMeals = selectedDate ? getMealsForDate(selectedDate) : [];
  const selectedBazar = selectedDate ? getBazarForDate(selectedDate) : [];
  const selectedWashroom = selectedDate ? getWashroomForDate(selectedDate) : [];
  const selectedPlan = selectedDate ? getMealPlanForDate(selectedDate) : undefined;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">📅 Meal Calendar</h1>

      {/* Month Navigation */}
      <div className="flex items-center justify-between bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-4 rounded-xl shadow-md shadow-black/10 border">
        <button onClick={prevMonth} className="px-4 py-2 bg-white/[0.06] rounded-lg hover:bg-white/[0.08] transition">
          ← Prev
        </button>
        <h2 className="text-lg font-semibold text-slate-100">{monthName}</h2>
        <button onClick={nextMonth} className="px-4 py-2 bg-white/[0.06] rounded-lg hover:bg-white/[0.08] transition">
          Next →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border overflow-hidden">
        <div className="grid grid-cols-7 bg-white/[0.02]">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="p-1.5 sm:p-3 text-center text-xs sm:text-sm font-medium text-slate-400 border-b">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {/* Empty cells */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="p-1 sm:p-3 border-b border-r min-h-[52px] sm:min-h-[80px] bg-white/[0.02]" />
          ))}
          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const totalMeals = getTotalMealsForDate(day);
            const hasBazar = getBazarForDate(day).length > 0;
            const hasWashroom = getWashroomForDate(day).length > 0;
            const dayPlan = getMealPlanForDate(day);
            const hasMenu = dayPlan && (dayPlan.breakfast || dayPlan.lunch || dayPlan.dinner);
            const isSelected = selectedDate === day;

            return (
              <div
                key={day}
                onClick={() => setSelectedDate(day)}
                className={`p-1 sm:p-2 border-b border-r min-h-[52px] sm:min-h-[80px] cursor-pointer transition hover:bg-indigo-50 ${isSelected ? "bg-indigo-100 ring-2 ring-indigo-400" : ""
                  }`}
              >
                <div className="text-xs sm:text-sm font-medium text-slate-300">{day}</div>
                {totalMeals > 0 && (
                  <div className="mt-0.5 text-[10px] sm:text-xs bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded-full inline-block">
                    🍛{totalMeals}
                  </div>
                )}
                {hasBazar && (
                  <div className="mt-0.5 text-[10px] sm:text-xs bg-orange-100 text-orange-700 px-1 py-0.5 rounded-full inline-block">
                    🛒
                  </div>
                )}
                {hasWashroom && (
                  <div className="mt-0.5 text-[10px] sm:text-xs bg-teal-100 text-teal-700 px-1 py-0.5 rounded-full inline-block">
                    🚿
                  </div>
                )}
                {hasMenu && (
                  <div className="mt-0.5 text-[10px] sm:text-xs bg-purple-100 text-purple-700 px-1 py-0.5 rounded-full inline-block">
                    📋
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Detail */}
      {selectedDate && (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border p-5 space-y-4">
          <h3 className="text-lg font-semibold text-slate-100">
            📋 {monthName.split(" ")[0]} {selectedDate}, {currentYear}
          </h3>

          {/* Menu */}
          <div>
            <h4 className="text-sm font-semibold text-slate-400 mb-2">🍽️ Menu</h4>
            {selectedPlan && (selectedPlan.breakfast || selectedPlan.lunch || selectedPlan.dinner || selectedPlan.meals) ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(() => {
                  let mealsObj: Record<string, string> = {};
                  try { mealsObj = JSON.parse(selectedPlan.meals || "{}"); } catch { /* ignore */ }
                  if (Object.keys(mealsObj).length === 0) {
                    if (selectedPlan.breakfast) mealsObj.breakfast = selectedPlan.breakfast;
                    if (selectedPlan.lunch) mealsObj.lunch = selectedPlan.lunch;
                    if (selectedPlan.dinner) mealsObj.dinner = selectedPlan.dinner;
                  }
                  return mealTypesList.map((mt) => {
                    const val = mealsObj[mt];
                    if (!val) return null;
                    const colors: Record<string, string> = { breakfast: "amber", lunch: "orange", dinner: "indigo" };
                    const color = colors[mt] || "gray";
                    return (
                      <div key={mt} className={`bg-${color}-50 border border-${color}-200 rounded-lg p-3`}>
                        <p className={`text-xs font-semibold text-${color}-600 mb-1`}>{DEFAULT_ICONS[mt] || "🍽️"} <span className="capitalize">{mt}</span></p>
                        <p className="text-sm text-slate-100">{val}</p>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No menu set for this day</p>
            )}
          </div>

          {/* Meals */}
          <div>
            <h4 className="text-sm font-semibold text-slate-400 mb-2">🍛 Meal Entries</h4>
            {selectedMeals.length === 0 ? (
              <p className="text-sm text-slate-400">No meal entries</p>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden space-y-2">
                  {selectedMeals.map((m) => {
                    let mealsObj: Record<string, number> = {};
                    try { mealsObj = JSON.parse(m.meals || "{}"); } catch { /* ignore */ }
                    if (Object.keys(mealsObj).length === 0) {
                      mealsObj = { breakfast: m.breakfast, lunch: m.lunch, dinner: m.dinner };
                    }
                    return (
                      <div key={m.id} className="bg-white/[0.02] rounded-lg p-3">
                        <p className="font-medium text-white text-sm mb-1">{m.member.name}</p>
                        <div className={`grid gap-2 text-xs text-center`} style={{ gridTemplateColumns: `repeat(${mealTypesList.length + 1}, 1fr)` }}>
                          {mealTypesList.map((mt) => (
                            <div key={mt}><p className="text-slate-400 capitalize">{mt.charAt(0).toUpperCase()}</p><p className="font-bold">{mealsObj[mt] ?? 0}</p></div>
                          ))}
                          <div><p className="text-slate-400">Total</p><p className="font-bold text-indigo-600">{m.total}</p></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-white/[0.02]">
                      <tr>
                        <th className="text-left p-2">Member</th>
                        {mealTypesList.map((mt) => (
                          <th key={mt} className="text-center p-2 capitalize">{mt}</th>
                        ))}
                        <th className="text-center p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMeals.map((m) => {
                        let mealsObj: Record<string, number> = {};
                        try { mealsObj = JSON.parse(m.meals || "{}"); } catch { /* ignore */ }
                        if (Object.keys(mealsObj).length === 0) {
                          mealsObj = { breakfast: m.breakfast, lunch: m.lunch, dinner: m.dinner };
                        }
                        return (
                          <tr key={m.id} className="border-t">
                            <td className="p-2 font-medium">{m.member.name}</td>
                            {mealTypesList.map((mt) => (
                              <td key={mt} className="text-center p-2">{mealsObj[mt] ?? 0}</td>
                            ))}
                            <td className="text-center p-2 font-bold">{m.total}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Bazar Items */}
          <div>
            <h4 className="text-sm font-semibold text-slate-400 mb-2">🛒 Bazar / Market Purchases</h4>
            {selectedBazar.length === 0 ? (
              <p className="text-sm text-slate-400">No market purchases</p>
            ) : (
              selectedBazar.map((trip) => (
                <div key={trip.id} className="mb-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-slate-200">Buyer: {trip.buyer.name}</span>
                    <span className="font-bold text-orange-400">৳{trip.totalCost}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-slate-300">
                      <thead className="bg-orange-500/20 text-orange-200">
                        <tr>
                          <th className="text-left p-1.5">SL</th>
                          <th className="text-left p-1.5">Item</th>
                          <th className="text-center p-1.5">Qty</th>
                          <th className="text-center p-1.5">Unit</th>
                          <th className="text-right p-1.5">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trip.items.map((item) => (
                          <tr key={item.serialNo} className="border-t border-orange-500/20">
                            <td className="p-1.5">{item.serialNo}</td>
                            <td className="p-1.5">{item.itemName}</td>
                            <td className="text-center p-1.5">{item.quantity}</td>
                            <td className="text-center p-1.5">{item.unit}</td>
                            <td className="text-right p-1.5 text-orange-300">৳{item.price}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Washroom Cleanings */}
          <div>
            <h4 className="text-sm font-semibold text-slate-400 mb-2">🚿 Washroom Cleaning</h4>
            {selectedWashroom.length === 0 ? (
              <p className="text-sm text-slate-400">No washroom cleaning</p>
            ) : (
              <div className="space-y-1">
                {selectedWashroom.map((w) => (
                  <div key={w.id} className="flex items-center gap-2 text-sm bg-teal-500/10 border border-teal-500/20 rounded-lg p-2">
                    <span className="text-xs font-medium bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded">WR-{w.washroomNumber}</span>
                    <span className="text-slate-200">{w.member.name}</span>
                    <span className="ml-auto text-xs text-green-400 font-bold">✅ Done</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
