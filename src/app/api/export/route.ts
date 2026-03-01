import { NextRequest, NextResponse } from "next/server";
import { calculateMonthlyBill } from "@/lib/billing";
import { auth } from "@/lib/auth";

// GET — export monthly bill as CSV
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") || new Date().getFullYear());

  const bill = await calculateMonthlyBill(month, year, session.user.messId);

  const monthName = new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Build CSV
  const rows: string[] = [];
  rows.push(`Mess Monthly Report - ${monthName}`);
  rows.push("");
  rows.push(`Total Expense,${bill.totalExpense}`);
  rows.push(`Total Meals,${bill.totalMeals}`);
  rows.push(`Meal Rate,${bill.mealRate}`);
  rows.push("");
  rows.push("Member,Total Meals,Meal Cost,Deposited,Net Due,Status");
  for (const m of bill.members) {
    const status = m.netDue > 0 ? "Owes" : m.netDue < 0 ? "Refund" : "Settled";
    rows.push(`${m.name},${m.totalMeals},${m.mealCost},${m.totalDeposit},${m.netDue},${status}`);
  }
  rows.push("");
  rows.push(
    `Total,${bill.totalMeals},${bill.totalExpense},${bill.members.reduce((s, m) => s + m.totalDeposit, 0)},${bill.members.reduce((s, m) => s + m.netDue, 0).toFixed(2)},`
  );

  const csv = rows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="mess-report-${year}-${String(month).padStart(2, "0")}.csv"`,
    },
  });
}
