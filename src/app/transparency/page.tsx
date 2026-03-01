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

interface DepositEntry {
  id: string;
  date: string;
  amount: number;
  member: { id: string; name: string };
}

export default function TransparencyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [deposits, setDeposits] = useState<DepositEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      const now = new Date();
      const m = now.getMonth() + 1;
      const y = now.getFullYear();
      Promise.all([
        fetch(`/api/meals?month=${m}&year=${y}`).then((r) => r.json()),
        fetch(`/api/deposits?month=${m}&year=${y}`).then((r) => r.json()),
      ]).then(([mealData, depositData]) => {
        setMeals(mealData);
        setDeposits(depositData);
        setLoading(false);
      });
    }
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Group meals by member
  const memberNames = [...new Set(meals.map((m) => m.member.name))];
  const mealsByMember = memberNames.map((name) => {
    const memberMeals = meals.filter((m) => m.member.name === name);
    const totalMeals = memberMeals.reduce((sum, m) => sum + m.total, 0);
    return { name, totalMeals, entries: memberMeals };
  });

  // Group deposits by member
  const depositsByMember = memberNames.map((name) => {
    const memberDeposits = deposits.filter((d) => d.member.name === name);
    const totalDeposit = memberDeposits.reduce((sum, d) => sum + d.amount, 0);
    return { name, totalDeposit, entries: memberDeposits };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">👁️ Transparency Board</h1>
      <p className="text-gray-500">All members can see everyone&apos;s meal counts and deposits for full transparency.</p>

      {/* Meal Count Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <h2 className="p-4 text-lg font-semibold text-gray-800 border-b">🍛 Meal Counts (This Month)</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Member</th>
              <th className="text-center p-3">Total Meals</th>
            </tr>
          </thead>
          <tbody>
            {mealsByMember.map((m) => (
              <tr key={m.name} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{m.name}</td>
                <td className="p-3 text-center font-bold text-indigo-600">{m.totalMeals}</td>
              </tr>
            ))}
            <tr className="border-t bg-gray-50 font-bold">
              <td className="p-3">Total</td>
              <td className="p-3 text-center text-indigo-700">
                {mealsByMember.reduce((sum, m) => sum + m.totalMeals, 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Deposit Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <h2 className="p-4 text-lg font-semibold text-gray-800 border-b">💰 Deposits (This Month)</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Member</th>
              <th className="text-right p-3">Total Deposited</th>
            </tr>
          </thead>
          <tbody>
            {depositsByMember.map((d) => (
              <tr key={d.name} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{d.name}</td>
                <td className="p-3 text-right font-bold text-green-600">৳{d.totalDeposit}</td>
              </tr>
            ))}
            <tr className="border-t bg-gray-50 font-bold">
              <td className="p-3">Total</td>
              <td className="p-3 text-right text-green-700">
                ৳{depositsByMember.reduce((sum, d) => sum + d.totalDeposit, 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
