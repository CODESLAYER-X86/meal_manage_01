"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Member { id: string; name: string; }
interface BillPayment {
  id: string;
  memberId: string;
  amount: number;
  note: string | null;
  confirmed: boolean;
  confirmedAt: string | null;
  createdAt: string;
  member: Member;
}
interface BillSetting {
  rents: Record<string, number>;
  wifi: number;
  electricity: number;
  gas: number;
  cookSalary: number;
}

export default function BillsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Bill settings
  const [setting, setSetting] = useState<BillSetting | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messConfig, setMessConfig] = useState<{ hasGas: boolean; hasCook: boolean } | null>(null);

  // Form fields
  const [rents, setRents] = useState<Record<string, string>>({});
  const [wifi, setWifi] = useState("");
  const [electricity, setElectricity] = useState("");
  const [gas, setGas] = useState("");
  const [cookSalary, setCookSalary] = useState("");

  // Payments
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [memberBills, setMemberBills] = useState<Record<string, number>>({});
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");

  const isManager = (session?.user as { role?: string })?.role === "MANAGER";
  const userId = session?.user?.id;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/bill-settings?month=${month}&year=${year}`).then(r => r.json()),
      fetch(`/api/bill-payments?month=${month}&year=${year}`).then(r => r.json()),
    ]).then(([settingData, paymentData]) => {
      setSetting(settingData.setting);
      setMembers(settingData.members || []);
      setMessConfig(settingData.mess);

      if (settingData.setting) {
        const s = settingData.setting;
        const r: Record<string, string> = {};
        for (const m of settingData.members || []) {
          r[m.id] = String(s.rents?.[m.id] || "");
        }
        setRents(r);
        setWifi(String(s.wifi || ""));
        setElectricity(String(s.electricity || ""));
        setGas(String(s.gas || ""));
        setCookSalary(String(s.cookSalary || ""));
      } else {
        const r: Record<string, string> = {};
        for (const m of settingData.members || []) r[m.id] = "";
        setRents(r);
        setWifi(""); setElectricity(""); setGas(""); setCookSalary("");
      }

      setPayments(paymentData.payments || []);
      setMemberBills(paymentData.memberBills || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    if (status === "authenticated") fetchData();
  }, [status, month, year]);

  const saveBillSettings = async () => {
    setSaving(true);
    const rentObj: Record<string, number> = {};
    for (const [id, val] of Object.entries(rents)) {
      if (val) rentObj[id] = Number(val);
    }
    const res = await fetch("/api/bill-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month, year,
        rents: rentObj,
        wifi: Number(wifi) || 0,
        electricity: Number(electricity) || 0,
        gas: Number(gas) || 0,
        cookSalary: Number(cookSalary) || 0,
      }),
    });
    setSaving(false);
    if (res.ok) fetchData();
    else alert((await res.json()).error || "Failed to save");
  };

  const submitPayment = async () => {
    if (!payAmount || Number(payAmount) <= 0) return alert("Enter a valid amount");
    const res = await fetch("/api/bill-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, year, amount: Number(payAmount), note: payNote || null }),
    });
    if (res.ok) { setPayAmount(""); setPayNote(""); fetchData(); }
    else alert((await res.json()).error || "Failed");
  };

  const confirmPayment = async (id: string, confirmed: boolean) => {
    const res = await fetch("/api/bill-payments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, confirmed }),
    });
    if (res.ok) fetchData();
  };

  const deletePayment = async (id: string) => {
    if (!confirm("Delete this payment?")) return;
    const res = await fetch(`/api/bill-payments?id=${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const myBill = memberBills[userId || ""] || 0;
  const myPaid = payments.filter(p => p.memberId === userId && p.confirmed).reduce((s, p) => s + p.amount, 0);
  const myRemaining = myBill - myPaid;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">💳 Bills & Rent</h1>
        <div className="flex gap-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString("default", { month: "short" })}</option>
            ))}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* My Bill Summary */}
      {myBill > 0 && (
        <div className={`rounded-xl p-4 border ${myRemaining > 0 ? "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800" : "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"}`}>
          <p className="text-sm text-gray-600 dark:text-gray-400">Your bill this month</p>
          <p className="text-2xl font-bold mt-1">৳{myBill.toFixed(0)}</p>
          <p className="text-sm mt-1">
            Paid: <span className="font-bold text-green-600">৳{myPaid.toFixed(0)}</span>
            {myRemaining > 0 && <span className="text-red-600 ml-2">Remaining: ৳{myRemaining.toFixed(0)}</span>}
            {myRemaining <= 0 && <span className="text-green-600 ml-2">✅ All paid!</span>}
          </p>
        </div>
      )}

      {/* Bill Settings (Manager) */}
      {isManager && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-4 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">⚙️ Set Monthly Bills (Manager)</h2>

          <div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Per-Member Rent</h3>
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="text-sm w-28 truncate text-gray-700 dark:text-gray-300">{m.name}</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={rents[m.id] || ""}
                    onChange={e => setRents(prev => ({ ...prev, [m.id]: e.target.value }))}
                    className="flex-1 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-1.5 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">WiFi</label>
              <input type="number" value={wifi} onChange={e => setWifi(e.target.value)} placeholder="0" className="w-full rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Electricity</label>
              <input type="number" value={electricity} onChange={e => setElectricity(e.target.value)} placeholder="0" className="w-full rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-1.5 text-sm" />
            </div>
            {messConfig?.hasGas && (
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Gas</label>
                <input type="number" value={gas} onChange={e => setGas(e.target.value)} placeholder="0" className="w-full rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-1.5 text-sm" />
              </div>
            )}
            {messConfig?.hasCook && (
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Cook Salary</label>
                <input type="number" value={cookSalary} onChange={e => setCookSalary(e.target.value)} placeholder="0" className="w-full rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-1.5 text-sm" />
              </div>
            )}
          </div>

          <button onClick={saveBillSettings} disabled={saving} className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save Bill Settings"}
          </button>
        </div>
      )}

      {/* Submit Payment */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-4 space-y-3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">💵 Submit Payment</h2>
        <div className="flex gap-2">
          <input type="number" placeholder="Amount" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="flex-1 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm" />
          <input type="text" placeholder="Note (optional)" value={payNote} onChange={e => setPayNote(e.target.value)} className="flex-1 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm" />
        </div>
        <button onClick={submitPayment} className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">
          Submit Payment
        </button>
      </div>

      {/* Payment History */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
        <h2 className="p-4 text-lg font-semibold text-gray-800 dark:text-gray-100 border-b dark:border-gray-700">📋 Payment History</h2>
        {payments.length === 0 ? (
          <p className="p-4 text-gray-500 dark:text-gray-400 text-sm">No payments yet for this month.</p>
        ) : (
          <div className="divide-y dark:divide-gray-700">
            {payments.map(p => (
              <div key={p.id} className="p-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-gray-800 dark:text-gray-200">{p.member.name}</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">৳{p.amount}</span>
                {p.note && <span className="text-gray-400 text-xs">({p.note})</span>}
                <span className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</span>
                <div className="ml-auto flex items-center gap-2">
                  {p.confirmed ? (
                    <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900 px-2 py-0.5 rounded-full">✅ Confirmed</span>
                  ) : (
                    <span className="text-xs font-bold text-yellow-600 bg-yellow-50 dark:bg-yellow-900 px-2 py-0.5 rounded-full">⏳ Pending</span>
                  )}
                  {isManager && !p.confirmed && (
                    <button onClick={() => confirmPayment(p.id, true)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">
                      Confirm
                    </button>
                  )}
                  {(isManager || (p.memberId === userId && !p.confirmed)) && (
                    <button onClick={() => deletePayment(p.id)} className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
