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
}

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [bazarTrips, setBazarTrips] = useState<BazarTrip[]>([]);
  const [washroomCleanings, setWashroomCleanings] = useState<WashroomEntry[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlanEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      setLoading(true);
      const m = currentMonth + 1;
      const safeFetch = (url: string) => fetch(url).then((r) => r.ok ? r.json() : null).catch(() => null);
      Promise.all([
        safeFetch(`/api/meals?month=${m}&year=${currentYear}`),
        safeFetch(`/api/bazar?month=${m}&year=${currentYear}`),
        safeFetch(`/api/washroom?month=${m}&year=${currentYear}`),
        safeFetch(`/api/meal-plan?month=${m}&year=${currentYear}`),
      ]).then(([mealData, bazarData, washroomData, planData]) => {
        setMeals(Array.isArray(mealData) ? mealData : []);
        setBazarTrips(Array.isArray(bazarData?.trips) ? bazarData.trips : []);
        setWashroomCleanings(Array.isArray(washroomData?.cleanings) ? washroomData.cleanings : []);
        setMealPlans(Array.isArray(planData) ? planData : []);
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
      <h1 className="text-2xl font-bold text-gray-800">📅 Meal Calendar</h1>

      {/* Month Navigation */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border">
        <button onClick={prevMonth} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
          ← Prev
        </button>
        <h2 className="text-lg font-semibold text-gray-800">{monthName}</h2>
        <button onClick={nextMonth} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
          Next →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="p-1.5 sm:p-3 text-center text-xs sm:text-sm font-medium text-gray-500 border-b">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {/* Empty cells */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="p-1 sm:p-3 border-b border-r min-h-[52px] sm:min-h-[80px] bg-gray-50" />
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
                className={`p-1 sm:p-2 border-b border-r min-h-[52px] sm:min-h-[80px] cursor-pointer transition hover:bg-indigo-50 ${
                  isSelected ? "bg-indigo-100 ring-2 ring-indigo-400" : ""
                }`}
              >
                <div className="text-xs sm:text-sm font-medium text-gray-700">{day}</div>
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
        <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">
            📋 {monthName.split(" ")[0]} {selectedDate}, {currentYear}
          </h3>

          {/* Menu / Meal Plan */}
          <div>
            <h4 className="text-sm font-semibold text-gray-600 mb-2">📋 Menu</h4>
            {selectedPlan && (selectedPlan.breakfast || selectedPlan.lunch || selectedPlan.dinner) ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {selectedPlan.breakfast && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-600 mb-1">🌅 Breakfast</p>
                    <p className="text-sm text-gray-800">{selectedPlan.breakfast}</p>
                  </div>
                )}
                {selectedPlan.lunch && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-orange-600 mb-1">☀️ Lunch</p>
                    <p className="text-sm text-gray-800">{selectedPlan.lunch}</p>
                  </div>
                )}
                {selectedPlan.dinner && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-indigo-600 mb-1">🌙 Dinner</p>
                    <p className="text-sm text-gray-800">{selectedPlan.dinner}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No menu set for this day</p>
            )}
          </div>

          {/* Meals */}
          <div>
            <h4 className="text-sm font-semibold text-gray-600 mb-2">🍛 Meals</h4>
            {selectedMeals.length === 0 ? (
              <p className="text-sm text-gray-400">No meals recorded</p>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden space-y-2">
                  {selectedMeals.map((m) => (
                    <div key={m.id} className="bg-gray-50 rounded-lg p-3">
                      <p className="font-medium text-gray-900 text-sm mb-1">{m.member.name}</p>
                      <div className="grid grid-cols-4 gap-2 text-xs text-center">
                        <div><p className="text-gray-400">B</p><p className="font-bold">{m.breakfast}</p></div>
                        <div><p className="text-gray-400">L</p><p className="font-bold">{m.lunch}</p></div>
                        <div><p className="text-gray-400">D</p><p className="font-bold">{m.dinner}</p></div>
                        <div><p className="text-gray-400">Total</p><p className="font-bold text-indigo-600">{m.total}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-2">Member</th>
                        <th className="text-center p-2">Breakfast</th>
                        <th className="text-center p-2">Lunch</th>
                        <th className="text-center p-2">Dinner</th>
                        <th className="text-center p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMeals.map((m) => (
                        <tr key={m.id} className="border-t">
                          <td className="p-2 font-medium">{m.member.name}</td>
                          <td className="text-center p-2">{m.breakfast}</td>
                          <td className="text-center p-2">{m.lunch}</td>
                          <td className="text-center p-2">{m.dinner}</td>
                          <td className="text-center p-2 font-bold">{m.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Bazar Items */}
          <div>
            <h4 className="text-sm font-semibold text-gray-600 mb-2">🛒 Bazar / Market Purchases</h4>
            {selectedBazar.length === 0 ? (
              <p className="text-sm text-gray-400">No market purchases</p>
            ) : (
              selectedBazar.map((trip) => (
                <div key={trip.id} className="mb-3 p-3 bg-orange-50 rounded-lg">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Buyer: {trip.buyer.name}</span>
                    <span className="font-bold text-orange-700">৳{trip.totalCost}</span>
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-orange-100">
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
                        <tr key={item.serialNo} className="border-t border-orange-200">
                          <td className="p-1.5">{item.serialNo}</td>
                          <td className="p-1.5">{item.itemName}</td>
                          <td className="text-center p-1.5">{item.quantity}</td>
                          <td className="text-center p-1.5">{item.unit}</td>
                          <td className="text-right p-1.5">৳{item.price}</td>
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
            <h4 className="text-sm font-semibold text-gray-600 mb-2">🚿 Washroom Cleaning</h4>
            {selectedWashroom.length === 0 ? (
              <p className="text-sm text-gray-400">No washroom cleaning</p>
            ) : (
              <div className="space-y-1">
                {selectedWashroom.map((w) => (
                  <div key={w.id} className="flex items-center gap-2 text-sm bg-teal-50 rounded-lg p-2">
                    <span className="text-xs font-medium bg-teal-100 text-teal-700 px-2 py-0.5 rounded">WR-{w.washroomNumber}</span>
                    <span className="text-gray-700">{w.member.name}</span>
                    <span className="ml-auto text-xs text-green-600 font-bold">✅ Done</span>
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
