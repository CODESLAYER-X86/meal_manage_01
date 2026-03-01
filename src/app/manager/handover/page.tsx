"use client";

import { useSession } from "next-auth/react";
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

  const handleHandover = async () => {
    if (!confirm("Are you sure you want to hand over the manager role? You will lose edit access.")) return;

    setSaving(true);
    const now = new Date();
    const nextMonth = now.getMonth() + 2; // next month (1-indexed)
    const year = nextMonth > 12 ? now.getFullYear() + 1 : now.getFullYear();
    const month = nextMonth > 12 ? 1 : nextMonth;

    await fetch("/api/manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nextManagerId, month, year }),
    });

    setSaving(false);
    setSuccess("Manager role handed over! You will be logged out...");
    setTimeout(() => router.push("/login"), 2000);
  };

  if (status === "loading") return null;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">🔄 Hand Over Manager Role</h1>

      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl text-sm text-yellow-800">
        ⚠️ This will transfer the manager role to another member. You will become a regular member and lose edit access.
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Next Manager
          </label>
          <select
            value={nextManagerId}
            onChange={(e) => setNextManagerId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleHandover}
          disabled={saving}
          className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50"
        >
          {saving ? "Transferring..." : "🔄 Confirm Hand Over"}
        </button>

        {success && (
          <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm text-center">
            {success}
          </div>
        )}
      </div>
    </div>
  );
}
