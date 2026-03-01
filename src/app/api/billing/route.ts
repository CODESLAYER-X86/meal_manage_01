import { NextRequest, NextResponse } from "next/server";
import { calculateMonthlyBill } from "@/lib/billing";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") || new Date().getFullYear());

  const bill = await calculateMonthlyBill(month, year);
  return NextResponse.json(bill);
}
