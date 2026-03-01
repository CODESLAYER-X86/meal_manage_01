"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface MessInfo {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
  memberCount: number;
  members: {
    id: string;
    name: string;
    email: string;
    role: string;
    phone: string | null;
  }[];
}

export default function MessInfoPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [mess, setMess] = useState<MessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (session && !session.user?.messId) {
      router.push("/onboarding");
      return;
    }

    fetch("/api/mess")
      .then((res) => res.json())
      .then((data) => {
        setMess(data.mess);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, router]);

  const copyCode = () => {
    if (mess) {
      navigator.clipboard.writeText(mess.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!mess) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">No mess found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Mess Info Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">🏠 {mess.name}</h1>
        <p className="text-gray-500 text-sm">Created by {mess.createdBy} · {mess.memberCount} members</p>

        {/* Invite Code */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
          <p className="text-sm text-gray-600 mb-2 font-medium">📨 Invite Code — Share with new members</p>
          <div className="flex items-center gap-3">
            <p className="text-2xl font-mono font-bold text-indigo-600 tracking-widest flex-1">
              {mess.inviteCode}
            </p>
            <button
              onClick={copyCode}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              {copied ? "✅ Copied!" : "📋 Copy"}
            </button>
          </div>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">👥 Members</h2>
        <div className="space-y-3">
          {mess.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <p className="font-medium text-gray-900">
                  {member.name}
                  {member.role === "MANAGER" && (
                    <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                      👑 Manager
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-500">{member.email}</p>
              </div>
              {member.phone && (
                <span className="text-sm text-gray-400">📱 {member.phone}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
