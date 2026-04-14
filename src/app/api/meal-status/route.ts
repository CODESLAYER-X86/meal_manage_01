import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
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

// Helper: sync MealEntry from all meal statuses for a member on a date.
// lockedMeals = meals whose blackout has already STARTED.
// For locked meals, we PRESERVE the existing snapshot value in MealEntry (immutable once locked).
// For unlocked meals (blackout hasn't started), we always read current MealStatus.
async function syncMealEntry(memberId: string, messId: string, date: Date, mealsList: string[], lockedMeals?: string[]) {
  const statuses = await prisma.mealStatus.findMany({
    where: { memberId, messId, date },
    select: { meal: true, isOff: true },
  });
  const statusMap: Record<string, boolean> = {};
  for (const s of statuses) statusMap[s.meal] = s.isOff;

  // Get existing entry so we can preserve already-locked meal values
  const existingEntry = await prisma.mealEntry.findFirst({
    where: { date, memberId },
  });
  let existingMealsObj: Record<string, number> = {};
  if (existingEntry?.meals) {
    try { existingMealsObj = JSON.parse(existingEntry.meals as string); } catch { /* ignore */ }
  }

  // Build meals object:
  //   - Locked meal WITH existing snapshot → preserve snapshot (immutable, blackout passed)
  //   - Everything else → read current MealStatus (1 = eating, 0 = off)
  const mealsObj: Record<string, number> = {};
  let total = 0;
  for (const meal of mealsList) {
    const isLocked = lockedMeals?.includes(meal);
    const hasSnapshot = meal in existingMealsObj;
    if (isLocked && hasSnapshot) {
      // Preserve the locked snapshot
      mealsObj[meal] = existingMealsObj[meal];
    } else {
      // Live status (toggling still applies if blackout hasn't started, or manager override)
      mealsObj[meal] = statusMap[meal] ? 0 : 1;
    }
    total += mealsObj[meal];
  }

  const breakfast = mealsObj["breakfast"] ?? 0;
  const lunch = mealsObj["lunch"] ?? 0;
  const dinner = mealsObj["dinner"] ?? 0;

  if (existingEntry) {
    await prisma.mealEntry.update({
      where: { id: existingEntry.id },
      data: { breakfast, lunch, dinner, meals: JSON.stringify(mealsObj), total },
    });
  } else {
    await prisma.mealEntry.create({
      data: { date, memberId, messId, breakfast, lunch, dinner, meals: JSON.stringify(mealsObj), total },
    });
  }
}

// GET - Get meal status for a date (or today + tomorrow)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.messId) {
      return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
    }
    const messId = session.user.messId;

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

    // Get mess config
    const mess = await prisma.mess.findUnique({
      where: { id: messId },
      select: { mealsPerDay: true, mealTypes: true, mealBlackouts: true, autoMealEntry: true },
    });
    const mealsPerDay = mess?.mealsPerDay ?? 3;
    let blackouts: any[] = [];
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
      where: { messId, date: { in: dates } },
      select: { date: true, meal: true, memberId: true, isOff: true, changedBy: true },
    });

    // Get cancelled meals
    const mealPlans = await prisma.mealPlan.findMany({
      where: { messId, date: { in: dates } },
      select: { date: true, cancelledMeals: true },
    });
    const cancelledMap: Record<string, string[]> = {};
    for (const mp of mealPlans) {
      const dateStr = mp.date.toISOString().split("T")[0];
      try { cancelledMap[dateStr] = JSON.parse(mp.cancelledMeals || "[]"); } catch { cancelledMap[dateStr] = []; }
    }

    // Build status map
    const statusMap: Record<string, typeof statuses[0]> = {};
    for (const s of statuses) {
      const dateStr = s.date.toISOString().split("T")[0];
      statusMap[`${dateStr}|${s.meal}|${s.memberId}`] = s;
    }

    // Build response
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

    // ===== AUTO-FILL: When a meal's blackout has started, snapshot all members' entries =====
    // We only write entries for meals that have NOT been snapshotted yet (first time blackout starts).
    // This is now the ONLY place auto-fill happens (not duplicated inline above).
    const { todayDate } = getTodayBD();
    const lockedMeals = mealsList.filter(meal => hasBlackoutStarted(meal, blackouts));

    if (mess?.autoMealEntry !== false && lockedMeals.length > 0) {
      await Promise.all(members.map(async (m) => {
        // Get the existing entry to check if we already snapshotted this meal
        const existingEntry = await prisma.mealEntry.findFirst({
          where: { date: todayDate, memberId: m.id },
        });
        let existingMealsObj: Record<string, number> = {};
        if (existingEntry?.meals) {
          try { existingMealsObj = JSON.parse(existingEntry.meals as string); } catch { /* ignore */ }
        }

        // Only auto-fill meals that haven't been snapshotted yet
        const mealsNeedingSnapshot = lockedMeals.filter((meal) => !(meal in existingMealsObj));
        if (mealsNeedingSnapshot.length === 0) return; // All locked meals already snapshotted

        // Read current MealStatus for just the meals that need snapshotting
        const mealStatuses = await prisma.mealStatus.findMany({
          where: { memberId: m.id, messId, date: todayDate, meal: { in: mealsNeedingSnapshot } },
          select: { meal: true, isOff: true },
        });
        const sMap: Record<string, boolean> = {};
        for (const s of mealStatuses) sMap[s.meal] = s.isOff;

        // Write snapshot values for newly-locked meals
        for (const meal of mealsNeedingSnapshot) {
          existingMealsObj[meal] = sMap[meal] ? 0 : 1;
        }

        // Recalculate total from all meals in the list
        let total = 0;
        for (const meal of mealsList) total += existingMealsObj[meal] ?? 0;

        const breakfast = existingMealsObj["breakfast"] ?? 0;
        const lunch = existingMealsObj["lunch"] ?? 0;
        const dinner = existingMealsObj["dinner"] ?? 0;

        if (existingEntry) {
          await prisma.mealEntry.update({
            where: { id: existingEntry.id },
            data: { breakfast, lunch, dinner, meals: JSON.stringify(existingMealsObj), total },
          });
        } else {
          await prisma.mealEntry.create({
            data: { date: todayDate, memberId: m.id, messId, breakfast, lunch, dinner, meals: JSON.stringify(existingMealsObj), total },
          });
        }
      }));
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

    // Check current blackout status for each meal.
    // Blackout only applies to TODAY. Future dates (tomorrow, etc.) are never locked
    // so users can freely pre-set their meal status for upcoming days.
    const { todayDate: blackoutRefDate } = getTodayBD();
    const blackoutStatus = mealsList.reduce((acc, meal) => {
      acc[meal] = hasBlackoutStarted(meal, blackouts);
      return acc;
    }, {} as Record<string, boolean>);

    // When a specific date is requested, flatten the response for convenience
    if (dateParam && result.length === 1) {
      const requestedDate = new Date(dateParam + "T00:00:00.000Z");
      const isRequestedToday = requestedDate.getTime() === blackoutRefDate.getTime();

      // For future dates, override blackout to false — meals are never locked for future dates
      const dateBlackoutStatus = isRequestedToday
        ? blackoutStatus
        : mealsList.reduce((acc, meal) => { acc[meal] = false; return acc; }, {} as Record<string, boolean>);
      const r = result[0];
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
        blackoutStatus: dateBlackoutStatus,
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
  } catch (err: any) {
    console.error("MealStatus GET error:", err);
    return NextResponse.json({
      error: err.message,
      mealsPerDay: 3,
      mealsList: ["breakfast", "lunch", "dinner"],
      members: [],
      statuses: {},
      mealCounts: {},
      blackoutStatus: {},
      pendingRequests: [],
      debugOnly: true,
    });
  }
}

// POST - Toggle meal status (member toggles own, manager can toggle anyone)
export async function POST(request: NextRequest) {
  try {
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

    if (!isManager && targetMemberId !== session.user.id) {
      return NextResponse.json({ error: "You can only change your own meal status" }, { status: 403 });
    }

    // Get mess config
    const mess = await prisma.mess.findUnique({
      where: { id: messId },
      select: { mealsPerDay: true, mealTypes: true, mealBlackouts: true },
    });
    const mealsPerDay = mess?.mealsPerDay ?? 3;
    let blackouts: any[] = [];
    try {
      const parsed = mess?.mealBlackouts ? JSON.parse(mess.mealBlackouts) : [];
      if (Array.isArray(parsed)) blackouts = parsed;
    } catch { /* ignore */ }
    const mealsList = getMealsList(mess?.mealTypes, mealsPerDay);

    if (!mealsList.includes(meal)) {
      return NextResponse.json({ error: `Invalid meal. Options: ${mealsList.join(", ")}` }, { status: 400 });
    }

    // Date validation
    const mealDate = new Date(date + "T00:00:00.000Z");
    const { bd } = getBDTime();
    const todayBD = new Date(Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth(), bd.getUTCDate()));
    const isToday = mealDate.getTime() === todayBD.getTime();

    if (mealDate < todayBD && !isManager) {
      return NextResponse.json({ error: "Cannot change meal status for past dates" }, { status: 400 });
    }

    // If isOff not provided, toggle
    if (typeof isOff !== "boolean") {
      const existing = await prisma.mealStatus.findFirst({
        where: { date: mealDate, meal, memberId: targetMemberId },
      });
      isOff = !(existing?.isOff ?? false);
    }

    // Blackout check
    if (!isManager && isSelf && isToday && hasBlackoutStarted(meal, blackouts)) {
      return NextResponse.json({
        error: `Cannot change ${meal} status after the confirmation time. Send a special request instead.`,
        blackout: true,
      }, { status: 403 });
    }

    // Cancelled Check
    const plan = await prisma.mealPlan.findFirst({
      where: { date: mealDate, messId },
      select: { cancelledMeals: true },
    });
    if (plan?.cancelledMeals) {
      let cm: string[] = [];
      try { cm = JSON.parse(plan.cancelledMeals); } catch { /* ignore */ }
      if (cm.includes(meal) && !isOff) {
        return NextResponse.json({ error: "This meal has been canceled by the manager for today." }, { status: 403 });
      }
    }

    // Upsert the status using findFirst + update/create
    const existingStatus = await prisma.mealStatus.findFirst({
      where: { date: mealDate, meal, memberId: targetMemberId },
    });

    const changedByVal = isManager && !isSelf ? session.user.id : null;

    let status;
    if (existingStatus) {
      status = await prisma.mealStatus.update({
        where: { id: existingStatus.id },
        data: { isOff, changedBy: changedByVal },
      });
    } else {
      status = await prisma.mealStatus.create({
        data: { date: mealDate, meal, memberId: targetMemberId, messId, isOff, changedBy: changedByVal },
      });
    }

    // Sync MealEntry after toggle:
    // - For future dates or today BEFORE blackout: full sync (all meals from live status)
    // - For today AFTER blackout: surgically update ONLY the toggled meal, preserving other frozen snapshots
    const isMealLocked = isToday && hasBlackoutStarted(meal, blackouts);

    if (isMealLocked) {
      // Surgical update: only change the specific meal that was just toggled (manager override).
      // Regular members can't reach here — they're blocked by the 403 check above.
      const existingEntry = await prisma.mealEntry.findFirst({
        where: { date: mealDate, memberId: targetMemberId },
      });
      let mealsObj: Record<string, number> = {};
      if (existingEntry?.meals) {
        try { mealsObj = JSON.parse(existingEntry.meals as string); } catch { /* ignore */ }
      }
      mealsObj[meal] = isOff ? 0 : 1;
      let total = 0;
      for (const ml of mealsList) total += mealsObj[ml] ?? 0;
      const breakfast = mealsObj["breakfast"] ?? 0;
      const lunch = mealsObj["lunch"] ?? 0;
      const dinner = mealsObj["dinner"] ?? 0;
      if (existingEntry) {
        await prisma.mealEntry.update({
          where: { id: existingEntry.id },
          data: { breakfast, lunch, dinner, meals: JSON.stringify(mealsObj), total },
        });
      } else {
        await prisma.mealEntry.create({
          data: { date: mealDate, memberId: targetMemberId, messId, breakfast, lunch, dinner, meals: JSON.stringify(mealsObj), total },
        });
      }
    } else {
      // Normal sync: no locked meals, read all live statuses
      await syncMealEntry(targetMemberId, messId, mealDate, mealsList);
    }

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
  } catch (err: any) {
    console.error("MealStatus POST error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

// PATCH - Handle special requests (submit or approve/reject)
export async function PATCH(request: NextRequest) {
  try {
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

      const mealDate = new Date(date + "T00:00:00.000Z");
      if (typeof wantOff !== "boolean") {
        const existing = await prisma.mealStatus.findFirst({
          where: { date: mealDate, meal, memberId: session.user.id },
        });
        wantOff = !(existing?.isOff ?? false);
      }

      // Cancelled check
      const plan = await prisma.mealPlan.findFirst({
        where: { date: mealDate, messId },
        select: { cancelledMeals: true },
      });
      if (plan?.cancelledMeals) {
        let cm: string[] = [];
        try { cm = JSON.parse(plan.cancelledMeals); } catch { /* ignore */ }
        if (cm.includes(meal) && !wantOff) {
          return NextResponse.json({ error: "This meal has been canceled by the manager." }, { status: 403 });
        }
      }

      // Check for existing pending request
      const existingReq = await prisma.mealStatusRequest.findFirst({
        where: { memberId: session.user.id, messId, date: mealDate, meal, status: "PENDING" },
      });
      if (existingReq) {
        return NextResponse.json({ error: "You already have a pending request for this meal" }, { status: 400 });
      }

      const req = await prisma.mealStatusRequest.create({
        data: {
          date: mealDate,
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
        const existingApproval = await prisma.mealStatus.findFirst({
          where: { date: req.date, meal: req.meal, memberId: req.memberId },
        });

        if (existingApproval) {
          await prisma.mealStatus.update({
            where: { id: existingApproval.id },
            data: { isOff: req.wantOff, changedBy: session.user.id },
          });
        } else {
          await prisma.mealStatus.create({
            data: {
              date: req.date,
              meal: req.meal,
              memberId: req.memberId,
              messId,
              isOff: req.wantOff,
              changedBy: session.user.id,
            },
          });
        }

        // Surgically update ONLY the approved meal in MealEntry, preserving all other snapshots.
        // We do NOT call syncMealEntry because that would re-read all statuses and potentially
        // overwrite other locked meal snapshots.
        const mess2 = await prisma.mess.findUnique({
          where: { id: messId },
          select: { mealsPerDay: true, mealTypes: true },
        });
        const mealsList2 = getMealsList(mess2?.mealTypes, mess2?.mealsPerDay ?? 3);

        const existingEntry = await prisma.mealEntry.findFirst({
          where: { date: req.date, memberId: req.memberId },
        });
        let mealsObj: Record<string, number> = {};
        if (existingEntry?.meals) {
          try { mealsObj = JSON.parse(existingEntry.meals as string); } catch { /* ignore */ }
        }

        // Update only the approved meal
        mealsObj[req.meal] = req.wantOff ? 0 : 1;

        // Recalculate total
        let total = 0;
        for (const ml of mealsList2) total += mealsObj[ml] ?? 0;

        const breakfast = mealsObj["breakfast"] ?? 0;
        const lunch = mealsObj["lunch"] ?? 0;
        const dinner = mealsObj["dinner"] ?? 0;

        if (existingEntry) {
          await prisma.mealEntry.update({
            where: { id: existingEntry.id },
            data: { breakfast, lunch, dinner, meals: JSON.stringify(mealsObj), total },
          });
        } else {
          await prisma.mealEntry.create({
            data: { date: req.date, memberId: req.memberId, messId, breakfast, lunch, dinner, meals: JSON.stringify(mealsObj), total },
          });
        }
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
  } catch (err: any) {
    console.error("MealStatus PATCH error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
