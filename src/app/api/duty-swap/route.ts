import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

// GET - List swap requests for the mess
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // PENDING | APPROVED | REJECTED

  const where: Record<string, unknown> = { messId };
  if (status) where.status = status;

  const requests = await prisma.dutySwapRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  // Enrich with duty details
  const enriched = await Promise.all(
    requests.map(async (req) => {
      let fromDuty = null;
      let toDuty = null;
      if (req.dutyType === "BAZAR") {
        fromDuty = await prisma.bazarDutySchedule.findUnique({
          where: { id: req.fromDutyId },
          include: { member: { select: { id: true, name: true } } },
        });
        toDuty = await prisma.bazarDutySchedule.findUnique({
          where: { id: req.toDutyId },
          include: { member: { select: { id: true, name: true } } },
        });
      } else {
        fromDuty = await prisma.washroomDutySchedule.findUnique({
          where: { id: req.fromDutyId },
          include: { member: { select: { id: true, name: true } } },
        });
        toDuty = await prisma.washroomDutySchedule.findUnique({
          where: { id: req.toDutyId },
          include: { member: { select: { id: true, name: true } } },
        });
      }
      return { ...req, fromDuty, toDuty };
    })
  );

  return NextResponse.json({ requests: enriched });
}

// POST - Create a swap request
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;
  const body = await request.json();
  const { dutyType, fromDutyId, toDutyId } = body;

  if (!dutyType || !fromDutyId || !toDutyId) {
    return NextResponse.json({ error: "dutyType, fromDutyId, and toDutyId required" }, { status: 400 });
  }
  if (!["BAZAR", "WASHROOM"].includes(dutyType)) {
    return NextResponse.json({ error: "Invalid dutyType" }, { status: 400 });
  }

  // Verify the requester owns the fromDuty
  const model = dutyType === "BAZAR" ? prisma.bazarDutySchedule : prisma.washroomDutySchedule;
  const fromDuty = await (model as typeof prisma.bazarDutySchedule).findUnique({ where: { id: fromDutyId } });
  if (!fromDuty || fromDuty.messId !== messId || fromDuty.memberId !== session.user.id) {
    return NextResponse.json({ error: "You can only request swaps for your own duties" }, { status: 403 });
  }

  const toDuty = await (model as typeof prisma.bazarDutySchedule).findUnique({ where: { id: toDutyId } });
  if (!toDuty || toDuty.messId !== messId) {
    return NextResponse.json({ error: "Target duty not found" }, { status: 404 });
  }

  // Check no duplicate pending request
  const existing = await prisma.dutySwapRequest.findFirst({
    where: { fromDutyId, toDutyId, status: "PENDING" },
  });
  if (existing) {
    return NextResponse.json({ error: "A swap request already exists for these duties" }, { status: 400 });
  }

  const req = await prisma.dutySwapRequest.create({
    data: { dutyType, fromDutyId, toDutyId, requesterId: session.user.id, messId },
  });

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "DutySwapRequest",
    recordId: req.id,
    fieldName: "swap_request",
    oldValue: null,
    newValue: `${dutyType} swap: ${fromDutyId} ↔ ${toDutyId}`,
    action: "CREATE",
  });

  // Notify the target member
  try {
    await prisma.notification.create({
      data: {
        userId: toDuty.memberId,
        messId,
        type: "duty_swap_request",
        title: "🔄 Duty Swap Request",
        message: `${session.user.name || "A member"} wants to swap ${dutyType.toLowerCase()} duty with you on ${fromDuty.date.toISOString().split("T")[0]}.`,
      },
    });
  } catch { /* non-critical */ }

  return NextResponse.json({ success: true, request: req });
}

// PATCH - Approve or reject a swap request
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;
  const isManager = session.user.role === "MANAGER";
  const body = await request.json();
  const { id, action } = body;

  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "id and action (approve/reject) required" }, { status: 400 });
  }

  const req = await prisma.dutySwapRequest.findUnique({ where: { id } });
  if (!req || req.messId !== messId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (req.status !== "PENDING") {
    return NextResponse.json({ error: "Request already handled" }, { status: 400 });
  }

  // Target member or manager can approve/reject
  const model = req.dutyType === "BAZAR" ? prisma.bazarDutySchedule : prisma.washroomDutySchedule;
  const toDuty = await (model as typeof prisma.bazarDutySchedule).findUnique({ where: { id: req.toDutyId } });
  if (!isManager && toDuty?.memberId !== session.user.id) {
    return NextResponse.json({ error: "Only the target member or manager can respond" }, { status: 403 });
  }

  await prisma.dutySwapRequest.update({
    where: { id },
    data: { status: action === "approve" ? "APPROVED" : "REJECTED" },
  });

  // If approved, swap the member assignments
  if (action === "approve") {
    const fromDuty = await (model as typeof prisma.bazarDutySchedule).findUnique({ where: { id: req.fromDutyId } });
    if (fromDuty && toDuty) {
      await (model as typeof prisma.bazarDutySchedule).update({
        where: { id: req.fromDutyId },
        data: { memberId: toDuty.memberId },
      });
      await (model as typeof prisma.bazarDutySchedule).update({
        where: { id: req.toDutyId },
        data: { memberId: fromDuty.memberId },
      });
    }
  }

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "DutySwapRequest",
    recordId: id,
    fieldName: "status",
    oldValue: "PENDING",
    newValue: action === "approve" ? "APPROVED" : "REJECTED",
    action: "UPDATE",
  });

  // Notify the requester
  try {
    await prisma.notification.create({
      data: {
        userId: req.requesterId,
        messId,
        type: action === "approve" ? "duty_swap_approved" : "duty_swap_rejected",
        title: action === "approve" ? "✅ Swap Approved" : "❌ Swap Rejected",
        message: `Your ${req.dutyType.toLowerCase()} duty swap was ${action === "approve" ? "approved" : "rejected"}.`,
      },
    });
  } catch { /* non-critical */ }

  return NextResponse.json({ success: true });
}
