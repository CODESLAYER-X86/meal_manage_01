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

// Helper: get today's date string in Bangladesh timezone (YYYY-MM-DD)
function getTodayBD(): { todayStr: string; todayDate: Date; tomorrowDate: Date } {
  const { bd } = getBDTime();
  const y = bd.getUTCFullYear();
  const m = String(bd.getUTCMonth() + 1).padStart(2, '0');
  const d = String(bd.getUTCDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const todayDate = new Date(todayStr + "T00:00:00.000Z");
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  return { todayStr, todayDate, tomorrowDate };
}

// Helper: check if a meal is in a blackout window right now (supports minute precision)
function isInBlackout(meal: string, blackouts: { meals: string[]; startHour: number; startMinute?: number; endHour: number; endMinute?: number }[]): boolean {
  const { hour, minute } = getBDTime();
  const nowTotal = hour * 60 + minute;
  for (const b of blackouts) {
    if (!b.meals?.includes(meal)) continue;
    const startTotal = b.startHour * 60 + (b.startMinute ?? 0);
    const endTotal = b.endHour * 60 + (b.endMinute ?? 0);
    if (nowTotal >= startTotal && nowTotal < endTotal) return true;
  }
  return false;
}

// Helper: check if blackout has STARTED (past the start time, regardless of end)
// Used for auto-fill: once blackout starts, we lock in meal entries
function hasBlackoutStarted(meal: string, blackouts: { meals: string[]; startHour: number; startMinute?: number; endHour: number; endMinute?: number }[]): boolean {
  const { hour, minute } = getBDTime();
  const nowTotal = hour * 60 + minute;
  for (const b of blackouts) {
    if (!b.meals?.includes(meal)) continue;
    const startTotal = b.startHour * 60 + (b.startMinute ?? 0);
    if (nowTotal >= startTotal) return true;
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
// lockedMeals: optional list of meal names that are already locked by auto-fill (don't overwrite)
async function syncMealEntry(memberId: string, messId: string, date: Date, mealsList: string[], lockedMeals?: string[]) {
  // Get all meal statuses for this member on this date
  const statuses = await prisma.mealStatus.findMany({
    where: { memberId, messId, date },
    select: { meal: true, isOff: true },
  });
  const statusMap: Record<string, boolean> = {};
  for (const s of statuses) statusMap[s.meal] = s.isOff;

  // If there are locked meals, get existing entry to preserve their values
  let existingMealsObj: Record<string, number> = {};
  if (lockedMeals && lockedMeals.length > 0) {
    const existing = await prisma.mealEntry.findUnique({
      where: { date_memberId: { date, memberId } },
    });
    if (existing?.meals) {
      try { existingMealsObj = JSON.parse(existing.meals as string); } catch { /* ignore */ }
    }
  }

  // Build meals object: 1 = eating (default), 0 = off
  const mealsObj: Record<string, number> = {};
  let total = 0;
  for (const meal of mealsList) {
    // If this meal is locked and already has a value in the existing entry, preserve it
    if (lockedMeals?.includes(meal) && meal in existingMealsObj) {
      mealsObj[meal] = existingMealsObj[meal];
    } else {
      mealsObj[meal] = statusMap[meal] ? 0 : 1; // isOff=true → 0
    }
    total += mealsObj[meal];
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
    select: { mealsPerDay: true, mealTypes: true, mealBlackouts: true, autoMealEntry: true },
  });
  const mealsPerDay = mess?.mealsPerDay ?? 3;
  let blackouts = [];
  try {
    const parsed = mess?.mealBlackouts ? JSON.parse(mess.mealBlackouts) : [];
    if (Array.isArray(parsed)) blackouts = parsed;
  } catch { /* ignore */ }
  const mealsList = getMealsList(mess?.mealTypes, mealsPerDay);

  // Get members
  const members = await prisma.user.findMany({
    where: { messId, isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  }) as { id: string; name: string; role: string }[];

  // Determine dates to fetch (use Bangladesh timezone)
  const { todayDate: today, tomorrowDate: tomorrow } = getTodayBD();

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

  // Get cancelled meals
  const mealPlans = await prisma.mealPlan.findMany({
    where: { messId, date: { in: dates } },
    select: { date: true, cancelledMeals: true }
  });
  const cancelledMap: Record<string, string[]> = {};
  for (const mp of mealPlans) {
    const key = mp.date.toISOString().split("T")[0];
    try { cancelledMap[key] = JSON.parse(mp.cancelledMeals || "[]"); } catch { cancelledMap[key] = []; }
  }

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
      cancelledMeals: cancelledMap[dateStr] || [],
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

  // ===== AUTO-FILL: Lock each meal independently when its blackout starts =====
  const { todayDate } = getTodayBD();
  const lockedMeals = mealsList.filter(meal => hasBlackoutStarted(meal, blackouts));

  if (mess?.autoMealEntry !== false && lockedMeals.length > 0) {
    for (const m of members) {
      // Get existing entry (if any)
      const existing = await prisma.mealEntry.findUnique({
        where: { date_memberId: { date: todayDate, memberId: m.id } },
      });

      // Parse existing meals JSON or start empty
      const existingMealsObj: Record<string, number> = existing?.meals
        ? JSON.parse(existing.meals as string)
        : {};

      // Check which locked meals haven't been synced into the entry yet
      const mealsToSync = lockedMeals.filter(meal => !(meal in existingMealsObj));
      if (mealsToSync.length === 0) continue; // all locked meals already in entry

      // Get MealStatus for the meals that need syncing
      const statuses = await prisma.mealStatus.findMany({
        where: { memberId: m.id, messId, date: todayDate, meal: { in: mealsToSync } },
        select: { meal: true, isOff: true },
      });
      const statusMap: Record<string, boolean> = {};
      for (const s of statuses) statusMap[s.meal] = s.isOff;

      // Add newly locked meals to the meals object (preserve existing)
      for (const meal of mealsToSync) {
        existingMealsObj[meal] = statusMap[meal] ? 0 : 1;
      }

      // Recalculate total from all meals present
      let total = 0;
      for (const meal of mealsList) {
        total += existingMealsObj[meal] ?? 0;
      }

      const breakfast = existingMealsObj["breakfast"] ?? 0;
      const lunch = existingMealsObj["lunch"] ?? 0;
      const dinner = existingMealsObj["dinner"] ?? 0;

      await prisma.mealEntry.upsert({
        where: { date_memberId: { date: todayDate, memberId: m.id } },
        update: { breakfast, lunch, dinner, meals: JSON.stringify(existingMealsObj), total },
        create: { date: todayDate, memberId: m.id, messId, breakfast, lunch, dinner, meals: JSON.stringify(existingMealsObj), total },
      });
    }
  }

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
      cancelledMeals: r.cancelledMeals,
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
  let blackouts = [];
  try {
    const parsed = mess?.mealBlackouts ? JSON.parse(mess.mealBlackouts) : [];
    if (Array.isArray(parsed)) blackouts = parsed;
  } catch { /* ignore */ }
  const mealsList = getMealsList(mess?.mealTypes, mealsPerDay);

  if (!mealsList.includes(meal)) {
    return NextResponse.json({ error: `Invalid meal. Options: ${mealsList.join(", ")}` }, { status: 400 });
  }

  // Date validation: can't change past dates (managers can override to fix mistakes)
  const mealDate = new Date(date + "T00:00:00.000Z");
  const { bd } = getBDTime();
  const todayBD = new Date(Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth(), bd.getUTCDate()));
  const isToday = mealDate.getTime() === todayBD.getTime();

  if (mealDate < todayBD && !isManager) {
    return NextResponse.json({ error: "Cannot change meal status for past dates" }, { status: 400 });
  }

  // If isOff not provided, toggle: look up current status and flip it
  if (typeof isOff !== "boolean") {
    const existing = await prisma.mealStatus.findUnique({
      where: { date_meal_memberId: { date: mealDate, meal, memberId: targetMemberId } },
    });
    isOff = !(existing?.isOff ?? false); // default is ON (false), so toggle to OFF (true)
  }

  // Blackout check: non-managers can't toggle during blackout hours OF TODAY
  if (!isManager && isSelf && isToday && isInBlackout(meal, blackouts)) {
    return NextResponse.json({
      error: `Cannot change ${meal} status during restricted hours. Send a special request instead.`,
      blackout: true,
    }, { status: 403 });
  }

  // Cancelled Check: Nobody can toggle ON a canceled meal
  const plan = await prisma.mealPlan.findUnique({
    where: { date_messId: { date: mealDate, messId } },
    select: { cancelledMeals: true }
  });
  if (plan?.cancelledMeals) {
    let cm = [];
    try { cm = JSON.parse(plan.cancelledMeals); } catch {}
    if (cm.includes(meal) && !isOff) {
      return NextResponse.json({ error: "This meal has been canceled by the manager for today." }, { status: 403 });
    }
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
  // For today's date, respect locked meals (those whose blackout has already started)
  const { todayDate: syncTodayDate } = getTodayBD();
  let lockedMealsForSync: string[] | undefined;
  if (mealDate.getTime() === syncTodayDate.getTime()) {
    lockedMealsForSync = mealsList.filter(m => m !== meal && hasBlackoutStarted(m, blackouts));
  }
  await syncMealEntry(targetMemberId, messId, mealDate, mealsList, lockedMealsForSync);

  // Audit log if manager changed someone else's status
  if (isManager && !isSelf) {
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
    const mealDate = new Date(date + "T00:00:00.000Z");
    if (typeof wantOff !== "boolean") {
      const existing = await prisma.mealStatus.findUnique({
        where: { date_meal_memberId: { date: mealDate, meal, memberId: session.user.id } },
      });
      wantOff = !(existing?.isOff ?? false); // default ON, so request OFF
    }

    // Cancelled check
    const plan = await prisma.mealPlan.findUnique({
      where: { date_messId: { date: mealDate, messId } },
      select: { cancelledMeals: true }
    });
    if (plan?.cancelledMeals) {
      let cm = [];
      try { cm = JSON.parse(plan.cancelledMeals); } catch {}
      if (cm.includes(meal) && !wantOff) {
        return NextResponse.json({ error: "This meal has been canceled by the manager." }, { status: 403 });
      }
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
