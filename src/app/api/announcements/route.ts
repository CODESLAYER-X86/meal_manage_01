import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

// GET announcements for the mess
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || 20);

  const announcements = await prisma.announcement.findMany({
    where: { messId },
    include: { author: { select: { id: true, name: true } } },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  return NextResponse.json(announcements);
}

// POST — create announcement (manager only)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
    return NextResponse.json({ error: "Only the manager can post announcements" }, { status: 403 });
  }
  const messId = session.user.messId;

  const body = await request.json();
  const { title, body: announcementBody, pinned } = body;

  if (!title?.trim() || !announcementBody?.trim()) {
    return NextResponse.json({ error: "Title and body are required" }, { status: 400 });
  }

  const announcement = await prisma.announcement.create({
    data: {
      messId,
      authorId: session.user.id,
      title: title.trim(),
      body: announcementBody.trim(),
      pinned: !!pinned,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "Announcement",
    recordId: announcement.id,
    fieldName: "title",
    oldValue: "",
    newValue: title.trim(),
    action: "CREATE",
  });

  // Notify all members
  const members = await prisma.user.findMany({
    where: { messId, isActive: true, NOT: { id: session.user.id } },
    select: { id: true },
  });

  if (members.length > 0) {
    await prisma.notification.createMany({
      data: members.map((m) => ({
        userId: m.id,
        messId,
        type: "announcement",
        title: `📢 ${title.trim()}`,
        message: announcementBody.trim().substring(0, 100),
      })),
    });
  }

  return NextResponse.json(announcement);
}

// PATCH — toggle pin (manager only)
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { id, pinned } = body;

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing || existing.messId !== session.user.messId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.announcement.update({
    where: { id },
    data: { pinned: !!pinned },
  });

  await createAuditLog({
    editedById: session.user.id,
    messId: session.user.messId,
    tableName: "Announcement",
    recordId: id,
    fieldName: "pinned",
    oldValue: String(existing.pinned),
    newValue: String(!!pinned),
    action: "UPDATE",
  });

  return NextResponse.json(updated);
}

// DELETE — delete announcement (manager only)
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing || existing.messId !== session.user.messId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await createAuditLog({
    editedById: session.user.id,
    messId: session.user.messId,
    tableName: "Announcement",
    recordId: id,
    fieldName: "title",
    oldValue: existing.title,
    newValue: "",
    action: "DELETE",
  });

  await prisma.announcement.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
