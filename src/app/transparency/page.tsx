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
  member: Member;
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
  const [members, setMembers] = useState<Member[]>([]);
  const [bazarTrips, setBazarTrips] = useState<{ totalCost: number; date: string; buyerId: string; buyer: { id: string; name: string }; approved: boolean; companionIds: string[] }[]>([]);
  const [bazarTripCounts, setBazarTripCounts] = useState<Record<string, number>>({});
  const [companionMap, setCompanionMap] = useState<Record<string, string>>({});

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    Promise.all([
      fetch(`/api/meals?month=${month}&year=${year}`).then((r) => r.json()),
      fetch(`/api/deposits?month=${month}&year=${year}`).then((r) => r.json()),
      fetch(`/api/bill-payments?month=${month}&year=${year}`).then((r) => r.json()),
      fetch(`/api/washroom?month=${month}&year=${year}`).then((r) => r.json()),
      fetch(`/api/bazar?month=${month}&year=${year}`).then((r) => r.json()),
    ]).then(([mealData, depositData, billData, washroomData, bazarData]) => {
      setMeals(Array.isArray(mealData) ? mealData : []);
      setDeposits(Array.isArray(depositData) ? depositData : []);
      setBillPayments(billData?.payments || []);
      setMemberBills(billData?.memberBills || {});
      setMembers(billData?.members || []);
      setWashroomDuties(washroomData?.cleanings || []);
      setBazarTrips(bazarData?.trips || []);
      setBazarTripCounts(bazarData?.tripCounts || {});
      setCompanionMap(bazarData?.companionMap || {});
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
    const washroomCount = washroomDuties.filter((d) => d.member.id === id).length;

    // Bazar (approved trip counts from API)
    const bazarTripCount = bazarTripCounts[id] || 0;

    return {
      id, name, totalMealsCount, mealCost, totalDeposit, mealDue,
      billDue, billPaid, billRemaining,
      washroomCount, bazarTripCount,
    };
  });

  const monthName = now.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 pb-8">
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border border-white/10 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-white">👁️ Transparency Board</h1>
        <p className="text-sm text-slate-400 mt-0.5">{monthName} — Full accountability view for all members</p>
      </div>

      {/* Overall Scorecard */}
      <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl shadow-md shadow-black/10 border border-white/[0.08] overflow-x-auto">
        <h2 className="p-4 text-lg font-semibold text-slate-100 text-white border-b border-white/[0.08]">📊 Member Scorecard</h2>
        <table className="w-full text-xs sm:text-sm min-w-[700px]">
          <thead className="bg-white/[0.04] ">
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
            </tr>
          </thead>
          <tbody>
            {scorecard.map((s) => (
              <tr key={s.id} className="border-t border-white/[0.08] hover:bg-white/[0.04] ">
                <td className="p-2 sm:p-3 font-medium text-slate-200">{s.name}</td>
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
                  <span className={s.washroomCount > 0 ? "text-green-600" : "text-slate-400"}>
                    {s.washroomCount}
                  </span>
                </td>
                <td className="p-2 sm:p-3 text-center">
                  <span className={s.bazarTripCount > 0 ? "text-green-600" : "text-slate-400"}>
                    {s.bazarTripCount}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {mealRate > 0 && (
          <div className="p-3 border-t border-white/[0.08] text-xs text-slate-400">
            Meal rate: ৳{mealRate.toFixed(2)}/meal | Total bazar: ৳{totalBazar.toFixed(0)} | Total meals: {totalAllMeals}
          </div>
        )}
      </div>

      {/* Bill Payment Status */}
      {Object.keys(memberBills).length > 0 && (
        <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl shadow-md shadow-black/10 border border-white/[0.08] overflow-hidden">
          <h2 className="p-4 text-lg font-semibold text-slate-100 text-white border-b border-white/[0.08]">💳 Bill Payment Status</h2>
          <div className="divide-y divide-white/[0.06]">
            {scorecard.map((s) => {
              const pct = s.billDue > 0 ? Math.min((s.billPaid / s.billDue) * 100, 100) : 0;
              return (
                <div key={s.id} className="p-3 sm:p-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-sm text-slate-200">{s.name}</span>
                    <span className={`text-xs font-bold ${s.billRemaining <= 0 ? "text-green-600" : "text-red-600"}`}>
                      {s.billRemaining <= 0 ? "✅ Paid" : `৳${s.billRemaining.toFixed(0)} remaining`}
                    </span>
                  </div>
                  <div className="w-full bg-white/[0.08]  rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${s.billRemaining <= 0 ? "bg-green-500" : "bg-orange-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>Paid: ৳{s.billPaid.toFixed(0)}</span>
                    <span>Due: ৳{s.billDue.toFixed(0)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Washroom Cleaning Log */}
      {washroomDuties.length > 0 && (
        <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl shadow-md shadow-black/10 border border-white/[0.08] overflow-hidden">
          <h2 className="p-4 text-lg font-semibold text-slate-100 text-white border-b border-white/[0.08]">🚿 Washroom Cleaning Log</h2>
          <div className="divide-y divide-white/[0.06]">
            {washroomDuties.map((d) => (
              <div key={d.id} className="p-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-400 text-xs w-20">{new Date(d.date).toLocaleDateString()}</span>
                <span className="font-medium text-slate-200">{d.member.name}</span>
                <span className="text-xs text-slate-400">WR-{d.washroomNumber}</span>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-green-900 text-green-300">
                  ✅ Done
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bazar Trip Status */}
      {bazarTrips.length > 0 && (
        <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl shadow-md shadow-black/10 border border-white/[0.08] overflow-hidden">
          <h2 className="p-4 text-lg font-semibold text-slate-100 text-white border-b border-white/[0.08]">🛒 Bazar Trips</h2>
          <div className="divide-y divide-white/[0.06]">
            {bazarTrips.map((t, i) => {
              const companions = t.companionIds?.map((cid) => companionMap[cid]).filter(Boolean) || [];
              return (
                <div key={i} className="p-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-slate-400 text-xs">{new Date(t.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                  <span className="font-medium text-slate-200">
                    {t.buyer?.name || "Unknown"}
                    {companions.length > 0 && (
                      <span className="text-slate-400 font-normal"> + {companions.join(", ")}</span>
                    )}
                  </span>
                  <span className="font-bold text-orange-400">৳{t.totalCost}</span>
                  <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${t.approved ? "bg-green-900 text-green-300"
                    : "bg-yellow-900 text-yellow-300"
                    }`}>
                    {t.approved ? "✅ Approved" : "⏳ Pending"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Meal Summary */}
      <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl shadow-md shadow-black/10 border border-white/[0.08] overflow-hidden">
        <h2 className="p-4 text-lg font-semibold text-slate-100 text-white border-b border-white/[0.08]">🍛 Meal Counts</h2>
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] ">
            <tr>
              <th className="text-left p-3">Member</th>
              <th className="text-center p-3">Total Meals</th>
              <th className="text-right p-3">Deposits</th>
            </tr>
          </thead>
          <tbody>
            {scorecard.map((s) => (
              <tr key={s.id} className="border-t border-white/[0.08] hover:bg-white/[0.04] ">
                <td className="p-3 font-medium text-slate-200">{s.name}</td>
                <td className="p-3 text-center font-bold text-indigo-400">{s.totalMealsCount}</td>
                <td className="p-3 text-right text-green-600">৳{s.totalDeposit.toFixed(0)}</td>
              </tr>
            ))}
            <tr className="border-t border-white/[0.08] bg-white/[0.04]  font-bold">
              <td className="p-3">Total</td>
              <td className="p-3 text-center text-indigo-400">
                {scorecard.reduce((sum, s) => sum + s.totalMealsCount, 0)}
              </td>
              <td className="p-3 text-right text-green-400">
                ৳{scorecard.reduce((sum, s) => sum + s.totalDeposit, 0).toFixed(0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
