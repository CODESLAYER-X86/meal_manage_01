import { NextRequest, NextResponse } from "next/server";
import { calculateMonthlyBill } from "@/lib/billing";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") || new Date().getFullYear());

  const bill = await calculateMonthlyBill(month, year, session.user.messId);
  return NextResponse.json(bill);
}
