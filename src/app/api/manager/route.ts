import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

// GET current manager
export async function GET() {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }

  const now = new Date();
  const rotation = await prisma.managerRotation.findUnique({
    where: {
      month_year_messId: {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        messId: session.user.messId,
      },
    },
    include: { member: { select: { id: true, name: true } } },
  });
  return NextResponse.json(rotation);
}

// POST - hand over manager role (current manager only)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  const body = await request.json();
  const { nextManagerId, month, year } = body;

  // Update current user to MEMBER
  await prisma.user.update({
    where: { id: session.user.id },
    data: { role: "MEMBER" },
  });

  // Update next manager to MANAGER
  await prisma.user.update({
    where: { id: nextManagerId },
    data: { role: "MANAGER" },
  });

  // Create rotation record
  const rotation = await prisma.managerRotation.upsert({
    where: { month_year_messId: { month, year, messId } },
    update: { memberId: nextManagerId },
    create: { memberId: nextManagerId, messId, month, year },
  });

  const nextManager = await prisma.user.findUnique({ where: { id: nextManagerId } });

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "ManagerRotation",
    recordId: rotation.id,
    fieldName: "manager",
    oldValue: session.user.name,
    newValue: nextManager?.name || nextManagerId,
    action: "UPDATE",
  });

  return NextResponse.json({ success: true });
}
