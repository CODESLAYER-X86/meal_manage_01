import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET - List meal-off requests for the mess
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // PENDING, APPROVED, REJECTED, or null for all
  const mine = searchParams.get("mine"); // "true" = only my requests

  const where: Record<string, unknown> = { messId };
  if (status) where.status = status;
  if (mine === "true") where.memberId = session.user.id;

  const requests = await prisma.mealOffRequest.findMany({
    where,
    include: {
      member: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

// POST - Submit a new meal-off request (any member)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const body = await request.json();
  const { fromDate, toDate, reason, skipBreakfast, skipLunch, skipDinner } = body;

  if (!fromDate || !toDate) {
    return NextResponse.json({ error: "From date and to date are required" }, { status: 400 });
  }

  const from = new Date(fromDate);
  const to = new Date(toDate);

  if (to < from) {
    return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
  }

  // At least one meal must be skipped
  const skipB = skipBreakfast !== false; // default true
  const skipL = skipLunch !== false;
  const skipD = skipDinner !== false;
  if (!skipB && !skipL && !skipD) {
    return NextResponse.json({ error: "You must skip at least one meal" }, { status: 400 });
  }

  // From date must be today or in the future
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  from.setHours(0, 0, 0, 0);
  if (from < today) {
    return NextResponse.json({ error: "Cannot request meal-off for past dates" }, { status: 400 });
  }

  // Check for overlapping pending/approved requests
  const overlap = await prisma.mealOffRequest.findFirst({
    where: {
      memberId: session.user.id,
      messId,
      status: { in: ["PENDING", "APPROVED"] },
      fromDate: { lte: new Date(toDate) },
      toDate: { gte: new Date(fromDate) },
    },
  });

  if (overlap) {
    return NextResponse.json({ error: "You already have an overlapping request for those dates" }, { status: 400 });
  }

  const req = await prisma.mealOffRequest.create({
    data: {
      memberId: session.user.id,
      messId,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      skipBreakfast: skipB,
      skipLunch: skipL,
      skipDinner: skipD,
      reason: reason?.trim() || null,
    },
    include: {
      member: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(req);
}

// PATCH - Approve or reject a meal-off request (manager only)
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Only the manager can approve/reject requests" }, { status: 403 });
  }

  const body = await request.json();
  const { id, action } = body; // action: "approve" or "reject"

  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const existing = await prisma.mealOffRequest.findUnique({
    where: { id },
    include: { member: { select: { name: true } } },
  });

  if (!existing || existing.messId !== session.user.messId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (existing.status !== "PENDING") {
    return NextResponse.json({ error: "This request has already been reviewed" }, { status: 400 });
  }

  const updated = await prisma.mealOffRequest.update({
    where: { id },
    data: {
      status: action === "approve" ? "APPROVED" : "REJECTED",
      reviewedAt: new Date(),
    },
    include: {
      member: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(updated);
}

// DELETE - Cancel own pending request or manager can delete any
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Request ID required" }, { status: 400 });
  }

  const existing = await prisma.mealOffRequest.findUnique({ where: { id } });

  if (!existing || existing.messId !== session.user.messId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Members can only cancel their own PENDING requests
  if (session.user.role !== "MANAGER") {
    if (existing.memberId !== session.user.id) {
      return NextResponse.json({ error: "You can only cancel your own requests" }, { status: 403 });
    }
    if (existing.status !== "PENDING") {
      return NextResponse.json({ error: "Can only cancel pending requests" }, { status: 400 });
    }
  }

  await prisma.mealOffRequest.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
