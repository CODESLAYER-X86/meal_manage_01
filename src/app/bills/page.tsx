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
  other: number;
  otherNote: string | null;
}
interface Fine {
  id: string;
  memberId: string;
  member: { id: string; name: string };
  amount: number;
  reason: string;
  settled: boolean;
  settledAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
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
  const [other, setOther] = useState("");
  const [otherNote, setOtherNote] = useState("");

  // Payments
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [memberBills, setMemberBills] = useState<Record<string, number>>({});
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");

  // Fines
  const [fines, setFines] = useState<Fine[]>([]);
  const [fineLoading, setFineLoading] = useState(false);
  const [showFineForm, setShowFineForm] = useState(false);
  const [fineMemberId, setFineMemberId] = useState("");
  const [fineAmount, setFineAmount] = useState("");
  const [fineReason, setFineReason] = useState("");
  const [fineSubmitting, setFineSubmitting] = useState(false);
  const [fineError, setFineError] = useState("");
  const [settlingFine, setSettlingFine] = useState<string | null>(null);

  const isManager = (session?.user as { role?: string })?.role === "MANAGER";
  const userId = session?.user?.id;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchFines = async () => {
    setFineLoading(true);
    try {
      const res = await fetch("/api/fines");
      const data = await res.json();
      setFines(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setFineLoading(false);
    }
  };

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
        setOther(String(s.other || ""));
        setOtherNote(s.otherNote || "");
      } else {
        const r: Record<string, string> = {};
        for (const m of settingData.members || []) r[m.id] = "";
        setRents(r);
        setWifi(""); setElectricity(""); setGas(""); setCookSalary(""); setOther(""); setOtherNote("");
      }

      setPayments(paymentData.payments || []);
      setMemberBills(paymentData.memberBills || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
      fetchFines();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        other: Number(other) || 0,
        otherNote: otherNote.trim() || null,
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

  const issueFine = async () => {
    setFineError("");
    if (!fineMemberId) { setFineError("Select a member"); return; }
    if (!fineAmount || Number(fineAmount) <= 0) { setFineError("Enter a valid amount"); return; }
    if (!fineReason.trim()) { setFineError("Enter a reason"); return; }
    setFineSubmitting(true);
    try {
      const res = await fetch("/api/fines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: fineMemberId, amount: Number(fineAmount), reason: fineReason.trim() }),
      });
      if (res.ok) {
        setShowFineForm(false);
        setFineMemberId(""); setFineAmount(""); setFineReason("");
        fetchFines();
      } else {
        const d = await res.json();
        setFineError(d.error || "Failed");
      }
    } catch {
      setFineError("Something went wrong");
    } finally {
      setFineSubmitting(false);
    }
  };

  const settleFine = async (id: string) => {
    if (!confirm("Mark this fine as settled? The amount will be added to the member's deposit.")) return;
    setSettlingFine(id);
    try {
      const res = await fetch("/api/fines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) fetchFines();
      else alert((await res.json()).error || "Failed");
    } catch {
      // ignore
    } finally {
      setSettlingFine(null);
    }
  };

  const deleteFine = async (id: string) => {
    if (!confirm("Delete this fine?")) return;
    const res = await fetch(`/api/fines?id=${id}`, { method: "DELETE" });
    if (res.ok) fetchFines();
    else alert((await res.json()).error || "Failed");
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

  const myUnsettledFines = fines.filter(f => f.memberId === userId && !f.settled);
  const allUnsettledFines = fines.filter(f => !f.settled);

  // Bill breakdown helpers (from form state for manager preview, from setting for members)
  const wifiVal = setting ? setting.wifi : (Number(wifi) || 0);
  const electricityVal = setting ? setting.electricity : (Number(electricity) || 0);
  const gasVal = setting ? setting.gas : (Number(gas) || 0);
  const cookSalaryVal = setting ? setting.cookSalary : (Number(cookSalary) || 0);
  const otherVal = setting ? setting.other : (Number(other) || 0);
  const sharedTotal = wifiVal + electricityVal +
    (messConfig?.hasGas ? gasVal : 0) +
    (messConfig?.hasCook ? cookSalaryVal : 0) +
    otherVal;
  const perPersonShared = members.length > 0 ? sharedTotal / members.length : 0;

  // Manager live preview uses form state
  const managerSharedPreview = (Number(wifi) || 0) + (Number(electricity) || 0) +
    (messConfig?.hasGas ? (Number(gas) || 0) : 0) +
    (messConfig?.hasCook ? (Number(cookSalary) || 0) : 0) +
    (Number(other) || 0);
  const managerPerPersonPreview = members.length > 0 ? managerSharedPreview / members.length : 0;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-100 text-white">💳 Bills & Rent</h1>
        <div className="flex gap-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="rounded-lg border border-white/[0.08]  text-white px-2 py-1 text-sm">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString("default", { month: "short" })}</option>
            ))}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="rounded-lg border border-white/[0.08]  text-white px-2 py-1 text-sm">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* My Bill Summary */}
      {myBill > 0 && (
        <div className={`rounded-xl p-4 border ${myRemaining > 0 ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800" : "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"}`}>
          <p className="text-sm font-medium text-slate-300 text-slate-400">Your bill this month</p>
          <p className="text-2xl font-bold mt-1 text-white text-white">৳{myBill.toFixed(0)}</p>
          {setting && (
            <div className="mt-2 text-xs text-slate-400 text-slate-400 space-y-0.5">
              <p>Rent: <span className="font-semibold text-slate-100 text-slate-200">৳{(setting.rents?.[userId || ""] || 0).toFixed(0)}</span></p>
              <p>Shared utilities ({members.length} members): <span className="font-semibold text-slate-100 text-slate-200">৳{perPersonShared.toFixed(0)}</span></p>
            </div>
          )}
          <p className="text-sm mt-2 text-slate-300 text-slate-400">
            Paid: <span className="font-bold text-green-600 dark:text-green-400">৳{myPaid.toFixed(0)}</span>
            {myRemaining > 0 && <span className="text-red-600 dark:text-red-400 ml-2 font-medium">Remaining: ৳{myRemaining.toFixed(0)}</span>}
            {myRemaining <= 0 && <span className="text-green-600 dark:text-green-400 ml-2">✅ All paid!</span>}
          </p>
          {myUnsettledFines.length > 0 && (
            <p className="text-sm mt-1 text-orange-700 dark:text-orange-400 font-medium">
              ⚠️ {myUnsettledFines.length} unsettled fine{myUnsettledFines.length > 1 ? "s" : ""} — total ৳{myUnsettledFines.reduce((s, f) => s + f.amount, 0).toFixed(0)}
            </p>
          )}
        </div>
      )}

      {/* Bill Settings (Manager) */}
      {isManager && (
        <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl shadow-md shadow-black/10 border border-white/[0.08] p-4 space-y-4">
          <h2 className="text-lg font-semibold text-slate-100 text-white">⚙️ Set Monthly Bills (Manager)</h2>

          <div>
            <h3 className="text-sm font-medium text-slate-400 text-slate-400 mb-2">Per-Member Rent</h3>
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="text-sm w-28 truncate text-slate-300 text-slate-400">{m.name}</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={rents[m.id] || ""}
                    onChange={e => setRents(prev => ({ ...prev, [m.id]: e.target.value }))}
                    className="flex-1 rounded-lg border border-white/[0.08]  text-white px-3 py-1.5 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-400 text-slate-400 mb-1">
              Shared Bills <span className="text-xs font-normal text-indigo-500 dark:text-indigo-400">(enter TOTAL — split equally among {members.length || "?"} members)</span>
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 text-slate-400">WiFi (Total)</label>
                <input type="number" value={wifi} onChange={e => setWifi(e.target.value)} placeholder="0" className="w-full rounded-lg border border-white/[0.08]  text-white px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400 text-slate-400">Electricity (Total)</label>
                <input type="number" value={electricity} onChange={e => setElectricity(e.target.value)} placeholder="0" className="w-full rounded-lg border border-white/[0.08]  text-white px-3 py-1.5 text-sm" />
              </div>
              {messConfig?.hasGas && (
                <div>
                  <label className="text-xs text-slate-400 text-slate-400">Gas (Total)</label>
                  <input type="number" value={gas} onChange={e => setGas(e.target.value)} placeholder="0" className="w-full rounded-lg border border-white/[0.08]  text-white px-3 py-1.5 text-sm" />
                </div>
              )}
              {messConfig?.hasCook && (
                <div>
                  <label className="text-xs text-slate-400 text-slate-400">Cook Salary (Total)</label>
                  <input type="number" value={cookSalary} onChange={e => setCookSalary(e.target.value)} placeholder="0" className="w-full rounded-lg border border-white/[0.08]  text-white px-3 py-1.5 text-sm" />
                </div>
              )}
              <div>
                <label className="text-xs text-slate-400 text-slate-400">Other (Total)</label>
                <input type="number" value={other} onChange={e => setOther(e.target.value)} placeholder="0" className="w-full rounded-lg border border-white/[0.08]  text-white px-3 py-1.5 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 text-slate-400">Note for &quot;Other&quot; (visible to all)</label>
                <input type="text" value={otherNote} onChange={e => setOtherNote(e.target.value)} placeholder="e.g. Building maintenance" className="w-full rounded-lg border border-white/[0.08]  text-white px-3 py-1.5 text-sm" />
              </div>
            </div>
          </div>

          {/* Live breakdown preview */}
          {members.length > 0 && managerSharedPreview > 0 && (
            <div className="bg-indigo-50 dark:bg-indigo-950 rounded-lg px-3 py-2.5 text-xs text-indigo-700 dark:text-indigo-300">
              Shared total: ৳{managerSharedPreview.toFixed(0)} ÷ {members.length} members = <strong>৳{managerPerPersonPreview.toFixed(0)} per person</strong>
            </div>
          )}

          <button onClick={saveBillSettings} disabled={saving} className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save Bill Settings"}
          </button>
        </div>
      )}

      {/* Bill breakdown for members */}
      {!isManager && setting && (
        <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl shadow-md shadow-black/10 border border-white/[0.08] p-4">
          <h2 className="text-lg font-semibold text-slate-100 text-white mb-3">📊 Bill Breakdown</h2>
          <div className="space-y-1.5 text-sm text-slate-300 text-slate-400">
            <div className="flex justify-between">
              <span>Your Rent</span>
              <span className="font-medium text-white text-white">৳{(setting.rents?.[userId || ""] || 0).toFixed(0)}</span>
            </div>
            {setting.wifi > 0 && (
              <div className="flex justify-between text-xs text-slate-400 text-slate-400">
                <span>WiFi (৳{setting.wifi} ÷ {members.length})</span>
                <span>৳{(setting.wifi / members.length).toFixed(0)}</span>
              </div>
            )}
            {setting.electricity > 0 && (
              <div className="flex justify-between text-xs text-slate-400 text-slate-400">
                <span>Electricity (৳{setting.electricity} ÷ {members.length})</span>
                <span>৳{(setting.electricity / members.length).toFixed(0)}</span>
              </div>
            )}
            {setting.gas > 0 && (
              <div className="flex justify-between text-xs text-slate-400 text-slate-400">
                <span>Gas (৳{setting.gas} ÷ {members.length})</span>
                <span>৳{(setting.gas / members.length).toFixed(0)}</span>
              </div>
            )}
            {setting.cookSalary > 0 && (
              <div className="flex justify-between text-xs text-slate-400 text-slate-400">
                <span>Cook Salary (৳{setting.cookSalary} ÷ {members.length})</span>
                <span>৳{(setting.cookSalary / members.length).toFixed(0)}</span>
              </div>
            )}
            {setting.other > 0 && (
              <div className="flex justify-between text-xs text-slate-400 text-slate-400">
                <span>Other{setting.otherNote ? ` — ${setting.otherNote}` : ""} (৳{setting.other} ÷ {members.length})</span>
                <span>৳{(setting.other / members.length).toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-white text-white pt-1 border-t border-white/[0.08]">
              <span>Total</span>
              <span>৳{myBill.toFixed(0)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Submit Payment */}
      <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl shadow-md shadow-black/10 border border-white/[0.08] p-4 space-y-3">
        <h2 className="text-lg font-semibold text-slate-100 text-white">💵 Submit Payment</h2>
        <div className="flex gap-2">
          <input type="number" placeholder="Amount" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="flex-1 rounded-lg border border-white/[0.08]  text-white px-3 py-2 text-sm" />
          <input type="text" placeholder="Note (optional)" value={payNote} onChange={e => setPayNote(e.target.value)} className="flex-1 rounded-lg border border-white/[0.08]  text-white px-3 py-2 text-sm" />
        </div>
        <button onClick={submitPayment} className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">
          Submit Payment
        </button>
      </div>

      {/* Payment History */}
      <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl shadow-md shadow-black/10 border border-white/[0.08] overflow-hidden">
        <h2 className="p-4 text-lg font-semibold text-slate-100 text-white border-b border-white/[0.08]">�� Payment History</h2>
        {payments.length === 0 ? (
          <p className="p-4 text-slate-400 text-slate-400 text-sm">No payments yet for this month.</p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {payments.map(p => (
              <div key={p.id} className="p-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-slate-100 text-slate-200">{p.member.name}</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">৳{p.amount}</span>
                {p.note && <span className="text-slate-400 text-xs">({p.note})</span>}
                <span className="text-xs text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</span>
                <div className="ml-auto flex items-center gap-2">
                  {p.confirmed ? (
                    <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 rounded-full">✅ Confirmed</span>
                  ) : (
                    <span className="text-xs font-bold text-yellow-600 bg-yellow-50 dark:bg-yellow-900 dark:text-yellow-300 px-2 py-0.5 rounded-full">⏳ Pending</span>
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

      {/* Fines Section */}
      <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl shadow-md shadow-black/10 border border-white/[0.08] overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-white/[0.08]">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 text-white">⚠️ Fines</h2>
            {allUnsettledFines.length > 0 && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                {allUnsettledFines.length} unsettled fine{allUnsettledFines.length > 1 ? "s" : ""}
              </p>
            )}
          </div>
          {isManager && (
            <button
              onClick={() => { setShowFineForm(!showFineForm); setFineError(""); }}
              className="text-sm bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-3 py-1.5 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-800 font-medium"
            >
              {showFineForm ? "✕ Cancel" : "➕ Issue Fine"}
            </button>
          )}
        </div>

        {/* Issue Fine Form (Manager) */}
        {isManager && showFineForm && (
          <div className="p-4 border-b border-white/[0.08] bg-orange-50 dark:bg-orange-950 space-y-3">
            <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-300">Issue a Fine</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 text-slate-400">Member</label>
                <select
                  value={fineMemberId}
                  onChange={e => setFineMemberId(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08]  text-white px-3 py-1.5 text-sm"
                >
                  <option value="">Select member...</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 text-slate-400">Amount (৳)</label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={fineAmount}
                  onChange={e => setFineAmount(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08]  text-white px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 text-slate-400">Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Late meal off"
                  value={fineReason}
                  onChange={e => setFineReason(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08]  text-white px-3 py-1.5 text-sm"
                />
              </div>
            </div>
            {fineError && <p className="text-xs text-red-600 dark:text-red-400">⚠️ {fineError}</p>}
            <button
              onClick={issueFine}
              disabled={fineSubmitting}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
            >
              {fineSubmitting ? "Issuing..." : "Issue Fine"}
            </button>
          </div>
        )}

        {/* Fines List */}
        {fineLoading ? (
          <p className="p-4 text-sm text-slate-400 text-slate-400">Loading fines...</p>
        ) : fines.length === 0 ? (
          <p className="p-4 text-sm text-slate-400 text-slate-400">No fines issued.</p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {fines.map(f => (
              <div key={f.id} className={`p-3 flex flex-wrap items-start gap-2 text-sm ${f.settled ? "opacity-60" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-100 text-slate-200">{f.member.name}</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">৳{f.amount}</span>
                    {f.settled ? (
                      <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 rounded-full">✅ Settled</span>
                    ) : (
                      <span className="text-xs font-medium text-red-600 bg-white/[0.03] backdrop-blur-xl dark:text-red-300 px-2 py-0.5 rounded-full">⚠️ Unsettled</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 text-slate-400 mt-0.5">
                    {f.reason} · Issued by {f.createdBy.name} · {new Date(f.createdAt).toLocaleDateString()}
                  </p>
                  {f.settled && f.settledAt && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Settled on {new Date(f.settledAt).toLocaleDateString()}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  {!f.settled && (f.memberId === userId || isManager) && (
                    <button
                      onClick={() => settleFine(f.id)}
                      disabled={settlingFine === f.id}
                      className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {settlingFine === f.id ? "..." : "Settle"}
                    </button>
                  )}
                  {isManager && !f.settled && (
                    <button
                      onClick={() => deleteFine(f.id)}
                      className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                    >
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
