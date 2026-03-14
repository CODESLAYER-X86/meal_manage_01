"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

/* eslint-disable @typescript-eslint/no-explicit-any */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type ViewTab = "transparency" | "calendar" | "billing" | "meals" | "deposits" | "bazar" | "audit" | "washroom" | "mealplan" | "ratings" | "announcements" | "votes" | "billpayments";

export default function ArchivePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export controls
  const now = new Date();
  const [exportMonth, setExportMonth] = useState(now.getMonth()); // previous month by default
  const [exportYear, setExportYear] = useState(now.getFullYear());
  const [exporting, setExporting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Cleanup
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [cleaningUp, setCleaningUp] = useState(false);

  // Import / Viewer
  const [archive, setArchive] = useState<any>(null);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [viewTab, setViewTab] = useState<ViewTab>("transparency");
  const [auditFilter, setAuditFilter] = useState("all");

  const isManager = session?.user?.role === "MANAGER";

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Set default export to the month BEFORE current
  useEffect(() => {
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    setExportMonth(prev.getMonth() + 1);
    setExportYear(prev.getFullYear());
  }, []);

  // ===== EXPORT =====
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/archive/export?month=${exportMonth}&year=${exportYear}`);
      if (!res.ok) {
        let msg = "Unknown error";
        try { msg = (await res.json()).error; } catch { msg = res.statusText; }
        alert("Export failed: " + msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      a.download = match ? match[1] : `archive-${exportMonth}-${exportYear}.messmate`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed — check your connection and try again");
    } finally {
      setExporting(false);
    }
  };

  // ===== CSV EXPORT =====
  const handleCsvExport = async () => {
    setExportingCsv(true);
    try {
      const res = await fetch(`/api/archive/export-csv?month=${exportMonth}&year=${exportYear}`);
      if (!res.ok) {
        let msg = "Unknown error";
        try { msg = (await res.json()).error; } catch { msg = res.statusText; }
        alert("CSV export failed: " + msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      a.download = match ? match[1] : `report-${exportMonth}-${exportYear}.csv`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("CSV export failed — check your connection and try again");
    } finally {
      setExportingCsv(false);
    }
  };

  // ===== CLEANUP =====
  const handleCleanup = async () => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 2);
    const cutoffStr = `${MONTH_NAMES[cutoff.getMonth()]} ${cutoff.getFullYear()}`;
    if (!confirm(`⚠️ This will PERMANENTLY DELETE all data from ${cutoffStr} and older.\n\nMake sure you have exported those months first!\n\nContinue?`)) return;
    setCleaningUp(true);
    setCleanupResult(null);
    try {
      const res = await fetch("/api/archive/cleanup", { method: "POST" });
      const data = await res.json();
      setCleanupResult(data);
    } catch {
      alert("Cleanup failed");
    } finally {
      setCleaningUp(false);
    }
  };

  // ===== IMPORT — entirely local, no server upload =====
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    setArchive(null);
    setImporting(true);

    try {
      const text = await file.text();

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        setImportError("Invalid file format — cannot parse");
        return;
      }

      const { archive: arch, _checksum } = parsed;

      if (!arch || !_checksum) {
        setImportError("Invalid .messmate file — missing structure");
        return;
      }

      if (arch._format !== "messmate-archive" || arch._version !== 1) {
        setImportError("Unsupported archive format or version");
        return;
      }

      // Verify integrity checksum locally in the browser
      const encoder = new TextEncoder();
      const buf = encoder.encode(JSON.stringify(arch));
      const hashBuf = await crypto.subtle.digest("SHA-256", buf);
      const hashArray = Array.from(new Uint8Array(hashBuf));
      const computedHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      if (computedHash !== _checksum) {
        setImportError("File integrity check failed — the file may have been tampered with");
        return;
      }

      setArchive(arch);
      setViewTab("transparency");
    } catch {
      setImportError("Failed to read or validate the file");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ===== CLOSE VIEWER =====
  const closeViewer = () => {
    setArchive(null);
    setImportError("");
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  // ===== RENDER ARCHIVE VIEWER (when file is imported) =====
  if (archive) {
    return <ArchiveViewer archive={archive} viewTab={viewTab} setViewTab={setViewTab} auditFilter={auditFilter} setAuditFilter={setAuditFilter} onClose={closeViewer} />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-white">📦 Data Archive</h1>
        <p className="text-sm text-slate-400 mt-1">
          Export monthly data, import old archives for investigation, and manage auto-cleanup.
        </p>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <strong>ℹ️ Auto-cleanup:</strong> Data older than 2 months is automatically deleted on the 1st of each month at 3 AM.
          Always export before cleanup!
        </div>
      </div>

      {/* Export Section */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-white mb-3">📤 Export Monthly Archive</h2>
        <p className="text-sm text-slate-400 mb-4">
          Download your monthly data as a <code className="bg-gray-100 px-1 rounded">.messmate</code> archive (for this app) or as a <code className="bg-gray-100 px-1 rounded">.csv</code> spreadsheet file.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={exportMonth}
            onChange={(e) => setExportMonth(Number(e.target.value))}
            className="px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={exportYear}
            onChange={(e) => setExportYear(Number(e.target.value))}
            className="px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "📤 Download .messmate"}
          </button>
          <button
            onClick={handleCsvExport}
            disabled={exportingCsv}
            className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {exportingCsv ? "Exporting..." : "📊 Download CSV"}
          </button>
        </div>
      </div>

      {/* Import Section */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-white mb-3">📥 Import & Investigate Archive</h2>
        <p className="text-sm text-slate-400 mb-4">
          Open a <code className="bg-gray-100 px-1 rounded">.messmate</code> file to analyze old data — audit logs, billing, meals, bazar, everything.
          <strong className="text-slate-300"> The file stays on your device</strong> — nothing is uploaded to any server.
          It&apos;s verified locally for integrity (tamper detection).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".messmate"
            onChange={handleImport}
            className="text-sm file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-100 file:text-green-700 hover:file:bg-green-200"
          />
          {importing && <span className="text-sm text-slate-400">Validating...</span>}
        </div>
        {importError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            ⚠️ {importError}
          </div>
        )}
      </div>

      {/* Cleanup Section (Manager Only) */}
      {isManager && (
        <div className="bg-red-50 rounded-xl shadow-md shadow-black/10 border border-red-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-3">🗑️ Manual Cleanup (Manager)</h2>
          <p className="text-sm text-red-700 mb-4">
            Delete all data older than 2 months. This runs automatically on the 1st of each month,
            but you can trigger it manually here.
          </p>
          <button
            onClick={handleCleanup}
            disabled={cleaningUp}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {cleaningUp ? "Cleaning up..." : "🗑️ Run Cleanup Now"}
          </button>
          {cleanupResult && (
            <div className="mt-4 p-3 bg-white border border-red-200 rounded-lg text-sm">
              <p className="font-medium text-slate-100">
                ✅ Cleanup complete — {cleanupResult.totalDeleted} records deleted
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Cutoff: {new Date(cleanupResult.cutoffDate).toLocaleDateString()}
              </p>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {Object.entries(cleanupResult.details || {}).map(([key, count]) => (
                  <div key={key} className="bg-white/[0.02] rounded p-2">
                    <span className="text-slate-400">{key}:</span>{" "}
                    <span className="font-medium text-slate-100">{count as number}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== ARCHIVE VIEWER COMPONENT =====
function ArchiveViewer({
  archive,
  viewTab,
  setViewTab,
  auditFilter,
  setAuditFilter,
  onClose,
}: {
  archive: any;
  viewTab: ViewTab;
  setViewTab: (t: ViewTab) => void;
  auditFilter: string;
  setAuditFilter: (f: string) => void;
  onClose: () => void;
}) {
  const { period, mess, billing, data, exportedAt, exportedBy } = archive;
  const monthName = `${MONTH_NAMES[period.month - 1]} ${period.year}`;

  const tabs: { id: ViewTab; label: string; emoji: string }[] = [
    { id: "transparency", label: "Transparency", emoji: "👁️" },
    { id: "calendar", label: "Calendar", emoji: "📅" },
    { id: "billing", label: "Billing", emoji: "💰" },
    { id: "meals", label: "Meals", emoji: "🍽️" },
    { id: "deposits", label: "Deposits", emoji: "💵" },
    { id: "bazar", label: "Bazar", emoji: "🛒" },
    { id: "audit", label: "Audit Log", emoji: "🔍" },
    { id: "washroom", label: "Washroom", emoji: "🚿" },
    { id: "mealplan", label: "Menu", emoji: "🍳" },
    { id: "ratings", label: "Ratings", emoji: "⭐" },
    { id: "announcements", label: "Notices", emoji: "📢" },
    { id: "votes", label: "Votes", emoji: "🗳️" },
    { id: "billpayments", label: "Bills", emoji: "💳" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl shadow-md shadow-black/10 border border-indigo-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📂</span>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                Archive: {monthName}
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {mess?.name} · Exported {new Date(exportedAt).toLocaleDateString()} by {exportedBy?.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-slate-300 text-sm font-medium rounded-lg transition-colors"
          >
            ✕ Close Archive
          </button>
        </div>
        <div className="mt-3 px-3 py-1.5 bg-amber-100 border border-amber-300 rounded-lg text-xs text-amber-800 inline-block">
          📖 Read-only archived data — no edits possible
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border p-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setViewTab(tab.id)}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${viewTab === tab.id
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-slate-400 hover:bg-gray-200"
              }`}
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md shadow-black/10 border p-4 sm:p-6">
        {viewTab === "transparency" && <TransparencyView archive={archive} />}
        {viewTab === "calendar" && <CalendarView archive={archive} />}
        {viewTab === "billing" && <BillingView billing={billing} />}
        {viewTab === "meals" && <MealsView mealEntries={data.mealEntries} />}
        {viewTab === "deposits" && <DepositsView deposits={data.deposits} />}
        {viewTab === "bazar" && <BazarView bazarTrips={data.bazarTrips} />}
        {viewTab === "audit" && <AuditView auditLogs={data.auditLogs} filter={auditFilter} setFilter={setAuditFilter} />}
        {viewTab === "washroom" && <WashroomView duties={data.washroomDuties} />}
        {viewTab === "mealplan" && <MealPlanView plans={data.mealPlans} />}
        {viewTab === "ratings" && <RatingsView ratings={data.mealRatings} />}
        {viewTab === "announcements" && <AnnouncementsView announcements={data.announcements} />}
        {viewTab === "votes" && <VotesView topics={data.mealVoteTopics} />}
        {viewTab === "billpayments" && <BillPaymentsView payments={data.billPayments} settings={data.billSettings} members={archive.members} />}
      </div>
    </div>
  );
}

// ===== Sub-views for each data type =====

function TransparencyView({ archive }: { archive: any }) {
  const { billing, data, members: archiveMembers } = archive;
  const mealEntries = data?.mealEntries || [];
  const deposits = data?.deposits || [];
  const bazarTrips = data?.bazarTrips || [];
  const washroomDuties = data?.washroomDuties || [];
  const billSettings = data?.billSettings || [];
  const billPayments = data?.billPayments || [];
  const dutyDebts = data?.dutyDebts || [];
  const memberList = archiveMembers || [];

  const setting = billSettings?.[0];
  const rents = setting ? JSON.parse(setting.rents || "{}") : {};
  const memberBillMap: Record<string, number> = {};
  if (setting) {
    const shared = ((setting.wifi || 0) + (setting.electricity || 0) + (setting.gas || 0) + (setting.cookSalary || 0)) / Math.max(memberList.length, 1);
    memberList.forEach((m: any) => {
      memberBillMap[m.id] = shared + (rents[m.id] || 0);
    });
  }

  const totalBazar = bazarTrips.reduce((sum: number, t: any) => sum + (t.totalCost || 0), 0);
  const totalAllMeals = mealEntries.reduce((sum: number, e: any) => sum + (e.total || 0), 0);
  const mealRate = totalAllMeals > 0 ? totalBazar / totalAllMeals : 0;

  // Build scorecard
  const scorecard = memberList.map((m: any) => {
    const id = m.id;
    const name = m.name;

    const memberMeals = mealEntries.filter((e: any) => (e.member?.id || e.memberId) === id);
    const totalMealsCount = memberMeals.reduce((sum: number, e: any) => sum + (e.total || 0), 0);
    const mealCost = totalMealsCount * mealRate;

    const memberDeposits = deposits.filter((d: any) => (d.member?.id || d.memberId) === id);
    const totalDeposit = memberDeposits.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
    const mealDue = mealCost - totalDeposit;

    const billDue = memberBillMap[id] || 0;
    const memberPayments = billPayments.filter((p: any) => (p.member?.id || p.memberId) === id);
    const billPaid = memberPayments.filter((p: any) => p.confirmed).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const billRemaining = billDue - billPaid;

    const washroomCount = washroomDuties.filter((d: any) => (d.member?.id || d.memberId) === id).length;
    const bazarTripCount = bazarTrips.filter((t: any) => (t.buyer?.id || t.buyerId) === id).length;

    return { id, name, totalMealsCount, mealCost, totalDeposit, mealDue, billDue, billPaid, billRemaining, washroomCount, bazarTripCount };
  });

  return (
    <div className="space-y-6">
      {/* Scorecard */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">📊 Member Scorecard</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm min-w-[700px]">
            <thead className="bg-white/[0.02]">
              <tr>
                <th className="text-left p-2 sm:p-3">Member</th>
                <th className="text-center p-2 sm:p-3">Meals</th>
                <th className="text-right p-2 sm:p-3">Meal Cost</th>
                <th className="text-right p-2 sm:p-3">Deposits</th>
                <th className="text-right p-2 sm:p-3">Meal Due</th>
                <th className="text-right p-2 sm:p-3">Bill Due</th>
                <th className="text-right p-2 sm:p-3">Bill Paid</th>
                <th className="text-center p-2 sm:p-3">WC</th>
                <th className="text-center p-2 sm:p-3">Bazar</th>
              </tr>
            </thead>
            <tbody>
              {scorecard.map((s: any) => (
                <tr key={s.id} className="border-t hover:bg-white/[0.02]">
                  <td className="p-2 sm:p-3 font-medium text-slate-100">{s.name}</td>
                  <td className="p-2 sm:p-3 text-center">{s.totalMealsCount}</td>
                  <td className="p-2 sm:p-3 text-right">৳{s.mealCost.toFixed(0)}</td>
                  <td className="p-2 sm:p-3 text-right text-green-600">৳{s.totalDeposit.toFixed(0)}</td>
                  <td className={`p-2 sm:p-3 text-right font-bold ${s.mealDue > 0 ? "text-red-600" : "text-green-600"}`}>
                    ৳{s.mealDue.toFixed(0)}
                  </td>
                  <td className="p-2 sm:p-3 text-right">৳{s.billDue.toFixed(0)}</td>
                  <td className={`p-2 sm:p-3 text-right ${s.billRemaining > 0 ? "text-red-600" : "text-green-600"}`}>
                    ৳{s.billPaid.toFixed(0)}
                  </td>
                  <td className="p-2 sm:p-3 text-center">
                    <span className={s.washroomCount > 0 ? "text-green-600" : "text-slate-500"}>{s.washroomCount}</span>
                  </td>
                  <td className="p-2 sm:p-3 text-center">
                    <span className={s.bazarTripCount > 0 ? "text-green-600" : "text-slate-500"}>{s.bazarTripCount}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {mealRate > 0 && (
          <div className="mt-2 text-xs text-slate-400 px-2">
            Meal rate: ৳{mealRate.toFixed(2)}/meal · Total bazar: ৳{totalBazar.toFixed(0)} · Total meals: {totalAllMeals}
          </div>
        )}
      </div>

      {/* Bill Payment Status */}
      {Object.keys(memberBillMap).length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">💳 Bill Payment Status</h2>
          <div className="space-y-3">
            {scorecard.map((s: any) => {
              const pct = s.billDue > 0 ? Math.min((s.billPaid / s.billDue) * 100, 100) : 0;
              return (
                <div key={s.id} className="bg-white/[0.02] rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-sm text-slate-100">{s.name}</span>
                    <span className={`text-xs font-bold ${s.billRemaining <= 0 ? "text-green-600" : "text-red-600"}`}>
                      {s.billRemaining <= 0 ? "✅ Paid" : `৳${s.billRemaining.toFixed(0)} remaining`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${s.billRemaining <= 0 ? "bg-green-500" : "bg-orange-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>Paid: ৳{s.billPaid.toFixed(0)}</span>
                    <span>Due: ৳{s.billDue.toFixed(0)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Washroom Log */}
      {washroomDuties.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">🚿 Washroom Cleaning Log</h2>
          <div className="space-y-1">
            {washroomDuties.map((d: any) => (
              <div key={d.id} className="p-3 bg-white/[0.02] rounded-lg flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-400 text-xs w-20">{new Date(d.date).toLocaleDateString()}</span>
                <span className="font-medium text-slate-100">{d.member?.name || "Unknown"}</span>
                <span className="text-xs text-slate-500">WR-{d.washroomNumber}</span>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✅ Done</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bazar Trips */}
      {bazarTrips.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">🛒 Bazar Trips</h2>
          <div className="space-y-1">
            {bazarTrips.map((t: any, i: number) => (
              <div key={t.id || i} className="p-3 bg-white/[0.02] rounded-lg flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-400 text-xs w-20">{new Date(t.date).toLocaleDateString()}</span>
                <span className="font-medium text-slate-100">{t.buyer?.name || "Unknown"}</span>
                <span className="font-bold text-orange-700">৳{t.totalCost}</span>
                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${t.approved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  }`}>
                  {t.approved ? "✅ Approved" : "⏳ Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duty Debts */}
      {dutyDebts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">⚖️ Duty Debts</h2>
          <div className="space-y-1">
            {dutyDebts.map((d: any) => (
              <div key={d.id} className="p-3 bg-white/[0.02] rounded-lg text-sm flex flex-wrap items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${d.dutyType === "WASHROOM" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                  }`}>{d.dutyType}</span>
                <span className="text-red-600 font-medium">{d.owedBy?.name}</span>
                <span className="text-slate-500">→</span>
                <span className="text-green-600 font-medium">{d.owedTo?.name}</span>
                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${d.status === "SETTLED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  }`}>{d.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meal Summary */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">🍛 Meal Counts</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-white/[0.02]">
              <tr>
                <th className="text-left p-2 sm:p-3">Member</th>
                <th className="text-center p-2 sm:p-3">Total Meals</th>
                <th className="text-right p-2 sm:p-3">Deposits</th>
              </tr>
            </thead>
            <tbody>
              {scorecard.map((s: any) => (
                <tr key={s.id} className="border-t hover:bg-white/[0.02]">
                  <td className="p-2 sm:p-3 font-medium text-slate-100">{s.name}</td>
                  <td className="p-2 sm:p-3 text-center font-bold text-indigo-600">{s.totalMealsCount}</td>
                  <td className="p-2 sm:p-3 text-right text-green-600">৳{s.totalDeposit.toFixed(0)}</td>
                </tr>
              ))}
              <tr className="border-t bg-white/[0.02] font-bold">
                <td className="p-2 sm:p-3">Total</td>
                <td className="p-2 sm:p-3 text-center text-indigo-700">{scorecard.reduce((sum: number, s: any) => sum + s.totalMealsCount, 0)}</td>
                <td className="p-2 sm:p-3 text-right text-green-700">৳{scorecard.reduce((sum: number, s: any) => sum + s.totalDeposit, 0).toFixed(0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CalendarView({ archive }: { archive: any }) {
  const { period, data } = archive;
  const [selectedDate, setSelectedDate] = useState<number | null>(null);

  const mealEntries = data?.mealEntries || [];
  const bazarTrips = data?.bazarTrips || [];
  const washroomDuties = data?.washroomDuties || [];
  const mealPlans = data?.mealPlans || [];

  const month = period.month; // 1-indexed
  const year = period.year;
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const monthName = new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const dateStr = (day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const getMeals = (day: number) => mealEntries.filter((m: any) => (m.date || "").startsWith(dateStr(day)));
  const getBazar = (day: number) => bazarTrips.filter((t: any) => (t.date || "").startsWith(dateStr(day)));
  const getWashroom = (day: number) => washroomDuties.filter((w: any) => (w.date || "").startsWith(dateStr(day)));
  const getPlan = (day: number) => mealPlans.find((p: any) => (p.date || "").startsWith(dateStr(day)));
  const getTotalMeals = (day: number) => getMeals(day).reduce((sum: number, m: any) => sum + (m.total || 0), 0);

  const selMeals = selectedDate ? getMeals(selectedDate) : [];
  const selBazar = selectedDate ? getBazar(selectedDate) : [];
  const selWashroom = selectedDate ? getWashroom(selectedDate) : [];
  const selPlan = selectedDate ? getPlan(selectedDate) : undefined;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">📅 {monthName}</h2>

      {/* Calendar Grid */}
      <div className="rounded-xl border overflow-hidden">
        <div className="grid grid-cols-7 bg-white/[0.02]">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="p-1.5 sm:p-3 text-center text-xs sm:text-sm font-medium text-slate-400 border-b">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`e-${i}`} className="p-1 sm:p-3 border-b border-r min-h-[52px] sm:min-h-[80px] bg-white/[0.02]" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const totalMeals = getTotalMeals(day);
            const hasBazar = getBazar(day).length > 0;
            const hasWashroom = getWashroom(day).length > 0;
            const dayPlan = getPlan(day);
            const hasMenu = dayPlan && (dayPlan.breakfast || dayPlan.lunch || dayPlan.dinner);
            const isSelected = selectedDate === day;
            return (
              <div
                key={day}
                onClick={() => setSelectedDate(day)}
                className={`p-1 sm:p-2 border-b border-r min-h-[52px] sm:min-h-[80px] cursor-pointer transition hover:bg-indigo-50 ${isSelected ? "bg-indigo-100 ring-2 ring-indigo-400" : ""
                  }`}
              >
                <div className="text-xs sm:text-sm font-medium text-slate-300">{day}</div>
                {totalMeals > 0 && (
                  <div className="mt-0.5 text-[10px] sm:text-xs bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded-full inline-block">🍛{totalMeals}</div>
                )}
                {hasBazar && (
                  <div className="mt-0.5 text-[10px] sm:text-xs bg-orange-100 text-orange-700 px-1 py-0.5 rounded-full inline-block">🛒</div>
                )}
                {hasWashroom && (
                  <div className="mt-0.5 text-[10px] sm:text-xs bg-teal-100 text-teal-700 px-1 py-0.5 rounded-full inline-block">🚿</div>
                )}
                {hasMenu && (
                  <div className="mt-0.5 text-[10px] sm:text-xs bg-purple-100 text-purple-700 px-1 py-0.5 rounded-full inline-block">📋</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Detail */}
      {selectedDate && (
        <div className="bg-white/[0.02] rounded-xl border p-5 space-y-4">
          <h3 className="text-lg font-semibold text-slate-100">
            📋 {monthName.split(" ")[0]} {selectedDate}, {year}
          </h3>

          {/* Menu */}
          <div>
            <h4 className="text-sm font-semibold text-slate-400 mb-2">📋 Menu</h4>
            {selPlan && (selPlan.breakfast || selPlan.lunch || selPlan.dinner) ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {selPlan.breakfast && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-600 mb-1">🌅 Breakfast</p>
                    <p className="text-sm text-slate-100">{selPlan.breakfast}</p>
                  </div>
                )}
                {selPlan.lunch && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-orange-600 mb-1">☀️ Lunch</p>
                    <p className="text-sm text-slate-100">{selPlan.lunch}</p>
                  </div>
                )}
                {selPlan.dinner && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-indigo-600 mb-1">🌙 Dinner</p>
                    <p className="text-sm text-slate-100">{selPlan.dinner}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No menu set for this day</p>
            )}
          </div>

          {/* Meals */}
          <div>
            <h4 className="text-sm font-semibold text-slate-400 mb-2">🍛 Meals</h4>
            {selMeals.length === 0 ? (
              <p className="text-sm text-slate-500">No meals recorded</p>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden space-y-2">
                  {selMeals.map((m: any) => (
                    <div key={m.id} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-lg p-3 border">
                      <p className="font-medium text-white text-sm mb-1">{m.member?.name || "Unknown"}</p>
                      <div className="grid grid-cols-4 gap-2 text-xs text-center">
                        <div><p className="text-slate-500">B</p><p className="font-bold">{m.breakfast}</p></div>
                        <div><p className="text-slate-500">L</p><p className="font-bold">{m.lunch}</p></div>
                        <div><p className="text-slate-500">D</p><p className="font-bold">{m.dinner}</p></div>
                        <div><p className="text-slate-500">Total</p><p className="font-bold text-indigo-600">{m.total}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08]">
                      <tr>
                        <th className="text-left p-2">Member</th>
                        <th className="text-center p-2">Breakfast</th>
                        <th className="text-center p-2">Lunch</th>
                        <th className="text-center p-2">Dinner</th>
                        <th className="text-center p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selMeals.map((m: any) => (
                        <tr key={m.id} className="border-t">
                          <td className="p-2 font-medium">{m.member?.name || "Unknown"}</td>
                          <td className="text-center p-2">{m.breakfast}</td>
                          <td className="text-center p-2">{m.lunch}</td>
                          <td className="text-center p-2">{m.dinner}</td>
                          <td className="text-center p-2 font-bold">{m.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Bazar */}
          <div>
            <h4 className="text-sm font-semibold text-slate-400 mb-2">🛒 Bazar / Market Purchases</h4>
            {selBazar.length === 0 ? (
              <p className="text-sm text-slate-500">No market purchases</p>
            ) : (
              selBazar.map((trip: any) => (
                <div key={trip.id} className="mb-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Buyer: {trip.buyer?.name || "Unknown"}</span>
                    <span className="font-bold text-orange-700">৳{trip.totalCost}</span>
                  </div>
                  {trip.items?.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-orange-100">
                          <tr>
                            <th className="text-left p-1.5">SL</th>
                            <th className="text-left p-1.5">Item</th>
                            <th className="text-center p-1.5">Qty</th>
                            <th className="text-center p-1.5">Unit</th>
                            <th className="text-right p-1.5">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trip.items.map((item: any) => (
                            <tr key={item.serialNo || item.id} className="border-t border-orange-200">
                              <td className="p-1.5">{item.serialNo}</td>
                              <td className="p-1.5">{item.itemName}</td>
                              <td className="text-center p-1.5">{item.quantity}</td>
                              <td className="text-center p-1.5">{item.unit}</td>
                              <td className="text-right p-1.5">৳{item.price}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Washroom */}
          <div>
            <h4 className="text-sm font-semibold text-slate-400 mb-2">🚿 Washroom Cleaning</h4>
            {selWashroom.length === 0 ? (
              <p className="text-sm text-slate-500">No washroom cleaning</p>
            ) : (
              <div className="space-y-1">
                {selWashroom.map((w: any) => (
                  <div key={w.id} className="flex items-center gap-2 text-sm bg-teal-50 rounded-lg p-2 border border-teal-200">
                    <span className="text-xs font-medium bg-teal-100 text-teal-700 px-2 py-0.5 rounded">WR-{w.washroomNumber}</span>
                    <span className="text-slate-300">{w.member?.name || "Unknown"}</span>
                    <span className="ml-auto text-xs text-green-600 font-bold">✅ Done</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!selectedDate && (
        <p className="text-center text-slate-500 text-sm py-4">👆 Click on a date to see details</p>
      )}
    </div>
  );
}

function BillingView({ billing }: { billing: any }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">💰 Billing Summary</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white/[0.02] p-3 sm:p-4 rounded-lg text-center">
          <p className="text-sm text-slate-400">Total Expense</p>
          <p className="text-xl sm:text-2xl font-bold text-red-600">৳{billing.totalExpense}</p>
        </div>
        <div className="bg-white/[0.02] p-3 sm:p-4 rounded-lg text-center">
          <p className="text-sm text-slate-400">Total Meals</p>
          <p className="text-xl sm:text-2xl font-bold text-indigo-600">{billing.totalMeals}</p>
        </div>
        <div className="bg-white/[0.02] p-3 sm:p-4 rounded-lg text-center">
          <p className="text-sm text-slate-400">Meal Rate</p>
          <p className="text-xl sm:text-2xl font-bold text-indigo-600">৳{billing.mealRate}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm min-w-[480px]">
          <thead className="bg-white/[0.02]">
            <tr>
              <th className="text-left p-2 sm:p-3">Member</th>
              <th className="text-center p-2 sm:p-3">Meals</th>
              <th className="text-right p-2 sm:p-3">Cost</th>
              <th className="text-right p-2 sm:p-3">Deposited</th>
              <th className="text-right p-2 sm:p-3">Net Due</th>
              <th className="text-center p-2 sm:p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {billing.members?.map((m: any) => (
              <tr key={m.id} className="border-t">
                <td className="p-2 sm:p-3 font-medium">{m.name}</td>
                <td className="p-2 sm:p-3 text-center">{m.totalMeals}</td>
                <td className="p-2 sm:p-3 text-right">৳{m.mealCost}</td>
                <td className="p-2 sm:p-3 text-right text-green-600">৳{m.totalDeposit}</td>
                <td className={`p-2 sm:p-3 text-right font-bold ${m.netDue > 0 ? "text-red-600" : "text-green-600"}`}>
                  {m.netDue > 0 ? `৳${m.netDue}` : `-৳${Math.abs(m.netDue)}`}
                </td>
                <td className="p-2 sm:p-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.netDue > 0 ? "bg-red-100 text-red-700" : m.netDue < 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-slate-400"
                    }`}>
                    {m.netDue > 0 ? "Owes" : m.netDue < 0 ? "Refund" : "Settled"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MealsView({ mealEntries }: { mealEntries: any[] }) {
  // Group by date
  const byDate: Record<string, any[]> = {};
  for (const e of mealEntries || []) {
    const d = new Date(e.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(e);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">🍽️ Meal Entries ({mealEntries?.length || 0})</h2>
      {Object.entries(byDate).map(([date, entries]) => (
        <div key={date} className="border rounded-lg overflow-hidden">
          <div className="bg-white/[0.02] px-4 py-2 font-medium text-slate-300 text-sm">{date}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm min-w-[360px]">
              <thead>
                <tr className="text-slate-400 text-xs">
                  <th className="text-left p-2 pl-4">Member</th>
                  <th className="text-center p-2">🌅 B</th>
                  <th className="text-center p-2">☀️ L</th>
                  <th className="text-center p-2">🌙 D</th>
                  <th className="text-center p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e: any) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-2 pl-4">{e.member?.name || e.memberId}</td>
                    <td className="p-2 text-center">{e.breakfast}</td>
                    <td className="p-2 text-center">{e.lunch}</td>
                    <td className="p-2 text-center">{e.dinner}</td>
                    <td className="p-2 text-center font-medium">{e.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {(!mealEntries || mealEntries.length === 0) && (
        <p className="text-slate-500 text-center py-6">No meal entries in this archive</p>
      )}
    </div>
  );
}

function DepositsView({ deposits }: { deposits: any[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">💵 Deposits ({deposits?.length || 0})</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm min-w-[360px]">
          <thead className="bg-white/[0.02]">
            <tr>
              <th className="text-left p-2 sm:p-3">Date</th>
              <th className="text-left p-2 sm:p-3">Member</th>
              <th className="text-right p-2 sm:p-3">Amount</th>
              <th className="text-left p-2 sm:p-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {(deposits || []).map((d: any) => (
              <tr key={d.id} className="border-t">
                <td className="p-2 sm:p-3">{new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                <td className="p-2 sm:p-3">{d.member?.name || d.memberId}</td>
                <td className="p-2 sm:p-3 text-right font-medium text-green-600">৳{d.amount}</td>
                <td className="p-2 sm:p-3 text-slate-400">{d.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(!deposits || deposits.length === 0) && (
        <p className="text-slate-500 text-center py-6">No deposits in this archive</p>
      )}
    </div>
  );
}

function BazarView({ bazarTrips }: { bazarTrips: any[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">🛒 Bazar Trips ({bazarTrips?.length || 0})</h2>
      {(bazarTrips || []).map((trip: any) => (
        <div key={trip.id} className="border rounded-lg overflow-hidden">
          <div className="bg-white/[0.02] px-4 py-3 flex justify-between items-center">
            <div>
              <span className="font-medium text-slate-100">
                {new Date(trip.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
              <span className="text-slate-400 text-sm ml-2">by {trip.buyer?.name || trip.buyerId}</span>
            </div>
            <span className="font-bold text-indigo-600">৳{trip.totalCost}</span>
          </div>
          {trip.items && trip.items.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs">
                  <th className="text-left p-2 pl-4">SL</th>
                  <th className="text-left p-2">Item</th>
                  <th className="text-center p-2">Qty</th>
                  <th className="text-center p-2">Unit</th>
                  <th className="text-right p-2 pr-4">Price</th>
                </tr>
              </thead>
              <tbody>
                {trip.items.map((item: any) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-2 pl-4">{item.serialNo}</td>
                    <td className="p-2">{item.itemName}</td>
                    <td className="p-2 text-center">{item.quantity}</td>
                    <td className="p-2 text-center">{item.unit}</td>
                    <td className="p-2 text-right pr-4">৳{item.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
      {(!bazarTrips || bazarTrips.length === 0) && (
        <p className="text-slate-500 text-center py-6">No bazar trips in this archive</p>
      )}
    </div>
  );
}

function AuditView({ auditLogs, filter, setFilter }: { auditLogs: any[]; filter: string; setFilter: (f: string) => void }) {
  const filtered = filter === "all" ? (auditLogs || []) : (auditLogs || []).filter((l: any) => l.tableName === filter);
  const tables = [...new Set((auditLogs || []).map((l: any) => l.tableName))];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">🔍 Audit Log ({filtered.length})</h2>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-2 text-sm rounded-lg font-medium ${filter === "all" ? "bg-indigo-600 text-white" : "bg-gray-100 text-slate-400 hover:bg-gray-200"}`}
        >
          All
        </button>
        {tables.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-2 text-sm rounded-lg font-medium ${filter === t ? "bg-indigo-600 text-white" : "bg-gray-100 text-slate-400 hover:bg-gray-200"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {filtered.map((log: any) => (
          <div key={log.id} className="p-3 bg-white/[0.02] rounded-lg border">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${log.action === "CREATE" ? "bg-green-100 text-green-700"
                    : log.action === "UPDATE" ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                  {log.action}
                </span>
                <span className="text-xs text-slate-400">by {log.editedBy?.name}</span>
              </div>
              <span className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
            </div>
            <div className="mt-1.5 text-sm">
              <span className="font-medium text-slate-100">{log.fieldName}</span>
              <span className="text-slate-500 text-xs ml-1">({log.tableName})</span>
            </div>
            {log.action === "UPDATE" && (
              <div className="mt-1 text-sm">
                <span className="text-red-500 line-through">{log.oldValue}</span>
                <span className="text-slate-500"> → </span>
                <span className="text-green-600 font-medium">{log.newValue}</span>
              </div>
            )}
            {log.action === "CREATE" && log.newValue && (
              <div className="mt-1 text-sm text-green-600">{log.newValue}</div>
            )}
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-slate-500 text-center py-6">No audit logs in this archive</p>
      )}
    </div>
  );
}

function WashroomView({ duties }: { duties: any[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">🚿 Washroom Duties ({duties?.length || 0})</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm min-w-[360px]">
          <thead className="bg-white/[0.02]">
            <tr>
              <th className="text-left p-2 sm:p-3">Date</th>
              <th className="text-left p-2 sm:p-3">WR #</th>
              <th className="text-left p-2 sm:p-3">Member</th>
              <th className="text-center p-2 sm:p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(duties || []).map((d: any) => (
              <tr key={d.id} className="border-t">
                <td className="p-2 sm:p-3">{new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                <td className="p-2 sm:p-3">WR-{d.washroomNumber}</td>
                <td className="p-2 sm:p-3">{d.member?.name || d.memberId}</td>
                <td className="p-2 sm:p-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.status === "DONE" ? "bg-green-100 text-green-700"
                      : d.status === "SKIPPED" ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                    {d.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(!duties || duties.length === 0) && (
        <p className="text-slate-500 text-center py-6">No washroom duties in this archive</p>
      )}
    </div>
  );
}

function MealPlanView({ plans }: { plans: any[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">🍳 Meal Plan / Menu ({plans?.length || 0})</h2>
      <div className="space-y-2">
        {(plans || [])
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map((p: any) => {
            const d = new Date(p.date);
            return (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-white/[0.02] rounded-lg border">
                <div className="sm:w-32 font-medium text-slate-100">
                  {d.getDate()} {d.toLocaleDateString("en", { weekday: "short", month: "short" })}
                </div>
                <div className="flex-1 flex flex-wrap gap-3 text-sm">
                  {p.breakfast && <span>🌅 {p.breakfast}</span>}
                  {p.lunch && <span>☀️ {p.lunch}</span>}
                  {p.dinner && <span>🌙 {p.dinner}</span>}
                  {!p.breakfast && !p.lunch && !p.dinner && <span className="text-slate-500 italic">No menu</span>}
                </div>
              </div>
            );
          })}
      </div>
      {(!plans || plans.length === 0) && (
        <p className="text-slate-500 text-center py-6">No meal plans in this archive</p>
      )}
    </div>
  );
}

function RatingsView({ ratings }: { ratings: any[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">⭐ Meal Ratings ({ratings?.length || 0})</h2>
      <div className="space-y-2">
        {(ratings || []).map((r: any) => (
          <div key={r.id} className="p-3 bg-white/[0.02] rounded-lg border flex items-center gap-3">
            <div className="text-2xl">{"⭐".repeat(r.rating)}</div>
            <div>
              <p className="text-sm font-medium text-slate-100">
                {new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} — {r.meal}
              </p>
              <p className="text-xs text-slate-400">by {r.member?.name}{r.comment ? ` — "${r.comment}"` : ""}</p>
            </div>
          </div>
        ))}
      </div>
      {(!ratings || ratings.length === 0) && (
        <p className="text-slate-500 text-center py-6">No ratings in this archive</p>
      )}
    </div>
  );
}

function AnnouncementsView({ announcements }: { announcements: any[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">📢 Announcements ({announcements?.length || 0})</h2>
      <div className="space-y-3">
        {(announcements || []).map((a: any) => (
          <div key={a.id} className={`p-4 rounded-lg border ${a.pinned ? "bg-amber-50 border-amber-200" : "bg-white/[0.02]"}`}>
            <div className="flex items-center gap-2">
              {a.pinned && <span>📌</span>}
              <h3 className="font-medium text-slate-100">{a.title}</h3>
            </div>
            <p className="text-sm text-slate-400 mt-1">{a.body}</p>
            <p className="text-xs text-slate-500 mt-2">
              — {a.author?.name} · {new Date(a.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
      {(!announcements || announcements.length === 0) && (
        <p className="text-slate-500 text-center py-6">No announcements in this archive</p>
      )}
    </div>
  );
}

function VotesView({ topics }: { topics: any[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">🗳️ Meal Votes ({topics?.length || 0})</h2>
      <div className="space-y-3">
        {(topics || []).map((t: any) => {
          const voteCounts: Record<string, number> = {};
          for (const opt of t.options || []) voteCounts[opt] = 0;
          for (const v of t.votes || []) {
            if (voteCounts[v.option] !== undefined) voteCounts[v.option]++;
          }
          const totalVotes = t.votes?.length || 0;

          return (
            <div key={t.id} className="p-4 bg-white/[0.02] rounded-lg border">
              <h3 className="font-medium text-slate-100">{t.title}</h3>
              {t.targetDate && (
                <p className="text-xs text-slate-400 mt-0.5">
                  For {new Date(t.targetDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  {t.targetMeal ? ` (${t.targetMeal})` : ""}
                </p>
              )}
              <div className="mt-3 space-y-2">
                {Object.entries(voteCounts).map(([option, count]) => {
                  const pct = totalVotes > 0 ? Math.round(((count as number) / totalVotes) * 100) : 0;
                  return (
                    <div key={option}>
                      <div className="flex justify-between text-sm mb-0.5">
                        <span className="text-slate-300">{option}</span>
                        <span className="text-slate-400">{count as number} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-2">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</p>
            </div>
          );
        })}
      </div>
      {(!topics || topics.length === 0) && (
        <p className="text-slate-500 text-center py-6">No vote topics in this archive</p>
      )}
    </div>
  );
}

function BillPaymentsView({ payments, settings, members }: { payments: any[]; settings: any[]; members: any[] }) {
  const setting = settings?.[0];
  const rents = setting ? JSON.parse(setting.rents || "{}") : {};

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">💳 Bill Payments ({payments?.length || 0})</h2>

      {setting && (
        <div className="bg-white/[0.02] rounded-lg border p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-2">Bill Settings</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {setting.wifi > 0 && <div><span className="text-slate-400">WiFi:</span> <span className="font-medium">৳{setting.wifi}</span></div>}
            {setting.electricity > 0 && <div><span className="text-slate-400">Electric:</span> <span className="font-medium">৳{setting.electricity}</span></div>}
            {setting.gas > 0 && <div><span className="text-slate-400">Gas:</span> <span className="font-medium">৳{setting.gas}</span></div>}
            {setting.cookSalary > 0 && <div><span className="text-slate-400">Cook:</span> <span className="font-medium">৳{setting.cookSalary}</span></div>}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm min-w-[420px]">
          <thead className="bg-white/[0.02]">
            <tr>
              <th className="text-left p-2 sm:p-3">Member</th>
              <th className="text-right p-2 sm:p-3">Rent</th>
              <th className="text-right p-2 sm:p-3">Paid</th>
              <th className="text-center p-2 sm:p-3">Confirmed</th>
              <th className="text-left p-2 sm:p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {(members || []).map((m: any) => {
              const payment = (payments || []).find((p: any) => p.memberId === m.id);
              const rent = rents[m.id] || 0;
              return (
                <tr key={m.id} className="border-t">
                  <td className="p-2 sm:p-3 font-medium">{m.name}</td>
                  <td className="p-2 sm:p-3 text-right">৳{rent}</td>
                  <td className="p-2 sm:p-3 text-right">{payment ? <span className="text-green-600 font-medium">৳{payment.amount}</span> : <span className="text-slate-500">—</span>}</td>
                  <td className="p-2 sm:p-3 text-center">
                    {payment ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${payment.confirmed ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {payment.confirmed ? "Confirmed" : "Pending"}
                      </span>
                    ) : <span className="text-red-500 text-xs font-medium">Unpaid</span>}
                  </td>
                  <td className="p-2 sm:p-3 text-slate-400 text-xs">{payment ? new Date(payment.createdAt).toLocaleDateString() : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(!payments || payments.length === 0) && (!setting) && (
        <p className="text-slate-500 text-center py-6">No bill data in this archive</p>
      )}
    </div>
  );
}


