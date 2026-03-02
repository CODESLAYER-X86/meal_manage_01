"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: "⚡" },
  { href: "/admin/messes", label: "Messes", icon: "🏠" },
  { href: "/admin/users", label: "Users", icon: "👤" },
  { href: "/admin/audit", label: "Audit Log", icon: "📋" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && !isAdmin) {
      router.push("/dashboard");
    }
  }, [status, isAdmin, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f0f23]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-violet-400 text-sm font-medium">Loading Admin…</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-[#0f0f23] text-gray-100">
      {/* Sidebar - Desktop fixed, Mobile overlay */}
      <aside className={`
        fixed top-0 left-0 z-40 h-screen w-64 bg-[#13132b]/95 backdrop-blur-xl border-r border-white/5
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
      `}>
        {/* Logo */}
        <div className="px-6 py-6 border-b border-white/5">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-500/20">
              M
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">MessMate</h1>
              <p className="text-[10px] text-violet-400 font-medium uppercase tracking-widest">Admin Panel</p>
            </div>
          </Link>
        </div>

        {/* Nav Links */}
        <nav className="px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${isActive(item.href)
                  ? "bg-gradient-to-r from-violet-500/20 to-indigo-500/10 text-white shadow-sm border border-violet-500/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
                }
              `}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
              {isActive(item.href) && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 shadow-sm shadow-violet-400/50" />
              )}
            </Link>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/5 space-y-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
          >
            ← Back to App
          </Link>
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold">
              {session?.user?.name?.charAt(0)?.toUpperCase() || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-300 truncate">{session?.user?.name}</p>
              <p className="text-[10px] text-gray-500 truncate">{session?.user?.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-gray-500 hover:text-red-400 transition-colors text-sm"
              title="Logout"
            >
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content Area */}
      <div className="md:ml-64 min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-[#0f0f23]/80 backdrop-blur-xl border-b border-white/5">
          <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                ☰
              </button>
              <div>
                <h2 className="text-sm font-semibold text-white capitalize">
                  {pathname === "/admin" ? "Overview" : pathname.split("/").pop()}
                </h2>
                <p className="text-[10px] text-gray-500">Super Admin Control Center</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                System Online
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
