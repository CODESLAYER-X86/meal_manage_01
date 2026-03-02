import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET — Export monthly data as CSV
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));

  if (!month || !year) {
    return NextResponse.json({ error: "month and year are required" }, { status: 400 });
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const [mess, members, mealEntries, deposits, bazarTrips, washroomCleanings, billSettings, billPayments] =
    await Promise.all([
      prisma.mess.findUnique({ where: { id: messId }, select: { name: true } }),
      prisma.user.findMany({
        where: { messId },
        select: { id: true, name: true, role: true, isActive: true },
      }),
      prisma.mealEntry.findMany({
        where: { messId, date: { gte: startDate, lte: endDate } },
        include: { member: { select: { name: true } } },
        orderBy: { date: "asc" },
      }),
      prisma.deposit.findMany({
        where: { messId, date: { gte: startDate, lte: endDate } },
        include: { member: { select: { name: true } } },
        orderBy: { date: "asc" },
      }),
      prisma.bazarTrip.findMany({
        where: { messId, date: { gte: startDate, lte: endDate } },
        include: {
          buyer: { select: { name: true } },
          items: { orderBy: { serialNo: "asc" } },
        },
        orderBy: { date: "desc" },
      }),
      prisma.washroomCleaning.findMany({
        where: { messId, date: { gte: startDate, lte: endDate } },
        include: { member: { select: { name: true } } },
        orderBy: { date: "asc" },
      }),
      prisma.billSetting.findMany({ where: { messId, month, year } }),
      prisma.billPayment.findMany({
        where: { messId, month, year },
        include: { member: { select: { name: true } } },
      }),
    ]);

  const monthName = new Date(year, month - 1).toLocaleDateString("en-US", { month: "long" });
  const csvSections: string[] = [];

  // Helper
  const esc = (val: string | number | boolean | null | undefined) => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString("en-GB");

  // -- Header
  csvSections.push(`MessMate Monthly Report`);
  csvSections.push(`Mess: ${mess?.name || "Unknown"}`);
  csvSections.push(`Period: ${monthName} ${year}`);
  csvSections.push(`Exported: ${new Date().toLocaleString()}`);
  csvSections.push("");

  // -- Billing Summary
  const totalBazar = bazarTrips.reduce((s, t) => s + t.totalCost, 0);
  const totalMeals = mealEntries.reduce((s, e) => s + e.total, 0);
  const mealRate = totalMeals > 0 ? totalBazar / totalMeals : 0;

  csvSections.push("=== BILLING SUMMARY ===");
  csvSections.push("Member,Total Meals,Meal Cost,Deposits,Net Due");
  for (const m of members) {
    const meals = mealEntries.filter((e) => e.memberId === m.id).reduce((s, e) => s + e.total, 0);
    const dep = deposits.filter((d) => d.memberId === m.id).reduce((s, d) => s + d.amount, 0);
    const cost = Math.round(meals * mealRate * 100) / 100;
    const due = Math.round((cost - dep) * 100) / 100;
    csvSections.push(`${esc(m.name)},${meals},${cost},${dep},${due}`);
  }
  csvSections.push(`\nMeal Rate: ${mealRate.toFixed(2)} per meal`);
  csvSections.push(`Total Bazar Expense: ${totalBazar}`);
  csvSections.push(`Total Meals: ${totalMeals}`);
  csvSections.push("");

  // -- Meal Entries
  csvSections.push("=== MEAL ENTRIES ===");
  csvSections.push("Date,Member,Breakfast,Lunch,Dinner,Total");
  for (const e of mealEntries) {
    csvSections.push(
      `${fmtDate(e.date)},${esc(e.member.name)},${e.breakfast},${e.lunch},${e.dinner},${e.total}`
    );
  }
  csvSections.push("");

  // -- Deposits
  csvSections.push("=== DEPOSITS ===");
  csvSections.push("Date,Member,Amount");
  for (const d of deposits) {
    csvSections.push(`${fmtDate(d.date)},${esc(d.member.name)},${d.amount}`);
  }
  csvSections.push("");

  // -- Bazar Trips
  csvSections.push("=== BAZAR TRIPS ===");
  csvSections.push("Date,Buyer,Item,Quantity,Unit,Price,Trip Total,Status");
  for (const t of bazarTrips) {
    if (t.items.length === 0) {
      csvSections.push(
        `${fmtDate(t.date)},${esc(t.buyer.name)},,,,${t.totalCost},${t.approved ? "Approved" : "Pending"}`
      );
    } else {
      for (const item of t.items) {
        csvSections.push(
          `${fmtDate(t.date)},${esc(t.buyer.name)},${esc(item.itemName)},${item.quantity},${esc(item.unit)},${item.price},${t.totalCost},${t.approved ? "Approved" : "Pending"}`
        );
      }
    }
  }
  csvSections.push("");

  // -- Washroom Cleaning
  csvSections.push("=== WASHROOM CLEANING ===");
  csvSections.push("Date,Washroom,Cleaned By");
  for (const c of washroomCleanings) {
    csvSections.push(`${fmtDate(c.date)},WR-${c.washroomNumber},${esc(c.member.name)}`);
  }
  csvSections.push("");

  // -- Bill Payments
  if (billPayments.length > 0) {
    csvSections.push("=== BILL PAYMENTS ===");
    csvSections.push("Member,Amount,Status");
    for (const p of billPayments) {
      csvSections.push(`${esc(p.member.name)},${p.amount},${p.confirmed ? "Paid" : "Pending"}`);
    }
    csvSections.push("");
  }

  // -- Members
  csvSections.push("=== MEMBERS ===");
  csvSections.push("Name,Role,Active");
  for (const m of members) {
    csvSections.push(`${esc(m.name)},${m.role},${m.isActive ? "Yes" : "No"}`);
  }

  const csvContent = csvSections.join("\n");
  const fileName = `messmate-${mess?.name?.replace(/\s+/g, "-").toLowerCase() || "report"}-${monthName.toLowerCase()}-${year}.csv`;

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
