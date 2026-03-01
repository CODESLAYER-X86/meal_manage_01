"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  name: string;
}

interface DepositEntry {
  id: string;
  date: string;
  amount: number;
  note: string | null;
  member: { id: string; name: string };
}

export default function DepositsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [deposits, setDeposits] = useState<DepositEntry[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
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
      const now = new Date();
      Promise.all([
        fetch("/api/members").then((r) => r.json()),
        fetch(`/api/deposits?month=${now.getMonth() + 1}&year=${now.getFullYear()}`).then((r) => r.json()),
      ]).then(([m, d]) => {
        setMembers(m);
        setDeposits(d);
        if (m.length > 0) setMemberId(m[0].id);
      });
    }
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess("");

    const res = await fetch("/api/deposits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, memberId, amount: parseFloat(amount), note }),
    });

    if (res.ok) {
      const newDeposit = await res.json();
      const member = members.find((m) => m.id === memberId);
      setDeposits([
        { ...newDeposit, member: { id: memberId, name: member?.name || "" } },
        ...deposits,
      ]);
      setAmount("");
      setNote("");
      setSuccess("Deposit recorded!");
      setTimeout(() => setSuccess(""), 3000);
    }
    setSaving(false);
  };

  if (status === "loading") return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">💰 Record Deposits</h1>

      {/* Add Deposit Form */}
      <form onSubmit={handleSubmit} className="bg-white p-5 rounded-xl shadow-sm border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Member</label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (৳)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "💾 Record Deposit"}
          </button>
          {success && <span className="text-green-600 text-sm font-medium">{success}</span>}
        </div>
      </form>

      {/* Recent Deposits */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <h2 className="p-4 text-lg font-semibold text-gray-800 border-b">This Month&apos;s Deposits</h2>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[400px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Member</th>
              <th className="text-right p-3">Amount</th>
              <th className="text-left p-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {deposits.map((d) => (
              <tr key={d.id} className="border-t hover:bg-gray-50">
                <td className="p-3">{new Date(d.date).toLocaleDateString()}</td>
                <td className="p-3 font-medium">{d.member.name}</td>
                <td className="p-3 text-right font-bold text-green-600">৳{d.amount}</td>
                <td className="p-3 text-gray-500">{d.note || "—"}</td>
              </tr>
            ))}
            {deposits.length === 0 && (
              <tr><td colSpan={4} className="p-4 text-center text-gray-400">No deposits this month</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
