"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  joinDate: string;
}

export default function MembersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("123456");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user?.role !== "MANAGER") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/members").then((r) => r.json()).then(setMembers);
    }
  }, [status]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, password }),
    });
    if (res.ok) {
      setName("");
      setEmail("");
      setPhone("");
      setShowForm(false);
      fetch("/api/members").then((r) => r.json()).then(setMembers);
    }
    setSaving(false);
  };

  if (status === "loading") return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">👥 Members</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition"
        >
          {showForm ? "Cancel" : "➕ Add Member"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white p-5 rounded-xl shadow-sm border space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add Member"}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">Email</th>
              <th className="text-left p-4">Phone</th>
              <th className="text-center p-4">Role</th>
              <th className="text-center p-4">Joined</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t hover:bg-gray-50">
                <td className="p-4 font-medium">{m.name}</td>
                <td className="p-4 text-gray-500">{m.email}</td>
                <td className="p-4 text-gray-500">{m.phone || "—"}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    m.role === "MANAGER" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {m.role}
                  </span>
                </td>
                <td className="p-4 text-center text-gray-500">
                  {new Date(m.joinDate).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
