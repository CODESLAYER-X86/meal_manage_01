import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET bill payments for a month
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") || new Date().getFullYear());

  const payments = await prisma.billPayment.findMany({
    where: { messId, month, year },
    include: { member: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Get bill settings to calculate totals due
  const setting = await prisma.billSetting.findUnique({
    where: { messId_month_year: { messId, month, year } },
  });

  // Get members
  const members = await prisma.user.findMany({
    where: { messId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Calculate per-member total bill
  let memberBills: Record<string, number> = {};
  if (setting) {
    const rents: Record<string, number> = JSON.parse(setting.rents);
    const memberCount = members.length;
    const sharedUtilities =
      setting.wifi + setting.electricity + setting.gas + setting.cookSalary + (setting.other || 0);
    const perMemberUtility = memberCount > 0 ? sharedUtilities / memberCount : 0;

    for (const m of members) {
      const personalRent = rents[m.id] || 0;
      memberBills[m.id] = personalRent + perMemberUtility;
    }
  }

  // Calculate paid amounts per member
  const paidAmounts: Record<string, number> = {};
  const confirmedAmounts: Record<string, number> = {};
  for (const p of payments) {
    paidAmounts[p.memberId] = (paidAmounts[p.memberId] || 0) + p.amount;
    if (p.confirmed) {
      confirmedAmounts[p.memberId] =
        (confirmedAmounts[p.memberId] || 0) + p.amount;
    }
  }

  return NextResponse.json({
    payments,
    memberBills,
    paidAmounts,
    confirmedAmounts,
    members,
  });
}

// POST - Submit a bill payment (any member)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;
  const userId = session.user.id;

  const body = await request.json();
  const { month, year, amount, note } = body;

  if (!month || !year || !amount || amount <= 0) {
    return NextResponse.json(
      { error: "Month, year, and a positive amount are required" },
      { status: 400 }
    );
  }

  const payment = await prisma.billPayment.create({
    data: {
      memberId: userId,
      messId,
      month,
      year,
      amount: Number(amount),
      note: note || null,
    },
  });

  // Audit
  await prisma.auditLog.create({
    data: {
      editedById: userId,
      messId,
      tableName: "BillPayment",
      recordId: payment.id,
      fieldName: "all",
      newValue: JSON.stringify({ month, year, amount, note }),
      action: "CREATE",
    },
  });

  return NextResponse.json({ success: true, payment });
}

// PATCH - Confirm a bill payment (manager only)
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId || session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { id, confirmed } = body;

  if (!id) {
    return NextResponse.json({ error: "Payment id is required" }, { status: 400 });
  }

  const payment = await prisma.billPayment.findUnique({ where: { id } });
  if (!payment || payment.messId !== session.user.messId) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const updated = await prisma.billPayment.update({
    where: { id },
    data: {
      confirmed: confirmed !== false,
      confirmedAt: confirmed !== false ? new Date() : null,
      updatedAt: new Date(),
    },
  });

  // Audit
  await prisma.auditLog.create({
    data: {
      editedById: session.user.id,
      messId: session.user.messId,
      tableName: "BillPayment",
      recordId: id,
      fieldName: "confirmed",
      oldValue: String(payment.confirmed),
      newValue: String(confirmed !== false),
      action: "UPDATE",
    },
  });

  return NextResponse.json({ success: true, payment: updated });
}

// DELETE - Delete a payment (member own unconfirmed, or manager any)
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Payment id is required" }, { status: 400 });
  }

  const payment = await prisma.billPayment.findUnique({ where: { id } });
  if (!payment || payment.messId !== session.user.messId) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  // Members can only delete their own unconfirmed payments
  if (session.user.role !== "MANAGER") {
    if (payment.memberId !== session.user.id || payment.confirmed) {
      return NextResponse.json(
        { error: "You can only delete your own unconfirmed payments" },
        { status: 403 }
      );
    }
  }

  await prisma.billPayment.delete({ where: { id } });

  // Audit
  await prisma.auditLog.create({
    data: {
      editedById: session.user.id,
      messId: session.user.messId,
      tableName: "BillPayment",
      recordId: id,
      fieldName: "all",
      oldValue: JSON.stringify(payment),
      action: "DELETE",
    },
  });

  return NextResponse.json({ success: true });
}
