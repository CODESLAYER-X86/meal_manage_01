"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

export default function Navbar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!session) return null;

  const isManager = session.user?.role === "MANAGER";

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="text-xl font-bold text-indigo-600">
              🍛 Mess Manager
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
              {isManager && (
                <>
                  <Link href="/manager/meals" className="px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 rounded-md hover:bg-indigo-50">
                    ✏️ Meals
                  </Link>
                  <Link href="/manager/deposits" className="px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 rounded-md hover:bg-indigo-50">
                    💰 Deposits
                  </Link>
                  <Link href="/manager/members" className="px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 rounded-md hover:bg-indigo-50">
                    👥 Members
                  </Link>
                  <Link href="/manager/handover" className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-800 rounded-md hover:bg-red-50">
                    🔄 Handover
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
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
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 text-gray-600">
              ☰
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-3 space-y-1">
            <Link href="/dashboard" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">Dashboard</Link>
            <Link href="/calendar" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">Calendar</Link>
            <Link href="/transparency" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">Transparency</Link>
            <Link href="/audit-log" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">Audit Log</Link>
            <Link href="/billing" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">Monthly Bill</Link>
            <Link href="/bazar" className="block px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded">🛒 Bazar Entry</Link>
            <Link href="/profile" className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">⚙️ Profile</Link>
            {isManager && (
              <>
                <Link href="/manager/meals" className="block px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded">✏️ Meal Entry</Link>
                <Link href="/manager/deposits" className="block px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded">💰 Deposits</Link>
                <Link href="/manager/members" className="block px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded">👥 Members</Link>
                <Link href="/manager/handover" className="block px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded">🔄 Handover</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
