import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

// Force all handlers in this route to be dynamic (no caching)
export const dynamic = "force-dynamic";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "MESS-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

// GET - Get current user's mess info
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_CACHE_HEADERS });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      mess: {
        include: {
          members: {
            where: { isActive: true },
            select: { id: true, name: true, email: true, role: true, phone: true },
          },
          createdBy: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!user?.mess) {
    return NextResponse.json({ mess: null }, { headers: NO_CACHE_HEADERS });
  }

  return NextResponse.json({
    mess: {
      id: user.mess.id,
      name: user.mess.name,
      inviteCode: user.mess.inviteCode,
      washroomCount: user.mess.washroomCount,
      dueThreshold: user.mess.dueThreshold ?? 500,
      bazarDaysPerWeek: user.mess.bazarDaysPerWeek ?? 3,
      hasGas: user.mess.hasGas ?? false,
      hasCook: user.mess.hasCook ?? false,
      mealsPerDay: user.mess.mealsPerDay ?? 3,
      autoMealEntry: user.mess.autoMealEntry ?? false,
      mealTypes: user.mess.mealTypes ?? '["breakfast","lunch","dinner"]',
      mealBlackouts: user.mess.mealBlackouts ?? "[]",
      createdBy: user.mess.createdBy.name,
      memberCount: user.mess.members.length,
      members: user.mess.members,
    },
  }, { headers: NO_CACHE_HEADERS });
}

// POST - Create or Join a mess
export async function POST(request: Request) {
  try {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  // Check if user already in a mess
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { messId: true },
  });

  if (currentUser?.messId) {
    return NextResponse.json(
      { error: "You are already in a mess. Leave your current mess first." },
      { status: 400 }
    );
  }

  if (action === "create") {
    const { messName } = body;
    if (!messName || !messName.trim()) {
      return NextResponse.json({ error: "Mess name is required" }, { status: 400 });
    }

    // Generate unique invite code
    let inviteCode = generateInviteCode();
    let exists = await prisma.mess.findUnique({ where: { inviteCode } });
    while (exists) {
      inviteCode = generateInviteCode();
      exists = await prisma.mess.findUnique({ where: { inviteCode } });
    }

    // Create mess and assign user as manager
    const mess = await prisma.mess.create({
      data: {
        name: messName.trim(),
        inviteCode,
        createdById: session.user.id,
      },
    });

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        messId: mess.id,
        role: "MANAGER",
      },
    });

    return NextResponse.json({
      success: true,
      mess: {
        id: mess.id,
        name: mess.name,
        inviteCode: mess.inviteCode,
      },
    });
  }

  if (action === "join") {
    const { inviteCode } = body;
    if (!inviteCode || !inviteCode.trim()) {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    const searchCode = inviteCode.trim().toUpperCase();

    const mess = await prisma.mess.findUnique({
      where: { inviteCode: searchCode },
      select: { id: true, name: true },
    });

    if (!mess) {
      return NextResponse.json(
        { error: "Invalid invite code. Please check and try again." },
        { status: 404 }
      );
    }

    // Check if already has a pending/approved request for this mess
    const existingRequest = await prisma.joinRequest.findUnique({
      where: { userId_messId: { userId: session.user.id, messId: mess.id } },
    });

    if (existingRequest) {
      if (existingRequest.status === "PENDING") {
        return NextResponse.json(
          { error: "You already have a pending request for this mess." },
          { status: 400 }
        );
      }
      if (existingRequest.status === "APPROVED") {
        // User was previously approved but may have been kicked (messId is now null)
        // If they still have messId, they are actually in the mess
        if (currentUser?.messId) {
          return NextResponse.json(
            { error: "You are already a member of this mess." },
            { status: 400 }
          );
        }
        // Kicked member trying to re-join — allow by resetting to PENDING
        await prisma.joinRequest.update({
          where: { id: existingRequest.id },
          data: { status: "PENDING", reviewedAt: null },
        });
        return NextResponse.json({
          success: true,
          pending: true,
          mess: { id: mess.id, name: mess.name },
        });
      }
      // If rejected, allow re-request by updating
      await prisma.joinRequest.update({
        where: { id: existingRequest.id },
        data: { status: "PENDING", reviewedAt: null },
      });

      return NextResponse.json({
        success: true,
        pending: true,
        mess: { id: mess.id, name: mess.name },
      });
    }

    // Create a new join request (pending manager approval)
    await prisma.joinRequest.create({
      data: {
        userId: session.user.id,
        messId: mess.id,
      },
    });

    return NextResponse.json({
      success: true,
      pending: true,
      mess: { id: mess.id, name: mess.name },
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("[API] Mess POST error:", (error as Error).message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH - Update mess settings (manager only)
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Always use DB values, not JWT (may be stale)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, messId: true },
  });

  if (!user?.messId || user.role !== "MANAGER") {
    return NextResponse.json({ error: "Only the manager can update mess settings" }, { status: 403 });
  }

  const messId = user.messId;
  const body = await request.json();
  const { name, washroomCount, dueThreshold, hasGas, hasCook, bazarDaysPerWeek, mealsPerDay, mealTypes, mealBlackouts, autoMealEntry } = body;

  // Get current mess for audit comparison
  const currentMess = await prisma.mess.findUnique({ where: { id: messId } });

  const updateData: Record<string, unknown> = {};

  if (name !== undefined) {
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 50) {
      return NextResponse.json({ error: "Mess name must be between 2 and 50 characters" }, { status: 400 });
    }
    updateData.name = trimmedName;
  }

  if (mealTypes !== undefined) {
    // mealTypes is an array of meal names e.g. ["breakfast", "lunch", "dinner"]
    if (!Array.isArray(mealTypes) || mealTypes.length === 0 || mealTypes.length > 10) {
      return NextResponse.json({ error: "mealTypes must be an array of 1-10 meal names" }, { status: 400 });
    }
    for (const mt of mealTypes) {
      if (typeof mt !== "string" || mt.trim().length === 0 || mt.trim().length > 30) {
        return NextResponse.json({ error: "Each meal type must be a non-empty string (max 30 chars)" }, { status: 400 });
      }
    }
    const cleaned = mealTypes.map((mt: string) => mt.trim().toLowerCase());
    updateData.mealTypes = JSON.stringify(cleaned);
    updateData.mealsPerDay = cleaned.length;
  } else if (mealsPerDay !== undefined) {
    if (typeof mealsPerDay !== "number" || mealsPerDay < 1 || mealsPerDay > 10) {
      return NextResponse.json({ error: "Meals per day must be between 1 and 10" }, { status: 400 });
    }
    updateData.mealsPerDay = mealsPerDay;
  }

  if (mealBlackouts !== undefined) {
    // Validate blackouts array
    if (!Array.isArray(mealBlackouts)) {
      return NextResponse.json({ error: "mealBlackouts must be an array" }, { status: 400 });
    }
    for (const b of mealBlackouts) {
      if (!Array.isArray(b.meals) || typeof b.startHour !== "number" || typeof b.endHour !== "number") {
        return NextResponse.json({ error: "Each blackout must have meals[], startHour, endHour" }, { status: 400 });
      }
      const startMin = b.startMinute ?? 0;
      const endMin = b.endMinute ?? 0;
      if (b.startHour < 0 || b.startHour > 23 || b.endHour < 0 || b.endHour > 23) {
        return NextResponse.json({ error: "Invalid blackout hours" }, { status: 400 });
      }
      if (startMin < 0 || startMin > 59 || endMin < 0 || endMin > 59) {
        return NextResponse.json({ error: "Invalid blackout minutes" }, { status: 400 });
      }
      const startTotal = b.startHour * 60 + startMin;
      const endTotal = b.endHour * 60 + endMin;
      if (startTotal >= endTotal) {
        return NextResponse.json({ error: "Blackout start time must be before end time" }, { status: 400 });
      }
    }
    updateData.mealBlackouts = JSON.stringify(mealBlackouts);
  }

  if (washroomCount !== undefined) {
    if (typeof washroomCount !== "number" || washroomCount < 0 || washroomCount > 10) {
      return NextResponse.json({ error: "Washroom count must be a number between 0 and 10" }, { status: 400 });
    }
    updateData.washroomCount = washroomCount;
  }

  if (dueThreshold !== undefined) {
    if (typeof dueThreshold !== "number" || dueThreshold < 0) {
      return NextResponse.json({ error: "Due threshold must be a positive number" }, { status: 400 });
    }
    updateData.dueThreshold = dueThreshold;
  }

  if (hasGas !== undefined) {
    updateData.hasGas = Boolean(hasGas);
  }

  if (hasCook !== undefined) {
    updateData.hasCook = Boolean(hasCook);
  }

  if (autoMealEntry !== undefined) {
    updateData.autoMealEntry = Boolean(autoMealEntry);
  }

  if (bazarDaysPerWeek !== undefined) {
    if (typeof bazarDaysPerWeek !== "number" || bazarDaysPerWeek < 1 || bazarDaysPerWeek > 7) {
      return NextResponse.json({ error: "Bazar days per week must be 1-7" }, { status: 400 });
    }
    updateData.bazarDaysPerWeek = bazarDaysPerWeek;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await prisma.mess.update({
    where: { id: messId },
    data: updateData,
  });

  // Audit log for settings change
  if (currentMess) {
    const changes: string[] = [];
    for (const key of Object.keys(updateData)) {
      const oldVal = String((currentMess as Record<string, unknown>)[key] ?? "");
      const newVal = String(updateData[key] ?? "");
      if (oldVal !== newVal) changes.push(`${key}: ${oldVal} → ${newVal}`);
    }
    if (changes.length > 0) {
      await createAuditLog({
        editedById: session.user.id,
        messId,
        tableName: "Mess",
        recordId: messId,
        fieldName: "settings",
        oldValue: changes.map(c => c.split(" → ")[0]).join(", "),
        newValue: changes.join("; "),
        action: "UPDATE",
      });
    }
  }

  return NextResponse.json({ success: true, ...updateData });
}

// DELETE - Delete the entire mess (manager only)
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Always use DB values, not JWT (may be stale)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, messId: true },
  });

  if (!user?.messId || user.role !== "MANAGER") {
    return NextResponse.json({ error: "Only the manager can delete the mess" }, { status: 403 });
  }

  const messId = user.messId;

  // Audit log before deletion
  const messInfo = await prisma.mess.findUnique({ where: { id: messId }, select: { name: true } });
  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "Mess",
    recordId: messId,
    fieldName: "all",
    oldValue: messInfo?.name ?? "unknown",
    newValue: null,
    action: "DELETE",
  });

  try {
    // Delete all mess data in sequential batches to avoid serverless timeout
    // Batch 1: Delete tables with FK dependencies on other mess tables
    await prisma.$transaction([
      prisma.dutySwapRequest.deleteMany({ where: { messId } }),
      prisma.mealVote.deleteMany({ where: { topic: { messId } } }),
      prisma.bazarItem.deleteMany({ where: { trip: { messId } } }),
    ]);

    // Batch 2: Delete scheduling and status tables
    await prisma.$transaction([
      prisma.bazarDutySchedule.deleteMany({ where: { messId } }),
      prisma.washroomDutySchedule.deleteMany({ where: { messId } }),
      prisma.mealStatusRequest.deleteMany({ where: { messId } }),
      prisma.mealStatus.deleteMany({ where: { messId } }),
      prisma.memberPresence.deleteMany({ where: { messId } }),
    ]);

    // Batch 3: Delete financial and content tables
    await prisma.$transaction([
      prisma.billPayment.deleteMany({ where: { messId } }),
      prisma.billSetting.deleteMany({ where: { messId } }),
      prisma.fine.deleteMany({ where: { messId } }),
      prisma.mealVoteTopic.deleteMany({ where: { messId } }),
      prisma.mealRating.deleteMany({ where: { messId } }),
      prisma.notification.deleteMany({ where: { messId } }),
    ]);

    // Batch 4: Delete remaining dependent tables
    await prisma.$transaction([
      prisma.announcement.deleteMany({ where: { messId } }),
      prisma.joinRequest.deleteMany({ where: { messId } }),
      prisma.mealOffRequest.deleteMany({ where: { messId } }),
      prisma.mealPlan.deleteMany({ where: { messId } }),
      prisma.dispute.deleteMany({ where: { messId } }),
      prisma.auditLog.deleteMany({ where: { messId } }),
    ]);

    // Batch 5: Delete core data tables
    await prisma.$transaction([
      prisma.managerRotation.deleteMany({ where: { messId } }),
      prisma.washroomCleaning.deleteMany({ where: { messId } }),
      prisma.bazarTrip.deleteMany({ where: { messId } }),
      prisma.deposit.deleteMany({ where: { messId } }),
      prisma.mealEntry.deleteMany({ where: { messId } }),
    ]);

    // Batch 6: Remove members and delete mess
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { messId },
        data: { messId: null, role: "MEMBER" },
      }),
      prisma.mess.delete({ where: { id: messId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[API] Mess DELETE error:", (error as Error).message);
    return NextResponse.json({ error: "Failed to delete mess. Please try again." }, { status: 500 });
  }
}
