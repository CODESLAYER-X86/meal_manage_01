"use client";

import { useState, useEffect } from "react";
import { Database, Download, Search, Table2, FileJson, FileSpreadsheet, Filter, ChevronDown } from "lucide-react";

const DATA_TYPES = [
  { key: "meals", label: "Meal Entries", desc: "Per-member daily meal counts" },
  { key: "bazar", label: "Bazar Items", desc: "Purchased items with prices & categories" },
  { key: "deposits", label: "Deposits", desc: "Member financial deposits" },
  { key: "members", label: "Members", desc: "User profiles & activity" },
  { key: "plans", label: "Meal Plans", desc: "Planned menus, cancellations, wastage" },
  { key: "ratings", label: "Ratings", desc: "Meal quality feedback" },
];

interface MessOption {
  id: string;
  name: string;
}

export default function ResearchPage() {
  const [type, setType] = useState("meals");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [messId, setMessId] = useState("");
  const [messes, setMesses] = useState<MessOption[]>([]);
  const [data, setData] = useState<{ count: number; columns: string[]; data: Record<string, unknown>[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch messes for filter dropdown
  useEffect(() => {
    fetch("/api/admin/messes?page=1")
      .then((r) => r.json())
      .then((d) => setMesses((d.messes || []).map((m: { id: string; name: string }) => ({ id: m.id, name: m.name }))))
      .catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ type, format: "json", limit: "200" });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (messId) params.set("messId", messId);

      const res = await fetch(`/api/admin/research?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (e: unknown) {
      setError((e as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = (format: "csv" | "json") => {
    const params = new URLSearchParams({ type, format, limit: "50000" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (messId) params.set("messId", messId);

    if (format === "csv") {
      // CSV downloads as file from the API
      window.open(`/api/admin/research?${params}`, "_blank");
    } else {
      // JSON download
      fetch(`/api/admin/research?${params}`)
        .then((r) => r.json())
        .then((d) => {
          const blob = new Blob([JSON.stringify(d.data, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${type}_export_${new Date().toISOString().split("T")[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);
        });
    }
  };

  const currentType = DATA_TYPES.find((t) => t.key === type)!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-600/20 via-blue-600/10 to-indigo-600/20 border border-cyan-500/10 p-6 sm:p-8">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Research Data Explorer</h1>
            <p className="text-slate-400 text-sm">Query, preview, and export structured data for ML research</p>
          </div>
        </div>
      </div>

      {/* Data Type Tabs */}
      <div className="flex flex-wrap gap-2">
        {DATA_TYPES.map((dt) => (
          <button
            key={dt.key}
            onClick={() => { setType(dt.key); setData(null); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              type === dt.key
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                : "bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 hover:text-white"
            }`}
          >
            {dt.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-white">Filters</h3>
        </div>
        <div className="grid sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">From Date</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">To Date</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Mess</label>
            <div className="relative">
              <select
                value={messId}
                onChange={(e) => setMessId(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none appearance-none transition-all"
              >
                <option value="">All Messes</option>
                {messes.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#1a1a3e] text-white">{m.name}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchData}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {loading ? "Querying..." : "Query Data"}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-4">
          {/* Results Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Table2 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">{currentType.label}</h3>
              </div>
              <span className="px-2.5 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-medium rounded-full">
                {data.count.toLocaleString()} rows
              </span>
              {data.count >= 200 && (
                <span className="text-xs text-slate-500">Showing preview (max 200). Download for full data.</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => downloadFile("csv")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium rounded-lg hover:bg-emerald-500/20 transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Download CSV
              </button>
              <button
                onClick={() => downloadFile("json")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium rounded-lg hover:bg-amber-500/20 transition-all"
              >
                <FileJson className="w-3.5 h-3.5" /> Download JSON
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    {data.columns.map((col) => (
                      <th key={col} className="px-4 py-3 text-left text-slate-400 font-semibold uppercase tracking-wider whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {data.data.slice(0, 50).map((row, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      {data.columns.map((col) => (
                        <td key={col} className="px-4 py-2.5 text-slate-300 whitespace-nowrap max-w-[200px] truncate">
                          {String(row[col] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.data.length > 50 && (
              <div className="px-4 py-3 border-t border-white/5 text-center text-xs text-slate-500">
                Showing 50 of {data.count} rows in preview. Download CSV/JSON for complete data.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!data && !loading && !error && (
        <div className="bg-[#1a1a3e]/50 backdrop-blur border border-white/5 rounded-2xl p-12 text-center">
          <Download className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-slate-400">Select a data type and click Query Data</h3>
          <p className="text-xs text-slate-500 mt-1">Preview results in-browser, then export as CSV or JSON for research</p>
        </div>
      )}
    </div>
  );
}
