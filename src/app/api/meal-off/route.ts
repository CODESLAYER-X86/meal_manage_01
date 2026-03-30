import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
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
  const { fromDate, toDate, reason, skipBreakfast, skipLunch, skipDinner, durationType } = body;

  const dtype = durationType === "unknown" ? "unknown" : "finite";

  if (!fromDate) {
    return NextResponse.json({ error: "From date is required" }, { status: 400 });
  }

  if (dtype === "finite" && !toDate) {
    return NextResponse.json({ error: "To date is required for finite duration" }, { status: 400 });
  }

  const from = new Date(fromDate);
  const to = dtype === "finite" ? new Date(toDate) : null;

  if (to && to < from) {
    return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
  }

  // At least one meal must be skipped
  const skipB = skipBreakfast !== false;
  const skipL = skipLunch !== false;
  const skipD = skipDinner !== false;
  if (!skipB && !skipL && !skipD) {
    return NextResponse.json({ error: "You must skip at least one meal" }, { status: 400 });
  }

  // From date must be today or in the future
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fromCheck = new Date(from);
  fromCheck.setHours(0, 0, 0, 0);
  if (fromCheck < today) {
    return NextResponse.json({ error: "Cannot request meal-off for past dates" }, { status: 400 });
  }

  // ===== Deadline enforcement =====
  // If requesting for TODAY, enforce meal-specific deadlines (Bangladesh time UTC+6)
  const now = new Date();
  const nowBD = new Date(now.getTime() + 6 * 60 * 60 * 1000); // shift to BD time
  const todayBD = new Date(nowBD);
  todayBD.setUTCHours(0, 0, 0, 0);
  const fromDayBD = new Date(from.getTime() + 6 * 60 * 60 * 1000);
  fromDayBD.setUTCHours(0, 0, 0, 0);

  const isForToday = fromDayBD.getTime() === todayBD.getTime();
  const isTomorrow = fromDayBD.getTime() === todayBD.getTime() + 86400000;

  if (isForToday) {
    const hourBD = nowBD.getUTCHours();
    // Breakfast off: must tell before 6 AM today
    if (skipB && hourBD >= 6) {
      return NextResponse.json({ error: "Too late! Breakfast off must be requested before 6:00 AM" }, { status: 400 });
    }
    // Lunch off: must tell before 2 PM (14:00) today
    if (skipL && hourBD >= 14) {
      return NextResponse.json({ error: "Too late! Lunch off must be requested before 2:00 PM" }, { status: 400 });
    }
    // Dinner off: must tell before 2 PM (14:00) today
    if (skipD && hourBD >= 14) {
      return NextResponse.json({ error: "Too late! Dinner off must be requested before 2:00 PM" }, { status: 400 });
    }
  }

  // For tomorrow: lunch off must be requested before 2 PM today
  if (isTomorrow) {
    const hourBD = nowBD.getUTCHours();
    if (skipB && hourBD >= 22) {
      // Breakfast tomorrow: must tell before 10 PM tonight (generous)
    }
  }

  // Check for overlapping pending/approved requests
  const overlapWhere: Record<string, unknown> = {
    memberId: session.user.id,
    messId,
    status: { in: ["PENDING", "APPROVED"] },
    fromDate: { lte: to ? new Date(toDate) : new Date("2099-12-31") },
  };
  if (dtype === "finite") {
    overlapWhere.OR = [
      { toDate: { gte: new Date(fromDate) } },
      { toDate: null }, // overlaps with ongoing "unknown" durations
    ];
  } else {
    overlapWhere.OR = [
      { toDate: { gte: new Date(fromDate) } },
      { toDate: null },
    ];
  }

  const overlap = await prisma.mealOffRequest.findFirst({ where: overlapWhere });

  if (overlap) {
    return NextResponse.json({ error: "You already have an overlapping request for those dates" }, { status: 400 });
  }

  const req = await prisma.mealOffRequest.create({
    data: {
      memberId: session.user.id,
      messId,
      fromDate: new Date(fromDate),
      toDate: to ? new Date(toDate) : null,
      durationType: dtype,
      skipBreakfast: skipB,
      skipLunch: skipL,
      skipDinner: skipD,
      reason: reason?.trim() || null,
    },
    include: {
      member: { select: { id: true, name: true } },
    },
  });

  // Notify the manager about the new meal-off request
  try {
    const manager = await prisma.user.findFirst({
      where: { messId, role: "MANAGER", isActive: true },
      select: { id: true },
    });
    if (manager && manager.id !== session.user.id) {
      const mealsSkipped = [skipB && "Breakfast", skipL && "Lunch", skipD && "Dinner"].filter(Boolean).join(", ");
      const fromStr = new Date(fromDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const durationStr = dtype === "unknown"
        ? `from ${fromStr} (until further notice)`
        : to
        ? `${fromStr} → ${to.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
        : fromStr;

      await prisma.notification.create({
        data: {
          userId: manager.id,
          messId,
          type: "meal_off_request",
          title: "🏖️ New Meal-Off Request",
          message: `${req.member.name} requested meal off: ${durationStr}. Meals: ${mealsSkipped}.${reason?.trim() ? " Reason: " + reason.trim() : ""}`,
        },
      });
    }
  } catch {
    // Non-critical — don't fail the request if notification fails
  }

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

  // Notify the member about the decision
  try {
    const fromStr = existing.fromDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const isUnknown = existing.durationType === "unknown" || !existing.toDate;
    const durationStr = isUnknown
      ? `from ${fromStr} (until further notice)`
      : existing.toDate
      ? `${fromStr} → ${existing.toDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
      : fromStr;

    await prisma.notification.create({
      data: {
        userId: existing.memberId,
        messId: session.user.messId,
        type: action === "approve" ? "meal_off_approved" : "meal_off_rejected",
        title: action === "approve" ? "✅ Meal-Off Approved" : "❌ Meal-Off Rejected",
        message: `Your meal-off request ${durationStr} has been ${action === "approve" ? "approved" : "rejected"} by the manager.`,
      },
    });
  } catch {
    // Non-critical
  }

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
