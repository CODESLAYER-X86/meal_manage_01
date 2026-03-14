"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Member { id: string; name: string; }

export default function HandoverPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [nextManagerId, setNextManagerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user?.role !== "MANAGER") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/members")
        .then((r) => r.json())
        .then((m: Member[]) => {
          const others = m.filter((member) => member.id !== session?.user?.id);
          setMembers(others);
          if (others.length > 0) setNextManagerId(others[0].id);
        });
    }
  }, [status, session]);

  const selectedMember = members.find((m) => m.id === nextManagerId);

  const handleHandover = async () => {
    if (!selectedMember) return;
    if (!confirm(`Are you sure you want to hand over the manager role to ${selectedMember.name}?\n\nYou will lose edit access and be logged out.`)) return;

    setSaving(true);
    setError("");

    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const res = await fetch("/api/manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextManagerId, month, year }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to hand over");
      }

      setSuccess(`Manager role handed over to ${selectedMember.name}! Logging you out...`);
      setTimeout(() => {
        signOut({ callbackUrl: "/login" });
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">🔄 Hand Over Manager Role</h1>

      {/* Current Manager */}
      <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl">
        <p className="text-sm text-indigo-600 font-medium">Current Manager</p>
        <p className="text-lg font-bold text-indigo-800">{session?.user?.name}</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl text-sm text-yellow-800">
        ⚠️ <strong>Warning:</strong> This will immediately transfer the manager role to another member. You will become a regular member and lose all edit access. This action is recorded in the audit log.
      </div>

      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-5 rounded-xl shadow-md shadow-black/10 border space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Select Next Manager
          </label>
          <select
            value={nextManagerId}
            onChange={(e) => setNextManagerId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {selectedMember && (
          <div className="bg-white/[0.02] p-3 rounded-lg text-sm text-slate-400">
            <p>After handover:</p>
            <p className="mt-1">• <strong>{selectedMember.name}</strong> → becomes <span className="text-indigo-600 font-medium">MANAGER</span></p>
            <p>• <strong>{session?.user?.name}</strong> → becomes <span className="text-slate-400 font-medium">MEMBER</span></p>
          </div>
        )}

        <button
          onClick={handleHandover}
          disabled={saving || !nextManagerId}
          className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50"
        >
          {saving ? "Transferring..." : "🔄 Confirm Hand Over"}
        </button>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm text-center">
            ❌ {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm text-center">
            ✅ {success}
          </div>
        )}
      </div>
    </div>
  );
}
