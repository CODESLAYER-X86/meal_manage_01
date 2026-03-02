"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Member { id: string; name: string; }

interface BazarItemForm {
  itemName: string;
  quantity: string;
  unit: string;
  price: string;
}

interface BazarTrip {
  id: string;
  date: string;
  buyerId: string;
  buyer: Member;
  totalCost: number;
  note: string | null;
  approved: boolean;
  approvedAt: string | null;
  companionIds: string[];
  items: { id: string; itemName: string; quantity: number; unit: string; price: number; serialNo: number }[];
}

export default function BazarEntryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [companionMap, setCompanionMap] = useState<Record<string, string>>({});
  const [tripCounts, setTripCounts] = useState<Record<string, number>>({});
  const [trips, setTrips] = useState<BazarTrip[]>([]);

  // Entry form
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [companions, setCompanions] = useState<string[]>([]);
  const [alone, setAlone] = useState(true);
  const [note, setNote] = useState("");
  const [items, setItems] = useState<BazarItemForm[]>([
    { itemName: "", quantity: "", unit: "kg", price: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // View mode
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [tab, setTab] = useState<"entry" | "history" | "pending">("entry");

  const isManager = (session?.user as { role?: string })?.role === "MANAGER";
  const userId = session?.user?.id;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Fetch members list (for companion selection)
  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/members")
        .then((r) => r.json())
        .then((m: Member[]) => {
          setAllMembers(m);
          const others = m.filter((member) => member.id !== session?.user?.id);
          setMembers(others);
        });
    }
  }, [status, session]);

  // Fetch trips
  const fetchTrips = () => {
    if (status !== "authenticated") return;
    const url = tab === "pending"
      ? `/api/bazar?month=${viewMonth}&year=${viewYear}&pending=true`
      : `/api/bazar?month=${viewMonth}&year=${viewYear}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setTrips(data.trips || []);
        setCompanionMap(data.companionMap || {});
        setTripCounts(data.tripCounts || {});
        if (data.members) setAllMembers(data.members);
      });
  };

  useEffect(() => {
    fetchTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, viewMonth, viewYear, tab]);

  const toggleCompanion = (id: string) => {
    setCompanions((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleAloneToggle = () => {
    if (!alone) setCompanions([]);
    setAlone(!alone);
  };

  const addItem = () => {
    setItems([...items, { itemName: "", quantity: "", unit: "kg", price: "" }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof BazarItemForm, value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const totalCost = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess("");
    setError("");

    const formattedItems = items
      .filter((item) => item.itemName.trim() !== "")
      .map((item) => ({
        itemName: item.itemName,
        quantity: parseFloat(item.quantity) || 0,
        unit: item.unit,
        price: parseFloat(item.price) || 0,
      }));

    const res = await fetch("/api/bazar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        companionIds: alone ? [] : companions,
        note: note || undefined,
        items: formattedItems,
      }),
    });

    if (res.ok) {
      setItems([{ itemName: "", quantity: "", unit: "kg", price: "" }]);
      setNote("");
      setCompanions([]);
      setAlone(true);
      setSuccess("Bazar entry submitted! Waiting for manager approval. ✅");
      fetchTrips();
      setTimeout(() => setSuccess(""), 4000);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save");
    }
    setSaving(false);
  };

  // Manager approve/reject
  const approveTrip = async (tripId: string) => {
    setError("");
    const res = await fetch("/api/bazar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tripId, action: "approve" }),
    });
    if (res.ok) {
      setSuccess("Trip approved!");
      fetchTrips();
      setTimeout(() => setSuccess(""), 3000);
    } else {
      const data = await res.json();
      setError(data.error || "Failed");
    }
  };

  const rejectTrip = async (tripId: string) => {
    if (!confirm("Reject and delete this trip?")) return;
    setError("");
    const res = await fetch("/api/bazar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tripId, action: "reject" }),
    });
    if (res.ok) {
      setSuccess("Trip rejected");
      fetchTrips();
      setTimeout(() => setSuccess(""), 3000);
    } else {
      const data = await res.json();
      setError(data.error || "Failed");
    }
  };

  const deleteTrip = async (tripId: string) => {
    if (!confirm("Delete this trip?")) return;
    setError("");
    const res = await fetch(`/api/bazar?id=${tripId}`, { method: "DELETE" });
    if (res.ok) {
      setSuccess("Deleted");
      fetchTrips();
    } else {
      const data = await res.json();
      setError(data.error || "Failed");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const pendingCount = trips.filter((t) => !t.approved).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h1 className="text-2xl font-bold text-gray-800">🛒 Bazar / Market</h1>
        <span className="text-sm text-gray-500">Logged in as <strong>{session?.user?.name}</strong></span>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">⚠️ {error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">✅ {success}</div>}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button onClick={() => setTab("entry")} className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${tab === "entry" ? "bg-white shadow text-indigo-700" : "text-gray-600 hover:text-gray-800"}`}>
          📝 New Entry
        </button>
        <button onClick={() => setTab("history")} className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${tab === "history" ? "bg-white shadow text-indigo-700" : "text-gray-600 hover:text-gray-800"}`}>
          📋 History
        </button>
        {isManager && (
          <button onClick={() => setTab("pending")} className={`flex-1 py-2 text-sm font-medium rounded-lg transition relative ${tab === "pending" ? "bg-white shadow text-indigo-700" : "text-gray-600 hover:text-gray-800"}`}>
            ⏳ Pending {pendingCount > 0 && <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
          </button>
        )}
      </div>

      {/* Trip Count Stats */}
      {(tab === "history" || tab === "pending") && allMembers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-3">📊 {viewYear} Trip Counts (Approved)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {allMembers.map((m) => (
              <div key={m.id} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                <p className="text-xl font-bold text-orange-600">{tripCounts[m.id] || 0}</p>
                <p className="text-xs text-gray-400">trips</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Month selector for history / pending */}
      {(tab === "history" || tab === "pending") && (
        <div className="flex items-center gap-2">
          <select value={viewMonth} onChange={(e) => setViewMonth(Number(e.target.value))} className="rounded-lg border px-2 py-1 text-sm">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString("default", { month: "short" })}</option>
            ))}
          </select>
          <select value={viewYear} onChange={(e) => setViewYear(Number(e.target.value))} className="rounded-lg border px-2 py-1 text-sm">
            {[viewYear - 1, viewYear, viewYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-sm text-gray-500">{trips.length} trip{trips.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* ============ ENTRY TAB ============ */}
      {tab === "entry" && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Trip Info */}
          <div className="bg-white p-5 rounded-xl shadow-sm border space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">📅 Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">📝 Note (optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. Morning bazar, special items..."
                />
              </div>
            </div>

            {/* Who went with you? */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">🚶 Who went to bazar?</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAloneToggle}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${
                    alone
                      ? "bg-orange-600 text-white border-orange-600"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  🙋 Alone
                </button>
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (alone) setAlone(false);
                      toggleCompanion(m.id);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${
                      companions.includes(m.id)
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    👤 {m.name}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {alone
                  ? `${session?.user?.name} went alone`
                  : companions.length > 0
                  ? `${session?.user?.name} + ${companions.map((id) => members.find((m) => m.id === id)?.name).filter(Boolean).join(", ")}`
                  : "Select who went with you, or tap Alone"}
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-700">⏳ Your entry will be submitted for manager approval. Once approved, trip counts will be updated for you and your companions.</p>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">📦 Items Purchased</h2>
              <span className="text-lg font-bold text-orange-600">Total: ৳{totalCost}</span>
            </div>

            {/* Mobile card layout */}
            <div className="md:hidden divide-y">
              {items.map((item, i) => (
                <div key={i} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-500">Item #{i + 1}</span>
                    <button type="button" onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700 text-lg" title="Remove">✕</button>
                  </div>
                  <input type="text" value={item.itemName} onChange={(e) => updateItem(i, "itemName", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Item name (e.g. Beef, Rice, Oil...)" required />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Qty</label>
                      <input type="number" step="0.1" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} className="w-full px-2 py-2 border rounded-lg text-center text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="1" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Unit</label>
                      <select value={item.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} className="w-full px-2 py-2 border rounded-lg text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none">
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="litre">litre</option>
                        <option value="ml">ml</option>
                        <option value="pcs">pcs</option>
                        <option value="packet">packet</option>
                        <option value="dozen">dozen</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Price ৳</label>
                      <input type="number" value={item.price} onChange={(e) => updateItem(i, "price", e.target.value)} className="w-full px-2 py-2 border rounded-lg text-right text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-center p-3 w-12">SL</th>
                    <th className="text-left p-3">Item Name</th>
                    <th className="text-center p-3 w-20">Qty</th>
                    <th className="text-center p-3 w-24">Unit</th>
                    <th className="text-right p-3 w-24">Price (৳)</th>
                    <th className="text-center p-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 text-center text-gray-500">{i + 1}</td>
                      <td className="p-2">
                        <input type="text" value={item.itemName} onChange={(e) => updateItem(i, "itemName", e.target.value)} className="w-full px-2 py-1.5 border rounded text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Beef, Rice, Oil..." required />
                      </td>
                      <td className="p-2">
                        <input type="number" step="0.1" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} className="w-full px-2 py-1.5 border rounded text-center text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="1" />
                      </td>
                      <td className="p-2">
                        <select value={item.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} className="w-full px-2 py-1.5 border rounded text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none">
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="litre">litre</option>
                          <option value="ml">ml</option>
                          <option value="pcs">pcs</option>
                          <option value="packet">packet</option>
                          <option value="dozen">dozen</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input type="number" value={item.price} onChange={(e) => updateItem(i, "price", e.target.value)} className="w-full px-2 py-1.5 border rounded text-right text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0" />
                      </td>
                      <td className="p-2 text-center">
                        <button type="button" onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700 text-lg" title="Remove">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t">
              <button type="button" onClick={addItem} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium">
                ➕ Add Another Item
              </button>
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-4">
            <button type="submit" disabled={saving} className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition disabled:opacity-50">
              {saving ? "Submitting..." : "📤 Submit for Approval"}
            </button>
          </div>
        </form>
      )}

      {/* ============ HISTORY / PENDING TAB ============ */}
      {(tab === "history" || tab === "pending") && (
        <div className="space-y-4">
          {trips.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
              <p className="text-gray-500">{tab === "pending" ? "No pending trips to approve" : "No bazar trips this month"}</p>
            </div>
          ) : (
            trips.map((trip) => {
              const dateStr = new Date(trip.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              const companionNames = trip.companionIds.map((cid) => companionMap[cid] || "Unknown").filter(Boolean);
              const isOwnTrip = trip.buyerId === userId;

              return (
                <div key={trip.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${!trip.approved ? "border-yellow-300" : "border-gray-200"}`}>
                  <div className="p-4 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-500">{dateStr}</span>
                    <span className={`font-medium text-sm ${isOwnTrip ? "text-indigo-700" : "text-gray-800"}`}>
                      {trip.buyer.name}{isOwnTrip && " (you)"}
                    </span>
                    {companionNames.length > 0 && (
                      <span className="text-xs text-gray-400">+ {companionNames.join(", ")}</span>
                    )}
                    <span className="text-sm font-bold text-orange-600 ml-auto">৳{trip.totalCost}</span>

                    {/* Status badge */}
                    {trip.approved ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✅ Approved</span>
                    ) : (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">⏳ Pending</span>
                    )}

                    {/* Manager actions */}
                    {isManager && !trip.approved && (
                      <>
                        <button onClick={() => approveTrip(trip.id)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">✓ Approve</button>
                        <button onClick={() => rejectTrip(trip.id)} className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">✕ Reject</button>
                      </>
                    )}

                    {/* Delete (manager always, or own pending) */}
                    {(isManager || (isOwnTrip && !trip.approved)) && (
                      <button onClick={() => deleteTrip(trip.id)} className="text-xs bg-gray-400 text-white px-2 py-1 rounded hover:bg-gray-500">🗑️</button>
                    )}
                  </div>

                  {trip.note && <p className="px-4 pb-2 text-xs text-gray-400 italic">{trip.note}</p>}

                  {/* Items list */}
                  {trip.items.length > 0 && (
                    <div className="border-t">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-2 pl-4">Item</th>
                            <th className="text-center p-2">Qty</th>
                            <th className="text-center p-2">Unit</th>
                            <th className="text-right p-2 pr-4">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trip.items.map((item) => (
                            <tr key={item.id} className="border-t border-gray-100">
                              <td className="p-2 pl-4 text-gray-700">{item.itemName}</td>
                              <td className="p-2 text-center text-gray-600">{item.quantity}</td>
                              <td className="p-2 text-center text-gray-600">{item.unit}</td>
                              <td className="p-2 pr-4 text-right text-gray-700 font-medium">৳{item.price}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
