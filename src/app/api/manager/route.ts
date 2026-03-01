import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

// GET current manager
export async function GET() {
  const now = new Date();
  const rotation = await prisma.managerRotation.findUnique({
    where: {
      month_year: {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
    },
    include: { member: { select: { id: true, name: true } } },
  });
  return NextResponse.json(rotation);
}

// POST - hand over manager role (current manager only)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

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
    where: { month_year: { month, year } },
    update: { memberId: nextManagerId },
    create: { memberId: nextManagerId, month, year },
  });

  const nextManager = await prisma.user.findUnique({ where: { id: nextManagerId } });

  await createAuditLog({
    editedById: session.user.id,
    tableName: "ManagerRotation",
    recordId: rotation.id,
    fieldName: "manager",
    oldValue: session.user.name,
    newValue: nextManager?.name || nextManagerId,
    action: "UPDATE",
  });

  return NextResponse.json({ success: true });
}
