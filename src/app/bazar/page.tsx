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

export default function BazarEntryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [companions, setCompanions] = useState<string[]>([]);
  const [alone, setAlone] = useState(true);
  const [note, setNote] = useState("");
  const [items, setItems] = useState<BazarItemForm[]>([
    { itemName: "", quantity: "", unit: "kg", price: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/members")
        .then((r) => r.json())
        .then((m: Member[]) => {
          // Exclude self from companion list
          const others = m.filter((member) => member.id !== session?.user?.id);
          setMembers(others);
        });
    }
  }, [status, session]);

  const toggleCompanion = (id: string) => {
    setCompanions((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleAloneToggle = () => {
    if (!alone) {
      setCompanions([]);
    }
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

    const formattedItems = items
      .filter((item) => item.itemName.trim() !== "")
      .map((item) => ({
        itemName: item.itemName,
        quantity: parseFloat(item.quantity) || 0,
        unit: item.unit,
        price: parseFloat(item.price) || 0,
      }));

    // Build note with companion info
    let fullNote = note;
    if (!alone && companions.length > 0) {
      const companionNames = companions
        .map((id) => members.find((m) => m.id === id)?.name)
        .filter(Boolean);
      const withText = `Went with: ${companionNames.join(", ")}`;
      fullNote = fullNote ? `${withText} | ${fullNote}` : withText;
    } else {
      const aloneText = "Went alone";
      fullNote = fullNote ? `${aloneText} | ${fullNote}` : aloneText;
    }

    const res = await fetch("/api/bazar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        buyerId: session?.user?.id,
        note: fullNote,
        items: formattedItems,
      }),
    });

    if (res.ok) {
      setItems([{ itemName: "", quantity: "", unit: "kg", price: "" }]);
      setNote("");
      setCompanions([]);
      setAlone(true);
      setSuccess("Bazar entry saved! ✅");
      setTimeout(() => setSuccess(""), 3000);
    }
    setSaving(false);
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">🛒 Bazar / Market Entry</h1>
        <span className="text-sm text-gray-500">Logged in as <strong>{session?.user?.name}</strong></span>
      </div>

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
              {/* Alone button */}
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

              {/* Companion checkboxes */}
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
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">📦 Items Purchased</h2>
            <span className="text-lg font-bold text-orange-600">Total: ৳{totalCost}</span>
          </div>
          <div className="overflow-x-auto">
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
                      <input
                        type="text"
                        value={item.itemName}
                        onChange={(e) => updateItem(i, "itemName", e.target.value)}
                        className="w-full px-2 py-1.5 border rounded text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="e.g. Beef, Rice, Oil..."
                        required
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.1"
                        value={item.quantity}
                        onChange={(e) => updateItem(i, "quantity", e.target.value)}
                        className="w-full px-2 py-1.5 border rounded text-center text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="1"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={item.unit}
                        onChange={(e) => updateItem(i, "unit", e.target.value)}
                        className="w-full px-2 py-1.5 border rounded text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
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
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => updateItem(i, "price", e.target.value)}
                        className="w-full px-2 py-1.5 border rounded text-right text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="0"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="text-red-500 hover:text-red-700 text-lg"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t">
            <button
              type="button"
              onClick={addItem}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
            >
              ➕ Add Another Item
            </button>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "💾 Save Bazar Entry"}
          </button>
          {success && <span className="text-green-600 text-sm font-medium">{success}</span>}
        </div>
      </form>
    </div>
  );
}
