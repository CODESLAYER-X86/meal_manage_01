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
  const [buyerId, setBuyerId] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<BazarItemForm[]>([
    { itemName: "", quantity: "", unit: "kg", price: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user?.role !== "MANAGER") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/members")
        .then((r) => r.json())
        .then((m) => {
          setMembers(m);
          if (m.length > 0) setBuyerId(m[0].id);
        });
    }
  }, [status]);

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

    const res = await fetch("/api/bazar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, buyerId, note, items: formattedItems }),
    });

    if (res.ok) {
      setItems([{ itemName: "", quantity: "", unit: "kg", price: "" }]);
      setNote("");
      setSuccess("Bazar entry saved!");
      setTimeout(() => setSuccess(""), 3000);
    }
    setSaving(false);
  };

  if (status === "loading") return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">🛒 Bazar / Market Entry</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Trip Info */}
        <div className="bg-white p-5 rounded-xl shadow-sm border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Who went to market?</label>
              <select
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Optional note"
              />
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">Items Purchased</h2>
            <span className="text-lg font-bold text-orange-600">Total: ৳{totalCost}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-center p-3 w-16">SL</th>
                <th className="text-left p-3">Item Name</th>
                <th className="text-center p-3 w-24">Qty</th>
                <th className="text-center p-3 w-28">Unit</th>
                <th className="text-right p-3 w-28">Price (৳)</th>
                <th className="text-center p-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-t">
                  <td className="p-3 text-center text-gray-500">{i + 1}</td>
                  <td className="p-3">
                    <input
                      type="text"
                      value={item.itemName}
                      onChange={(e) => updateItem(i, "itemName", e.target.value)}
                      className="w-full px-2 py-1.5 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="e.g. Beef, Rice, Oil..."
                      required
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      step="0.1"
                      value={item.quantity}
                      onChange={(e) => updateItem(i, "quantity", e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="1"
                    />
                  </td>
                  <td className="p-3">
                    <select
                      value={item.unit}
                      onChange={(e) => updateItem(i, "unit", e.target.value)}
                      className="w-full px-2 py-1.5 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
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
                  <td className="p-3">
                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) => updateItem(i, "price", e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-right focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="0"
                    />
                  </td>
                  <td className="p-3 text-center">
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
