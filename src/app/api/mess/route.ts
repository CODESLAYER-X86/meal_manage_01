import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "MESS-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET - Get current user's mess info
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ mess: null });
  }

  return NextResponse.json({
    mess: {
      id: user.mess.id,
      name: user.mess.name,
      inviteCode: user.mess.inviteCode,
      washroomCount: user.mess.washroomCount,
      dueThreshold: (user.mess as Record<string, unknown>).dueThreshold ?? 500,
      createdBy: user.mess.createdBy.name,
      memberCount: user.mess.members.length,
      members: user.mess.members,
    },
  });
}

// POST - Create or Join a mess
export async function POST(request: Request) {
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

    const mess = await prisma.mess.findUnique({
      where: { inviteCode: inviteCode.trim().toUpperCase() },
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
        return NextResponse.json(
          { error: "You are already a member of this mess." },
          { status: 400 }
        );
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
}

// PATCH - Update mess settings (manager only)
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, messId: true },
  });

  if (user?.role !== "MANAGER") {
    return NextResponse.json({ error: "Only the manager can update mess settings" }, { status: 403 });
  }

  const body = await request.json();
  const { washroomCount, dueThreshold } = body;

  const updateData: Record<string, unknown> = {};

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

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await prisma.mess.update({
    where: { id: session.user.messId },
    data: updateData,
  });

  return NextResponse.json({ success: true, ...updateData });
}

// DELETE - Delete the entire mess (manager only)
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, messId: true },
  });

  if (user?.role !== "MANAGER") {
    return NextResponse.json({ error: "Only the manager can delete the mess" }, { status: 403 });
  }

  const messId = session.user.messId;

  // Delete all mess data in the correct order (respecting FK constraints)
  await prisma.$transaction([
    // Delete meal votes (FK to MealVoteTopic)
    prisma.mealVote.deleteMany({ where: { topic: { messId } } }),
    // Delete meal vote topics
    prisma.mealVoteTopic.deleteMany({ where: { messId } }),
    // Delete meal ratings
    prisma.mealRating.deleteMany({ where: { messId } }),
    // Delete notifications
    prisma.notification.deleteMany({ where: { messId } }),
    // Delete announcements
    prisma.announcement.deleteMany({ where: { messId } }),
    // Delete join requests
    prisma.joinRequest.deleteMany({ where: { messId } }),
    // Delete meal-off requests
    prisma.mealOffRequest.deleteMany({ where: { messId } }),
    // Delete meal plans
    prisma.mealPlan.deleteMany({ where: { messId } }),
    // Delete disputes
    prisma.dispute.deleteMany({ where: { messId } }),
    // Delete audit logs
    prisma.auditLog.deleteMany({ where: { messId } }),
    // Delete manager rotations
    prisma.managerRotation.deleteMany({ where: { messId } }),
    // Delete washroom cleaning
    prisma.washroomCleaning.deleteMany({ where: { messId } }),
    // Delete bazar items (via trips)
    prisma.bazarItem.deleteMany({
      where: { trip: { messId } },
    }),
    // Delete bazar trips
    prisma.bazarTrip.deleteMany({ where: { messId } }),
    // Delete deposits
    prisma.deposit.deleteMany({ where: { messId } }),
    // Delete meal entries
    prisma.mealEntry.deleteMany({ where: { messId } }),
    // Remove all members from the mess (set messId to null, role to MEMBER)
    prisma.user.updateMany({
      where: { messId },
      data: { messId: null, role: "MEMBER" },
    }),
    // Delete the mess itself
    prisma.mess.delete({ where: { id: messId } }),
  ]);

  return NextResponse.json({ success: true });
}
