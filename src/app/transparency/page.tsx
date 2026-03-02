"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  name: string;
}

interface MealEntry {
  id: string;
  date: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  total: number;
  member: Member;
}

interface DepositEntry {
  id: string;
  date: string;
  amount: number;
  member: Member;
}

interface BillPayment {
  id: string;
  amount: number;
  confirmed: boolean;
  member: Member;
}

interface WashroomDuty {
  id: string;
  date: string;
  washroomNumber: number;
  status: string;
  confirmedByManager: boolean;
  member: Member;
}

interface BazarDutyEntry {
  id: string;
  date: string;
  status: string;
  member: Member;
}

interface DutyDebtEntry {
  id: string;
  dutyType: string;
  status: string;
  owedBy: Member;
  owedTo: Member;
}

export default function TransparencyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [deposits, setDeposits] = useState<DepositEntry[]>([]);
  const [billPayments, setBillPayments] = useState<BillPayment[]>([]);
  const [memberBills, setMemberBills] = useState<Record<string, number>>({});
  const [washroomDuties, setWashroomDuties] = useState<WashroomDuty[]>([]);
  const [bazarDuties, setBazarDuties] = useState<BazarDutyEntry[]>([]);
  const [dutyDebts, setDutyDebts] = useState<DutyDebtEntry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [bazarTrips, setBazarTrips] = useState<{ totalCost: number; buyerId: string }[]>([]);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);

    Promise.all([
      fetch(`/api/meals?month=${month}&year=${year}`).then((r) => r.json()),
      fetch(`/api/deposits?month=${month}&year=${year}`).then((r) => r.json()),
      fetch(`/api/bill-payments?month=${month}&year=${year}`).then((r) => r.json()),
      fetch(`/api/washroom?month=${month}&year=${year}`).then((r) => r.json()),
      fetch(`/api/bazar-duty?month=${month}&year=${year}`).then((r) => r.json()),
      fetch(`/api/duty-debt?status=PENDING`).then((r) => r.json()),
      fetch(`/api/bazar?month=${month}&year=${year}`).then((r) => r.json()),
    ]).then(([mealData, depositData, billData, washroomData, bazarDutyData, debtData, bazarData]) => {
      setMeals(Array.isArray(mealData) ? mealData : []);
      setDeposits(Array.isArray(depositData) ? depositData : []);
      setBillPayments(billData?.payments || []);
      setMemberBills(billData?.memberBills || {});
      setMembers(billData?.members || []);
      setWashroomDuties(washroomData?.duties || []);
      setBazarDuties(bazarDutyData?.duties || []);
      setDutyDebts(debtData?.debts || []);
      setBazarTrips(Array.isArray(bazarData) ? bazarData : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [status, month, year]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // ---- Computed data ----
  const memberNames = members.length > 0 ? members : [...new Map(meals.map((m) => [m.member.id, m.member])).values()];
  const totalBazar = bazarTrips.reduce((sum, t) => sum + t.totalCost, 0);
  const totalAllMeals = meals.reduce((sum, m) => sum + m.total, 0);
  const mealRate = totalAllMeals > 0 ? totalBazar / totalAllMeals : 0;

  // Build scorecard per member
  const scorecard = memberNames.map((m) => {
    const id = m.id;
    const name = m.name;

    // Meals
    const memberMeals = meals.filter((e) => e.member.id === id);
    const totalMealsCount = memberMeals.reduce((sum, e) => sum + e.total, 0);
    const mealCost = totalMealsCount * mealRate;

    // Deposits
    const memberDeposits = deposits.filter((d) => d.member.id === id);
    const totalDeposit = memberDeposits.reduce((sum, d) => sum + d.amount, 0);
    const mealDue = mealCost - totalDeposit;

    // Bills
    const billDue = memberBills[id] || 0;
    const memberPayments = billPayments.filter((p) => p.member.id === id);
    const billPaid = memberPayments.filter((p) => p.confirmed).reduce((sum, p) => sum + p.amount, 0);
    const billRemaining = billDue - billPaid;

    // Washroom
    const washroomTotal = washroomDuties.filter((d) => d.member.id === id).length;
    const washroomDone = washroomDuties.filter((d) => d.member.id === id && d.status === "DONE").length;
    const washroomConfirmed = washroomDuties.filter((d) => d.member.id === id && d.confirmedByManager).length;

    // Bazar
    const bazarTotal = bazarDuties.filter((d) => d.member.id === id).length;
    const bazarDone = bazarDuties.filter((d) => d.member.id === id && d.status === "DONE").length;

    // Debts
    const debtsOwed = dutyDebts.filter((d) => d.owedBy.id === id).length;
    const debtsCovered = dutyDebts.filter((d) => d.owedTo.id === id).length;

    return {
      id, name, totalMealsCount, mealCost, totalDeposit, mealDue,
      billDue, billPaid, billRemaining,
      washroomTotal, washroomDone, washroomConfirmed,
      bazarTotal, bazarDone, debtsOwed, debtsCovered,
    };
  });

  const monthName = now.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">👁️ Transparency Board</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{monthName} — Full accountability view for all members</p>
      </div>

      {/* Overall Scorecard */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-x-auto">
        <h2 className="p-4 text-lg font-semibold text-gray-800 dark:text-gray-100 border-b dark:border-gray-700">📊 Member Scorecard</h2>
        <table className="w-full text-xs sm:text-sm min-w-[700px]">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="text-left p-2 sm:p-3">Member</th>
              <th className="text-center p-2 sm:p-3">Meals</th>
              <th className="text-right p-2 sm:p-3">Meal Cost</th>
              <th className="text-right p-2 sm:p-3">Deposits</th>
              <th className="text-right p-2 sm:p-3">Meal Due</th>
              <th className="text-right p-2 sm:p-3">Bill Due</th>
              <th className="text-right p-2 sm:p-3">Bill Paid</th>
              <th className="text-center p-2 sm:p-3">WC</th>
              <th className="text-center p-2 sm:p-3">Bazar</th>
              <th className="text-center p-2 sm:p-3">Debts</th>
            </tr>
          </thead>
          <tbody>
            {scorecard.map((s) => (
              <tr key={s.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="p-2 sm:p-3 font-medium text-gray-800 dark:text-gray-200">{s.name}</td>
                <td className="p-2 sm:p-3 text-center">{s.totalMealsCount}</td>
                <td className="p-2 sm:p-3 text-right">৳{s.mealCost.toFixed(0)}</td>
                <td className="p-2 sm:p-3 text-right text-green-600">৳{s.totalDeposit.toFixed(0)}</td>
                <td className={`p-2 sm:p-3 text-right font-bold ${s.mealDue > 0 ? "text-red-600" : "text-green-600"}`}>
                  ৳{s.mealDue.toFixed(0)}
                </td>
                <td className="p-2 sm:p-3 text-right">৳{s.billDue.toFixed(0)}</td>
                <td className={`p-2 sm:p-3 text-right ${s.billRemaining > 0 ? "text-red-600" : "text-green-600"}`}>
                  ৳{s.billPaid.toFixed(0)}
                </td>
                <td className="p-2 sm:p-3 text-center">
                  <span className={s.washroomDone === s.washroomTotal && s.washroomTotal > 0 ? "text-green-600" : "text-gray-600 dark:text-gray-400"}>
                    {s.washroomDone}/{s.washroomTotal}
                  </span>
                </td>
                <td className="p-2 sm:p-3 text-center">
                  <span className={s.bazarDone === s.bazarTotal && s.bazarTotal > 0 ? "text-green-600" : "text-gray-600 dark:text-gray-400"}>
                    {s.bazarDone}/{s.bazarTotal}
                  </span>
                </td>
                <td className="p-2 sm:p-3 text-center">
                  {s.debtsOwed > 0 && <span className="text-red-500 text-xs">⬆{s.debtsOwed}</span>}
                  {s.debtsCovered > 0 && <span className="text-green-500 text-xs ml-1">⬇{s.debtsCovered}</span>}
                  {s.debtsOwed === 0 && s.debtsCovered === 0 && <span className="text-gray-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {mealRate > 0 && (
          <div className="p-3 border-t dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            Meal rate: ৳{mealRate.toFixed(2)}/meal | Total bazar: ৳{totalBazar.toFixed(0)} | Total meals: {totalAllMeals}
          </div>
        )}
      </div>

      {/* Bill Payment Status */}
      {Object.keys(memberBills).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
          <h2 className="p-4 text-lg font-semibold text-gray-800 dark:text-gray-100 border-b dark:border-gray-700">💳 Bill Payment Status</h2>
          <div className="divide-y dark:divide-gray-700">
            {scorecard.map((s) => {
              const pct = s.billDue > 0 ? Math.min((s.billPaid / s.billDue) * 100, 100) : 0;
              return (
                <div key={s.id} className="p-3 sm:p-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{s.name}</span>
                    <span className={`text-xs font-bold ${s.billRemaining <= 0 ? "text-green-600" : "text-red-600"}`}>
                      {s.billRemaining <= 0 ? "✅ Paid" : `৳${s.billRemaining.toFixed(0)} remaining`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${s.billRemaining <= 0 ? "bg-green-500" : "bg-orange-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>Paid: ৳{s.billPaid.toFixed(0)}</span>
                    <span>Due: ৳{s.billDue.toFixed(0)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Washroom Duty Status */}
      {washroomDuties.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
          <h2 className="p-4 text-lg font-semibold text-gray-800 dark:text-gray-100 border-b dark:border-gray-700">🚿 Washroom Duty Status</h2>
          <div className="divide-y dark:divide-gray-700">
            {washroomDuties.map((d) => (
              <div key={d.id} className="p-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-500 dark:text-gray-400 text-xs w-20">{new Date(d.date).toLocaleDateString()}</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{d.member.name}</span>
                <span className="text-xs text-gray-400">WC#{d.washroomNumber}</span>
                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                  d.status === "DONE"
                    ? d.confirmedByManager ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                    : d.status === "SKIPPED" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                }`}>
                  {d.status === "DONE" && d.confirmedByManager ? "✅ Confirmed" : d.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bazar Duty Status */}
      {bazarDuties.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
          <h2 className="p-4 text-lg font-semibold text-gray-800 dark:text-gray-100 border-b dark:border-gray-700">🛒 Bazar Duty Status</h2>
          <div className="divide-y dark:divide-gray-700">
            {bazarDuties.map((d) => (
              <div key={d.id} className="p-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-500 dark:text-gray-400 text-xs w-20">{new Date(d.date).toLocaleDateString()}</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{d.member.name}</span>
                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                  d.status === "DONE" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : d.status === "SKIPPED" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                }`}>
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duty Debts */}
      {dutyDebts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
          <h2 className="p-4 text-lg font-semibold text-gray-800 dark:text-gray-100 border-b dark:border-gray-700">⚖️ Pending Duty Debts</h2>
          <div className="divide-y dark:divide-gray-700">
            {dutyDebts.map((d) => (
              <div key={d.id} className="p-3 text-sm flex flex-wrap items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  d.dutyType === "WASHROOM" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                }`}>
                  {d.dutyType}
                </span>
                <span className="text-red-600 font-medium">{d.owedBy.name}</span>
                <span className="text-gray-400">→</span>
                <span className="text-green-600 font-medium">{d.owedTo.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meal Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
        <h2 className="p-4 text-lg font-semibold text-gray-800 dark:text-gray-100 border-b dark:border-gray-700">🍛 Meal Counts</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="text-left p-3">Member</th>
              <th className="text-center p-3">Total Meals</th>
              <th className="text-right p-3">Deposits</th>
            </tr>
          </thead>
          <tbody>
            {scorecard.map((s) => (
              <tr key={s.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="p-3 font-medium text-gray-800 dark:text-gray-200">{s.name}</td>
                <td className="p-3 text-center font-bold text-indigo-600 dark:text-indigo-400">{s.totalMealsCount}</td>
                <td className="p-3 text-right text-green-600">৳{s.totalDeposit.toFixed(0)}</td>
              </tr>
            ))}
            <tr className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700 font-bold">
              <td className="p-3">Total</td>
              <td className="p-3 text-center text-indigo-700 dark:text-indigo-400">
                {scorecard.reduce((sum, s) => sum + s.totalMealsCount, 0)}
              </td>
              <td className="p-3 text-right text-green-700 dark:text-green-400">
                ৳{scorecard.reduce((sum, s) => sum + s.totalDeposit, 0).toFixed(0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
