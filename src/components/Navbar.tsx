"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";

export default function Navbar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (session?.user?.id) {
      fetch("/api/notifications?unread=true&limit=1")
        .then((r) => r.json())
        .then((data) => setUnreadCount(data.unreadCount || 0))
        .catch(() => {});
      // Refresh every 60 seconds
      const interval = setInterval(() => {
        fetch("/api/notifications?unread=true&limit=1")
          .then((r) => r.json())
          .then((data) => setUnreadCount(data.unreadCount || 0))
          .catch(() => {});
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [session?.user?.id]);

  if (!session) return null;
  if (!session.user?.messId) return null; // Don't show navbar during onboarding

  const isManager = session.user?.role === "MANAGER";

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="text-xl font-bold text-indigo-600">
              🍽️ MessMate
            </Link>
            <div className="hidden md:flex ml-8 space-x-4">
              <Link href="/dashboard" className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 rounded-md hover:bg-gray-50">
                Dashboard
              </Link>
              <Link href="/calendar" className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 rounded-md hover:bg-gray-50">
                Calendar
              </Link>
              <Link href="/transparency" className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 rounded-md hover:bg-gray-50">
                Transparency
              </Link>
              <Link href="/audit-log" className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 rounded-md hover:bg-gray-50">
                Audit Log
              </Link>
              <Link href="/billing" className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 rounded-md hover:bg-gray-50">
                Monthly Bill
              </Link>
              <Link href="/bazar" className="px-3 py-2 text-sm font-medium text-orange-600 hover:text-orange-800 rounded-md hover:bg-orange-50">
                🛒 Bazar
              </Link>
              <Link href="/washroom" className="px-3 py-2 text-sm font-medium text-teal-600 hover:text-teal-800 rounded-md hover:bg-teal-50">
                🚿 Washroom
              </Link>
              <Link href="/meal-plan" className="px-3 py-2 text-sm font-medium text-emerald-600 hover:text-emerald-800 rounded-md hover:bg-emerald-50">
                🍳 Meal Plan
              </Link>
              <Link href="/archive" className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-50">
                📦 Archive
              </Link>
              <Link href="/announcements" className="px-3 py-2 text-sm font-medium text-amber-600 hover:text-amber-800 rounded-md hover:bg-amber-50">
                📢 Notices
              </Link>
              <Link href="/meal-vote" className="px-3 py-2 text-sm font-medium text-purple-600 hover:text-purple-800 rounded-md hover:bg-purple-50">
                🗳️ Vote
              </Link>
              {isManager && (
                <>
                  <Link href="/manager/meals" className="px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 rounded-md hover:bg-indigo-50">
                    ✏️ Meals
                  </Link>
                  <Link href="/manager/deposits" className="px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 rounded-md hover:bg-indigo-50">
                    💰 Deposits
                  </Link>
                  <Link href="/manager/handover" className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-800 rounded-md hover:bg-red-50">
                    🔄 Handover
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-3">
            <Link href="/notifications" className="relative text-sm text-gray-500 hover:text-indigo-600">
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
            <Link href="/mess-info" className="text-sm text-gray-500 hover:text-indigo-600">
              🏠 Mess
            </Link>
            <Link href="/profile" className="text-sm text-gray-600 hover:text-indigo-600">
              {session.user?.name}
              {isManager && (
                <span className="ml-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                  Manager
                </span>
              )}
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Logout
            </button>
          </div>
          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-3 text-gray-600 text-xl">
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-3 space-y-0.5 max-h-[70vh] overflow-y-auto">
            <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">📊 Dashboard</Link>
            <Link href="/calendar" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">📅 Calendar</Link>
            <Link href="/transparency" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">👁️ Transparency</Link>
            <Link href="/audit-log" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">🔍 Audit Log</Link>
            <Link href="/billing" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">📊 Monthly Bill</Link>
            <Link href="/bazar" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-orange-600 hover:bg-orange-50 rounded-lg">🛒 Bazar Entry</Link>
            <Link href="/washroom" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-teal-600 hover:bg-teal-50 rounded-lg">🚿 Washroom</Link>
            <Link href="/meal-plan" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg">🍳 Meal Plan</Link>
            <Link href="/meal-rating" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-yellow-600 hover:bg-yellow-50 rounded-lg">⭐ Meal Rating</Link>
            <Link href="/announcements" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-amber-600 hover:bg-amber-50 rounded-lg">📢 Announcements</Link>
            <Link href="/meal-vote" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-purple-600 hover:bg-purple-50 rounded-lg">🗳️ Meal Vote</Link>
            <Link href="/archive" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">📦 Archive</Link>
            <Link href="/notifications" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg relative">🔔 Notifications{unreadCount > 0 && <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{unreadCount}</span>}</Link>
            <hr className="my-1 border-gray-100" />
            <Link href="/mess-info" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">🏠 Mess Info</Link>
            <Link href="/profile" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">⚙️ Profile</Link>
            {isManager && (
              <>
                <hr className="my-1 border-gray-100" />
                <Link href="/manager/meals" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg">✏️ Meal Entry</Link>
                <Link href="/manager/deposits" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg">💰 Deposits</Link>
                <Link href="/manager/handover" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg">🔄 Handover</Link>
              </>
            )}
            <hr className="my-1 border-gray-100" />
            <button
              onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/login" }); }}
              className="block w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-lg"
            >
              🚪 Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
