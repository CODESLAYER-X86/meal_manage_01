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
  breakfast: number;
  lunch: number;
  dinner: number;
}

export default function MealEntryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [entries, setEntries] = useState<MealForm[]>([]);
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
    const [membersRes, mealsRes] = await Promise.all([
      fetch("/api/members"),
      fetch(`/api/meals?date=${date}`),
    ]);
    const members: Member[] = await membersRes.json();
    const existingMeals = await mealsRes.json();

    setEntries(
      members.map((m) => {
        const existing = existingMeals.find(
          (e: { member: { id: string } }) => e.member.id === m.id
        );
        return {
          memberId: m.id,
          memberName: m.name,
          breakfast: existing?.breakfast || 0,
          lunch: existing?.lunch || 0,
          dinner: existing?.dinner || 0,
        };
      })
    );
  };

  const updateEntry = (index: number, field: "breakfast" | "lunch" | "dinner", value: number) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    setEntries(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess("");
    await fetch("/api/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, entries }),
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

      {/* Meal Entry Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4 text-sm font-semibold text-gray-600">Member</th>
              <th className="text-center p-4 text-sm font-semibold text-gray-600">Breakfast</th>
              <th className="text-center p-4 text-sm font-semibold text-gray-600">Lunch</th>
              <th className="text-center p-4 text-sm font-semibold text-gray-600">Dinner</th>
              <th className="text-center p-4 text-sm font-semibold text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={entry.memberId} className="border-t hover:bg-gray-50">
                <td className="p-4 font-medium text-gray-700">{entry.memberName}</td>
                {(["breakfast", "lunch", "dinner"] as const).map((field) => (
                  <td key={field} className="p-4 text-center">
                    <select
                      value={entry[field]}
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
                  {entry.breakfast + entry.lunch + entry.dinner}
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
