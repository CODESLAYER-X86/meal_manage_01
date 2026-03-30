import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

// GET vote topics for this mess
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") !== "false";

  const where: Record<string, unknown> = { messId };
  if (activeOnly) where.active = true;

  const topics = await prisma.mealVoteTopic.findMany({
    where,
    include: {
      votes: {
        include: { voter: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(topics);
}

// POST — create vote topic (manager only)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
    return NextResponse.json({ error: "Only manager can create votes" }, { status: 403 });
  }
  const messId = session.user.messId;

  const body = await request.json();
  const { title, options, targetDate, targetMeal } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  if (!options || !Array.isArray(options) || options.length < 2) {
    return NextResponse.json({ error: "At least 2 options are required" }, { status: 400 });
  }

  const topic = await prisma.mealVoteTopic.create({
    data: {
      messId,
      title: title.trim(),
      options: options.map((o: string) => o.trim()).filter(Boolean),
      targetDate: targetDate ? new Date(targetDate) : null,
      targetMeal: targetMeal || null,
    },
    include: { votes: true },
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
        type: "vote",
        title: "🗳️ New Vote",
        message: title.trim(),
      })),
    });
  }

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "MealVoteTopic",
    recordId: topic.id,
    fieldName: "all",
    oldValue: null,
    newValue: `${title.trim()} (${options.length} options)`,
    action: "CREATE",
  });

  return NextResponse.json(topic);
}

// PATCH — cast a vote or close voting
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const messId = session.user.messId;

  const body = await request.json();
  const { topicId, option, close } = body;

  if (!topicId) {
    return NextResponse.json({ error: "topicId is required" }, { status: 400 });
  }

  // Manager can close a vote
  if (close && session.user.role === "MANAGER") {
    const topic = await prisma.mealVoteTopic.findUnique({ where: { id: topicId } });
    if (!topic || topic.messId !== messId) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }
    const updated = await prisma.mealVoteTopic.update({
      where: { id: topicId },
      data: { active: false },
    });
    await createAuditLog({
      editedById: session.user.id,
      messId,
      tableName: "MealVoteTopic",
      recordId: topicId,
      fieldName: "active",
      oldValue: "true",
      newValue: "false",
      action: "UPDATE",
    });
    return NextResponse.json(updated);
  }

  // Cast a vote
  if (!option) {
    return NextResponse.json({ error: "option is required" }, { status: 400 });
  }

  const topic = await prisma.mealVoteTopic.findUnique({ where: { id: topicId } });
  if (!topic || !topic.active || topic.messId !== messId) {
    return NextResponse.json({ error: "Voting is closed or not found" }, { status: 400 });
  }

  if (!topic.options.includes(option)) {
    return NextResponse.json({ error: "Invalid option" }, { status: 400 });
  }

  const vote = await prisma.mealVote.upsert({
    where: { topicId_voterId: { topicId, voterId: session.user.id } },
    update: { option },
    create: { topicId, voterId: session.user.id, option },
  });

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "MealVote",
    recordId: vote.id,
    fieldName: topic.title,
    oldValue: null,
    newValue: option,
    action: "CREATE",
  });

  return NextResponse.json(vote);
}

// DELETE — delete a vote topic (manager only)
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  // Verify the topic belongs to this mess
  const topic = await prisma.mealVoteTopic.findUnique({ where: { id } });
  if (!topic || topic.messId !== messId) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "MealVoteTopic",
    recordId: id,
    fieldName: "all",
    oldValue: topic.title,
    newValue: null,
    action: "DELETE",
  });

  await prisma.mealVoteTopic.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
