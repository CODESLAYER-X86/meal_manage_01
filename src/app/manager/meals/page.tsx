"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  name: string;
}

interface MealForm {
  memberId: string;
  memberName: string;
  entryId: string | null;
  meals: Record<string, number>;
}

export default function MealEntryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [entries, setEntries] = useState<MealForm[]>([]);
  const [mealTypes, setMealTypes] = useState<string[]>(["breakfast", "lunch", "dinner"]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user?.role !== "MANAGER") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status === "authenticated") {
      loadData();
    }
  }, [status, date]);

  const loadData = async () => {
    const [membersRes, mealsRes, messRes] = await Promise.all([
      fetch("/api/members"),
      fetch(`/api/meals?date=${date}`),
      fetch("/api/mess"),
    ]);
    const members: Member[] = await membersRes.json();
    const existingMeals = await mealsRes.json();
    const messData = await messRes.json();

    // Parse meal types from mess config
    let types = ["breakfast", "lunch", "dinner"];
    try {
      const parsed = JSON.parse(messData.mess?.mealTypes || '["breakfast","lunch","dinner"]');
      if (Array.isArray(parsed) && parsed.length > 0) types = parsed;
    } catch { /* use default */ }
    setMealTypes(types);

    setEntries(
      members.map((m) => {
        const existing = existingMeals.find(
          (e: { member: { id: string } }) => e.member.id === m.id
        );
        // Build meals object from existing data (try JSON meals field first, then legacy columns)
        const mealsObj: Record<string, number> = {};
        let existingMealsJson: Record<string, number> = {};
        if (existing?.meals) {
          try { existingMealsJson = JSON.parse(existing.meals); } catch { /* ignore */ }
        }
        for (const mt of types) {
          mealsObj[mt] = existingMealsJson[mt] ?? (existing as Record<string, number>)?.[mt] ?? 0;
        }
        return {
          memberId: m.id,
          memberName: m.name,
          entryId: existing?.id ?? null,
          meals: mealsObj,
        };
      })
    );
  };

  const updateEntry = (index: number, field: string, value: number) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], meals: { ...updated[index].meals, [field]: value } };
    setEntries(updated);
  };

  const deleteMeal = async (index: number) => {
    const entry = entries[index];
    if (!entry.entryId) return;
    if (!confirm(`Clear all meals for ${entry.memberName} on ${date}?`)) return;
    const res = await fetch(`/api/meals?id=${entry.entryId}`, { method: "DELETE" });
    if (res.ok) {
      setSuccess(`${entry.memberName}'s meal entry deleted.`);
      setTimeout(() => setSuccess(""), 3000);
      loadData();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess("");
    await fetch("/api/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        entries: entries.map((e) => ({ memberId: e.memberId, meals: e.meals })),
      }),
    });
    setSaving(false);
    setSuccess("Meals saved successfully!");
    setTimeout(() => setSuccess(""), 3000);
  };

  if (status === "loading") return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">✏️ Enter Daily Meals</h1>

      {/* Date Picker */}
      <div className="bg-white p-4 rounded-xl shadow-sm border">
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      {/* Meal Entry — Mobile Cards */}
      <div className="md:hidden space-y-3">
        {entries.map((entry, i) => (
          <div key={entry.memberId} className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-800">{entry.memberName}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-indigo-600">
                  Total: {Object.values(entry.meals).reduce((s, v) => s + v, 0)}
                </span>
                {entry.entryId && (
                  <button onClick={() => deleteMeal(i)} title="Delete entry" className="text-red-400 hover:text-red-600 text-lg leading-none">🗑️</button>
                )}
              </div>
            </div>
            <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${mealTypes.length}, 1fr)` }}>
              {mealTypes.map((field) => (
                <div key={field}>
                  <label className="block text-xs text-gray-500 mb-1 text-center capitalize">{field}</label>
                  <select
                    value={entry.meals[field] ?? 0}
                    onChange={(e) => updateEntry(i, field, parseFloat(e.target.value))}
                    className="w-full px-2 py-2 border rounded-lg text-center text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Meal Entry — Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4 text-sm font-semibold text-gray-600">Member</th>
              {mealTypes.map((mt) => (
                <th key={mt} className="text-center p-4 text-sm font-semibold text-gray-600 capitalize">{mt}</th>
              ))}
              <th className="text-center p-4 text-sm font-semibold text-gray-600">Total</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={entry.memberId} className="border-t hover:bg-gray-50">
                <td className="p-4 font-medium text-gray-700">{entry.memberName}</td>
                {mealTypes.map((field) => (
                  <td key={field} className="p-4 text-center">
                    <select
                      value={entry.meals[field] ?? 0}
                      onChange={(e) => updateEntry(i, field, parseFloat(e.target.value))}
                      className="px-3 py-1.5 border rounded-lg text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </td>
                ))}
                <td className="p-4 text-center font-bold text-indigo-600">
                  {Object.values(entry.meals).reduce((s, v) => s + v, 0)}
                </td>
                <td className="p-4 text-center">
                  {entry.entryId && (
                    <button onClick={() => deleteMeal(i)} title="Delete entry" className="text-red-400 hover:text-red-600">🗑️</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "💾 Save Meals"}
        </button>
        {success && (
          <span className="text-green-600 text-sm font-medium">{success}</span>
        )}
      </div>
    </div>
  );
}
