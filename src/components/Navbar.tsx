"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetch("/api/notifications?unread=true&limit=1")
        .then((r) => r.json())
        .then((data) => setUnreadCount(data.unreadCount || 0))
        .catch(() => { });
      const interval = setInterval(() => {
        fetch("/api/notifications?unread=true&limit=1")
          .then((r) => r.json())
          .then((data) => setUnreadCount(data.unreadCount || 0))
          .catch(() => { });
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [session?.user?.id]);

  // Close "More" dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!session) return null;
  if (!session.user?.messId && !(session.user as { isAdmin?: boolean })?.isAdmin) return null;

  const isManager = session.user?.role === "MANAGER";

  const isActive = (href: string) => pathname === href;
  const linkCls = (href: string) =>
    `px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${isActive(href)
      ? "bg-indigo-500/15 text-indigo-400"
      : "text-slate-400 hover:text-indigo-400 hover:bg-white/[0.06]"
    }`;

  const mobileLinkCls = (href: string) =>
    `flex items-center gap-3 px-4 py-3 text-sm rounded-xl transition-all duration-200 ${isActive(href)
      ? "bg-indigo-500/15 text-indigo-400 font-medium"
      : "text-slate-300 hover:bg-white/[0.06]"
    }`;

  const dropdownLinkCls = "flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.08] transition-colors";

  return (
    <nav className="sticky top-0 z-50 bg-[#0a0f1c]/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-14">
          <div className="flex items-center">
            <Link href="/dashboard" className="text-lg font-bold text-indigo-400 flex items-center gap-1.5">
              🍽️ <span className="hidden sm:inline">MessMate</span>
            </Link>
            {/* Desktop: primary links + More dropdown */}
            <div className="hidden md:flex ml-6 items-center gap-1">
              <Link href="/dashboard" className={linkCls("/dashboard")}>Dashboard</Link>
              <Link href="/calendar" className={linkCls("/calendar")}>Calendar</Link>
              <Link href="/billing" className={linkCls("/billing")}>Billing</Link>
              <Link href="/bazar" className={linkCls("/bazar")}>Bazar</Link>
              <Link href="/transparency" className={linkCls("/transparency")}>Transparency</Link>
              <Link href="/analysis" className={linkCls("/analysis")}>Analysis</Link>

              {/* More dropdown */}
              <div ref={moreRef} className="relative">
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${moreOpen ? "bg-white/[0.08] text-indigo-400" : "text-slate-400 hover:text-indigo-400 hover:bg-white/[0.06]"
                    }`}
                >
                  More ▾
                </button>
                {moreOpen && (
                  <div className="absolute top-full right-0 mt-2 w-52 bg-[#12172b]/95 backdrop-blur-xl rounded-xl shadow-2xl shadow-black/40 border border-white/[0.08] py-2 z-50">
                    <Link href="/meal-plan" onClick={() => setMoreOpen(false)} className={dropdownLinkCls}>🍳 Meal Plan</Link>
                    <Link href="/washroom" onClick={() => setMoreOpen(false)} className={dropdownLinkCls}>🚿 Washroom</Link>
                    <Link href="/bazar-duty" onClick={() => setMoreOpen(false)} className={dropdownLinkCls}>🛒 Bazar Duty</Link>
                    <Link href="/washroom-duty" onClick={() => setMoreOpen(false)} className={dropdownLinkCls}>🧹 Washroom Duty</Link>
                    <Link href="/bills" onClick={() => setMoreOpen(false)} className={dropdownLinkCls}>💳 Bills & Rent</Link>
                    <hr className="my-1.5 border-white/[0.06]" />
                    <Link href="/announcements" onClick={() => setMoreOpen(false)} className={dropdownLinkCls}>📢 Notices</Link>
                    <Link href="/meal-vote" onClick={() => setMoreOpen(false)} className={dropdownLinkCls}>🗳️ Vote</Link>
                    <Link href="/meal-rating" onClick={() => setMoreOpen(false)} className={dropdownLinkCls}>⭐ Rating</Link>
                    <Link href="/audit-log" onClick={() => setMoreOpen(false)} className={dropdownLinkCls}>🔍 Audit Log</Link>
                    <Link href="/archive" onClick={() => setMoreOpen(false)} className={dropdownLinkCls}>📦 Archive</Link>
                    {isManager && (
                      <>
                        <hr className="my-1.5 border-white/[0.06]" />
                        <div className="px-4 py-1 text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Manager</div>
                        <Link href="/manager/meals" onClick={() => setMoreOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-indigo-400 hover:bg-indigo-500/10 transition-colors">✏️ Meal Entry</Link>
                        <Link href="/manager/deposits" onClick={() => setMoreOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-indigo-400 hover:bg-indigo-500/10 transition-colors">💰 Deposits</Link>
                        <Link href="/manager/handover" onClick={() => setMoreOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-indigo-400 hover:bg-indigo-500/10 transition-colors">🔄 Handover</Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Desktop right section */}
          <div className="hidden md:flex items-center gap-2">
            <Link href="/notifications" className="relative p-2 text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-white/[0.06] transition-all duration-200">
              🔔
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
            <Link href="/mess-info" className="p-2 text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-white/[0.06] text-sm transition-all duration-200">🏠</Link>
            <Link href="/profile" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-300 hover:text-indigo-400 rounded-lg hover:bg-white/[0.06] transition-all duration-200">
              <span className="w-6 h-6 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center text-xs font-bold border border-indigo-500/30">
                {session.user?.name?.charAt(0)?.toUpperCase() || "?"}
              </span>
              <span className="max-w-[100px] truncate">{session.user?.name}</span>
              {isManager && <span className="px-1.5 py-0.5 bg-indigo-500/15 text-indigo-400 text-[10px] font-bold rounded-full border border-indigo-500/25">MGR</span>}
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="p-2 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 text-sm transition-all duration-200"
              title="Logout"
            >
              🚪
            </button>
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <Link href="/notifications" className="relative p-2 text-slate-400">
              🔔
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 text-slate-300 text-xl">
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 max-h-[75vh] overflow-y-auto space-y-0.5">
            <div className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Main</div>
            <Link href="/dashboard" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/dashboard")}>📊 Dashboard</Link>
            <Link href="/calendar" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/calendar")}>📅 Calendar</Link>
            <Link href="/billing" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/billing")}>📊 Billing</Link>
            <Link href="/bazar" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/bazar")}>🛒 Bazar</Link>
            <Link href="/transparency" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/transparency")}>👁️ Transparency</Link>
            <Link href="/analysis" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/analysis")}>📉 Analysis</Link>

            <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">More</div>
            <Link href="/meal-plan" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/meal-plan")}>🍳 Meal Plan</Link>
            <Link href="/washroom" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/washroom")}>🚿 Washroom</Link>
            <Link href="/bazar-duty" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/bazar-duty")}>🛒 Bazar Duty</Link>
            <Link href="/washroom-duty" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/washroom-duty")}>🧹 Washroom Duty</Link>
            <Link href="/bills" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/bills")}>💳 Bills & Rent</Link>
            <Link href="/announcements" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/announcements")}>📢 Notices</Link>
            <Link href="/meal-vote" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/meal-vote")}>🗳️ Vote</Link>
            <Link href="/meal-rating" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/meal-rating")}>⭐ Rating</Link>
            <Link href="/audit-log" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/audit-log")}>🔍 Audit Log</Link>
            <Link href="/archive" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/archive")}>📦 Archive</Link>

            {isManager && (
              <>
                <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Manager</div>
                <Link href="/manager/meals" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/manager/meals")}>✏️ Meal Entry</Link>
                <Link href="/manager/deposits" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/manager/deposits")}>💰 Deposits</Link>
                <Link href="/manager/handover" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/manager/handover")}>🔄 Handover</Link>
              </>
            )}

            <hr className="my-2 border-white/[0.06]" />
            <Link href="/mess-info" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/mess-info")}>🏠 Mess Info</Link>
            <Link href="/profile" onClick={() => setMenuOpen(false)} className={mobileLinkCls("/profile")}>⚙️ Profile</Link>
            <button
              onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/login" }); }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
            >
              🚪 Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
