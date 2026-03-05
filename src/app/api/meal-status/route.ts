import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

// Helper: get Bangladesh time components
function getBDTime() {
  const now = new Date();
  const bd = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  return { hour: bd.getUTCHours(), minute: bd.getUTCMinutes(), now, bd };
}

// Helper: check if a meal is in a blackout window right now
function isInBlackout(meal: string, blackouts: { meals: string[]; startHour: number; endHour: number }[]): boolean {
  const { hour } = getBDTime();
  for (const b of blackouts) {
    if (b.meals.includes(meal) && hour >= b.startHour && hour < b.endHour) {
      return true;
    }
  }
  return false;
}

// Helper: get meals list from mess config (dynamic)
function getMealsList(mealTypes: string | null | undefined, mealsPerDay: number): string[] {
  if (mealTypes) {
    try {
      const parsed = JSON.parse(mealTypes);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* fallback */ }
  }
  return mealsPerDay === 2 ? ["lunch", "dinner"] : ["breakfast", "lunch", "dinner"];
}

// Helper: sync MealEntry from all meal statuses for a member on a date
async function syncMealEntry(memberId: string, messId: string, date: Date, mealsList: string[]) {
  // Get all meal statuses for this member on this date
  const statuses = await prisma.mealStatus.findMany({
    where: { memberId, messId, date },
    select: { meal: true, isOff: true },
  });
  const statusMap: Record<string, boolean> = {};
  for (const s of statuses) statusMap[s.meal] = s.isOff;

  // Build meals object: 1 = eating (default), 0 = off
  const mealsObj: Record<string, number> = {};
  let total = 0;
  for (const meal of mealsList) {
    const val = statusMap[meal] ? 0 : 1; // isOff=true → 0
    mealsObj[meal] = val;
    total += val;
  }

  // Legacy column values
  const breakfast = mealsObj["breakfast"] ?? 0;
  const lunch = mealsObj["lunch"] ?? 0;
  const dinner = mealsObj["dinner"] ?? 0;

  await prisma.mealEntry.upsert({
    where: { date_memberId: { date, memberId } },
    update: {
      breakfast, lunch, dinner,
      meals: JSON.stringify(mealsObj),
      total,
    },
    create: {
      date, memberId, messId,
      breakfast, lunch, dinner,
      meals: JSON.stringify(mealsObj),
      total,
    },
  });
}

// GET - Get meal status for a date (or today + tomorrow)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date"); // optional, defaults to today+tomorrow

  // Get mess config
  const mess = await prisma.mess.findUnique({
    where: { id: messId },
    select: { mealsPerDay: true, mealTypes: true, mealBlackouts: true },
  });
  const mealsPerDay = mess?.mealsPerDay ?? 3;
  const blackouts = mess?.mealBlackouts ? JSON.parse(mess.mealBlackouts) : [];
  const mealsList = getMealsList(mess?.mealTypes, mealsPerDay);

  // Get members
  const members = await prisma.user.findMany({
    where: { messId, isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  }) as { id: string; name: string; role: string }[];

  // Determine dates to fetch
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let dates: Date[];
  if (dateParam) {
    dates = [new Date(dateParam + "T00:00:00.000Z")];
  } else {
    dates = [today, tomorrow];
  }

  // Get existing statuses for these dates
  const statuses = await prisma.mealStatus.findMany({
    where: {
      messId,
      date: { in: dates },
    },
    select: { date: true, meal: true, memberId: true, isOff: true, changedBy: true },
  });

  // Build a lookup map: "dateStr|meal|memberId" -> status
  const statusMap: Record<string, { isOff: boolean; changedBy: string | null }> = {};
  for (const s of statuses) {
    const key = `${s.date.toISOString().split("T")[0]}|${s.meal}|${s.memberId}`;
    statusMap[key] = { isOff: s.isOff, changedBy: s.changedBy };
  }

  // Build response: for each date, each member, each meal — default is ON (isOff=false)
  const result = dates.map((d) => {
    const dateStr = d.toISOString().split("T")[0];
    return {
      date: dateStr,
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        meals: mealsList.reduce((acc, meal) => {
          const key = `${dateStr}|${meal}|${m.id}`;
          const status = statusMap[key];
          acc[meal] = {
            isOff: status?.isOff ?? false,
            changedBy: status?.changedBy ?? null,
          };
          return acc;
        }, {} as Record<string, { isOff: boolean; changedBy: string | null }>),
      })),
      // Count how many members are eating each meal
      mealCounts: mealsList.reduce((acc, meal) => {
        const eatingCount = members.filter((m) => {
          const key = `${dateStr}|${meal}|${m.id}`;
          const status = statusMap[key];
          return !(status?.isOff);
        }).length;
        acc[meal] = eatingCount;
        return acc;
      }, {} as Record<string, number>),
    };
  });

  // Get pending special requests for this user
  const pendingRequests = await prisma.mealStatusRequest.findMany({
    where: {
      messId,
      status: "PENDING",
      ...(session.user.role !== "MANAGER" ? { memberId: session.user.id } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  // Check current blackout status for each meal
  const blackoutStatus = mealsList.reduce((acc, meal) => {
    acc[meal] = isInBlackout(meal, blackouts);
    return acc;
  }, {} as Record<string, boolean>);

  // When a specific date is requested, flatten the response for convenience
  if (dateParam && result.length === 1) {
    const r = result[0];
    // Build flat statuses: { memberId: { meal: isOff } }
    const flatStatuses: Record<string, Record<string, boolean>> = {};
    for (const m of r.members) {
      flatStatuses[m.id] = {};
      for (const meal of mealsList) {
        flatStatuses[m.id][meal] = m.meals[meal]?.isOff ?? false;
      }
    }
    return NextResponse.json({
      date: r.date,
      mealsPerDay,
      mealsList,
      members: members.map((m) => ({ id: m.id, name: m.name })),
      statuses: flatStatuses,
      mealCounts: r.mealCounts,
      blackoutStatus,
      pendingRequests,
    });
  }

  return NextResponse.json({
    dates: result,
    mealsPerDay,
    mealsList,
    blackouts,
    blackoutStatus,
    pendingRequests,
    members,
  });
}

// POST - Toggle meal status (member toggles own, manager can toggle anyone)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;
  const isManager = session.user.role === "MANAGER";

  const body = await request.json();
  const { date, meal, memberId } = body;
  let { isOff } = body;

  if (!date || !meal) {
    return NextResponse.json({ error: "date and meal are required" }, { status: 400 });
  }

  // Determine target member
  const targetMemberId = memberId && isManager ? memberId : session.user.id;
  const isSelf = targetMemberId === session.user.id;

  // Non-manager can only change own status
  if (!isManager && targetMemberId !== session.user.id) {
    return NextResponse.json({ error: "You can only change your own meal status" }, { status: 403 });
  }

  // Get mess config
  const mess = await prisma.mess.findUnique({
    where: { id: messId },
    select: { mealsPerDay: true, mealTypes: true, mealBlackouts: true },
  });
  const mealsPerDay = mess?.mealsPerDay ?? 3;
  const blackouts = mess?.mealBlackouts ? JSON.parse(mess.mealBlackouts) : [];
  const mealsList = getMealsList(mess?.mealTypes, mealsPerDay);

  if (!mealsList.includes(meal)) {
    return NextResponse.json({ error: `Invalid meal. Options: ${mealsList.join(", ")}` }, { status: 400 });
  }

  // Date validation: can't change past dates (use BD timezone)
  const mealDate = new Date(date + "T00:00:00.000Z");
  const { bd } = getBDTime();
  const todayBD = new Date(Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth(), bd.getUTCDate()));
  if (mealDate < todayBD) {
    return NextResponse.json({ error: "Cannot change meal status for past dates" }, { status: 400 });
  }

  // If isOff not provided, toggle: look up current status and flip it
  if (typeof isOff !== "boolean") {
    const existing = await prisma.mealStatus.findUnique({
      where: { date_meal_memberId: { date: mealDate, meal, memberId: targetMemberId } },
    });
    isOff = !(existing?.isOff ?? false); // default is ON (false), so toggle to OFF (true)
  }

  // Blackout check: non-managers can't toggle during blackout hours (any date)
  if (!isManager && isSelf && isInBlackout(meal, blackouts)) {
    return NextResponse.json({
      error: `Cannot change ${meal} status during restricted hours. Send a special request instead.`,
      blackout: true,
    }, { status: 403 });
  }

  // Upsert the status
  const status = await prisma.mealStatus.upsert({
    where: {
      date_meal_memberId: {
        date: mealDate,
        meal,
        memberId: targetMemberId,
      },
    },
    update: {
      isOff,
      changedBy: isManager && !isSelf ? session.user.id : null,
    },
    create: {
      date: mealDate,
      meal,
      memberId: targetMemberId,
      messId,
      isOff,
      changedBy: isManager && !isSelf ? session.user.id : null,
    },
  });

  // Auto-sync MealEntry from meal status
  await syncMealEntry(targetMemberId, messId, mealDate, mealsList);

  // Audit log if manager changed someone else's status
  if (isManager && !isSelf) {
    const targetMember = await prisma.user.findUnique({
      where: { id: targetMemberId },
      select: { name: true },
    });
    await prisma.auditLog.create({
      data: {
        editedById: session.user.id,
        messId,
        tableName: "MealStatus",
        recordId: status.id,
        fieldName: `${meal} (${date})`,
        oldValue: isOff ? "ON" : "OFF",
        newValue: isOff ? "OFF" : "ON",
        action: "UPDATE",
      },
    });

    // Notify the member
    try {
      await prisma.notification.create({
        data: {
          userId: targetMemberId,
          messId,
          type: "meal_status_change",
          title: isOff ? "🍽️ Meal Turned Off" : "🍽️ Meal Turned On",
          message: `Manager changed your ${meal} on ${new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} to ${isOff ? "OFF" : "ON"}.`,
        },
      });
    } catch {
      // Non-critical
    }
  }

  return NextResponse.json({ success: true, status });
}

// PATCH - Handle special requests (submit or approve/reject)
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;
  const isManager = session.user.role === "MANAGER";

  const body = await request.json();
  const { action } = body;

  // Member: submit special request during blackout
  if (action === "request") {
    const { date, meal, reason } = body;
    let { wantOff } = body;
    if (!date || !meal) {
      return NextResponse.json({ error: "date and meal are required" }, { status: 400 });
    }

    // If wantOff not specified, auto-determine: toggle from current status
    if (typeof wantOff !== "boolean") {
      const mealDate = new Date(date + "T00:00:00.000Z");
      const existing = await prisma.mealStatus.findUnique({
        where: { date_meal_memberId: { date: mealDate, meal, memberId: session.user.id } },
      });
      wantOff = !(existing?.isOff ?? false); // default ON, so request OFF
    }

    // Check for existing pending request
    const existing = await prisma.mealStatusRequest.findFirst({
      where: { memberId: session.user.id, messId, date: new Date(date + "T00:00:00.000Z"), meal, status: "PENDING" },
    });
    if (existing) {
      return NextResponse.json({ error: "You already have a pending request for this meal" }, { status: 400 });
    }

    const req = await prisma.mealStatusRequest.create({
      data: {
        date: new Date(date + "T00:00:00.000Z"),
        meal,
        memberId: session.user.id,
        messId,
        wantOff,
        reason: reason?.trim() || null,
      },
    });

    // Notify manager
    try {
      const manager = await prisma.user.findFirst({
        where: { messId, role: "MANAGER", isActive: true },
        select: { id: true },
      });
      if (manager) {
        const memberName = session.user.name || "A member";
        await prisma.notification.create({
          data: {
            userId: manager.id,
            messId,
            type: "meal_status_request",
            title: "🔔 Meal Status Request",
            message: `${memberName} wants to turn ${meal} ${wantOff ? "OFF" : "ON"} on ${new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.${reason ? " Reason: " + reason.trim() : ""}`,
          },
        });
      }
    } catch {
      // Non-critical
    }

    return NextResponse.json({ success: true, request: req });
  }

  // Manager: approve or reject a special request
  if (action === "approve" || action === "reject") {
    if (!isManager) {
      return NextResponse.json({ error: "Only manager can approve/reject" }, { status: 403 });
    }

    const { requestId } = body;
    if (!requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }

    const req = await prisma.mealStatusRequest.findUnique({ where: { id: requestId } });
    if (!req || req.messId !== messId) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (req.status !== "PENDING") {
      return NextResponse.json({ error: "Request already handled" }, { status: 400 });
    }

    // Update request status
    await prisma.mealStatusRequest.update({
      where: { id: requestId },
      data: { status: action === "approve" ? "APPROVED" : "REJECTED" },
    });

    // If approved, apply the status change
    if (action === "approve") {
      await prisma.mealStatus.upsert({
        where: {
          date_meal_memberId: {
            date: req.date,
            meal: req.meal,
            memberId: req.memberId,
          },
        },
        update: {
          isOff: req.wantOff,
          changedBy: session.user.id,
        },
        create: {
          date: req.date,
          meal: req.meal,
          memberId: req.memberId,
          messId,
          isOff: req.wantOff,
          changedBy: session.user.id,
        },
      });

      // Auto-sync MealEntry from approved status change
      const mess2 = await prisma.mess.findUnique({
        where: { id: messId },
        select: { mealsPerDay: true, mealTypes: true },
      });
      const mealsList2 = getMealsList(mess2?.mealTypes, mess2?.mealsPerDay ?? 3);
      await syncMealEntry(req.memberId, messId, req.date, mealsList2);
    }

    // Audit log for approve/reject
    await createAuditLog({
      editedById: session.user.id,
      messId,
      tableName: "MealStatusRequest",
      recordId: requestId,
      fieldName: `${req.meal} (${req.date.toISOString().split("T")[0]})`,
      oldValue: "PENDING",
      newValue: action === "approve" ? "APPROVED" : "REJECTED",
      action: "UPDATE",
    });

    // Notify the member
    try {
      await prisma.notification.create({
        data: {
          userId: req.memberId,
          messId,
          type: action === "approve" ? "meal_request_approved" : "meal_request_rejected",
          title: action === "approve" ? "✅ Meal Request Approved" : "❌ Meal Request Rejected",
          message: `Your request to turn ${req.meal} ${req.wantOff ? "OFF" : "ON"} on ${req.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} was ${action === "approve" ? "approved" : "rejected"}.`,
        },
      });
    } catch {
      // Non-critical
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
