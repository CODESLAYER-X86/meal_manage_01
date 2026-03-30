import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET bill settings for a month
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") || new Date().getFullYear());

  const setting = await prisma.billSetting.findUnique({
    where: { messId_month_year: { messId, month, year } },
  });

  // Also get mess config for gas/cook flags
  const mess = await prisma.mess.findUnique({
    where: { id: messId },
    select: { hasGas: true, hasCook: true },
  });

  // Get members for rent assignment
  const members = await prisma.user.findMany({
    where: { messId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    setting: setting
      ? { ...setting, rents: JSON.parse(setting.rents) }
      : null,
    mess,
    members,
  });
}

// POST - Create/update bill settings for a month (manager only)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId || session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  const body = await request.json();
  const { month, year, rents, wifi, electricity, gas, cookSalary, other, otherNote } = body;

  if (!month || !year) {
    return NextResponse.json({ error: "Month and year are required" }, { status: 400 });
  }

  // Validate rents is an object
  if (rents && typeof rents !== "object") {
    return NextResponse.json({ error: "Rents must be an object mapping userId to amount" }, { status: 400 });
  }

  const data = {
    rents: rents ? JSON.stringify(rents) : "{}",
    wifi: Number(wifi) || 0,
    electricity: Number(electricity) || 0,
    gas: Number(gas) || 0,
    cookSalary: Number(cookSalary) || 0,
    other: Number(other) || 0,
    otherNote: otherNote?.trim() || null,
    updatedAt: new Date(),
  };

  const setting = await prisma.billSetting.upsert({
    where: { messId_month_year: { messId, month, year } },
    create: { messId, month, year, ...data },
    update: data,
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      editedById: session.user.id,
      messId,
      tableName: "BillSetting",
      recordId: setting.id,
      fieldName: "all",
      newValue: JSON.stringify({ month, year, ...data }),
      action: "UPSERT",
    },
  });

  return NextResponse.json({
    success: true,
    setting: { ...setting, rents: JSON.parse(setting.rents) },
  });
}
