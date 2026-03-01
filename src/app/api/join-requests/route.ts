import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

// GET - Get pending join requests for manager's mess, or check user's own pending request
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const checkOwn = searchParams.get("own");

  // If user is checking their own pending request
  if (checkOwn === "true") {
    const pendingRequest = await prisma.joinRequest.findFirst({
      where: {
        userId: session.user.id,
        status: "PENDING",
      },
      include: {
        mess: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json({ pendingRequest });
  }

  // Manager checking pending requests for their mess
  if (!session.user.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, messId: true },
  });

  if (user?.role !== "MANAGER") {
    return NextResponse.json({ error: "Only managers can view join requests" }, { status: 403 });
  }

  const requests = await prisma.joinRequest.findMany({
    where: {
      messId: session.user.messId,
      status: "PENDING",
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ requests });
}

// POST - Approve, reject join request, or kick a member
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const manager = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, messId: true },
  });

  if (manager?.role !== "MANAGER") {
    return NextResponse.json({ error: "Only managers can manage members" }, { status: 403 });
  }

  const body = await request.json();
  const { action, requestId, memberId } = body;

  // APPROVE a join request
  if (action === "approve" && requestId) {
    const joinRequest = await prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: { user: { select: { name: true } } },
    });

    if (!joinRequest || joinRequest.messId !== session.user.messId || joinRequest.status !== "PENDING") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Approve: update request status + assign user to mess
    await prisma.$transaction([
      prisma.joinRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", reviewedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: joinRequest.userId },
        data: { messId: joinRequest.messId, role: "MEMBER" },
      }),
    ]);

    await createAuditLog({
      editedById: session.user.id,
      messId: session.user.messId,
      tableName: "JoinRequest",
      recordId: requestId,
      fieldName: `Approved ${joinRequest.user.name}`,
      oldValue: "PENDING",
      newValue: "APPROVED",
      action: "UPDATE",
    });

    return NextResponse.json({ success: true, action: "approved" });
  }

  // REJECT a join request
  if (action === "reject" && requestId) {
    const joinRequest = await prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: { user: { select: { name: true } } },
    });

    if (!joinRequest || joinRequest.messId !== session.user.messId || joinRequest.status !== "PENDING") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED", reviewedAt: new Date() },
    });

    await createAuditLog({
      editedById: session.user.id,
      messId: session.user.messId,
      tableName: "JoinRequest",
      recordId: requestId,
      fieldName: `Rejected ${joinRequest.user.name}`,
      oldValue: "PENDING",
      newValue: "REJECTED",
      action: "UPDATE",
    });

    return NextResponse.json({ success: true, action: "rejected" });
  }

  // KICK a member from the mess
  if (action === "kick" && memberId) {
    if (memberId === session.user.id) {
      return NextResponse.json({ error: "You cannot kick yourself" }, { status: 400 });
    }

    const member = await prisma.user.findUnique({
      where: { id: memberId },
      select: { name: true, messId: true, role: true },
    });

    if (!member || member.messId !== session.user.messId) {
      return NextResponse.json({ error: "Member not found in your mess" }, { status: 404 });
    }

    if (member.role === "MANAGER") {
      return NextResponse.json({ error: "Cannot kick a manager" }, { status: 400 });
    }

    // Remove user from mess
    await prisma.user.update({
      where: { id: memberId },
      data: { messId: null, role: "MEMBER" },
    });

    await createAuditLog({
      editedById: session.user.id,
      messId: session.user.messId,
      tableName: "User",
      recordId: memberId,
      fieldName: `Kicked ${member.name}`,
      oldValue: "MEMBER",
      newValue: "REMOVED",
      action: "DELETE",
    });

    return NextResponse.json({ success: true, action: "kicked" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
