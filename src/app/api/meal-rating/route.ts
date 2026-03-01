import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET ratings for a date or month
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  if (date) {
    const ratings = await prisma.mealRating.findMany({
      where: { messId, date: new Date(date) },
      include: { member: { select: { id: true, name: true } } },
      orderBy: { meal: "asc" },
    });
    return NextResponse.json(ratings);
  }

  if (month && year) {
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);
    const ratings = await prisma.mealRating.findMany({
      where: { messId, date: { gte: startDate, lte: endDate } },
      include: { member: { select: { id: true, name: true } } },
      orderBy: [{ date: "asc" }, { meal: "asc" }],
    });
    return NextResponse.json(ratings);
  }

  return NextResponse.json({ error: "Provide date or month+year" }, { status: 400 });
}

// POST — rate a meal (any member)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const body = await request.json();
  const { date, meal, rating, comment } = body;

  if (!date || !meal || !rating) {
    return NextResponse.json({ error: "date, meal, and rating are required" }, { status: 400 });
  }

  if (!["breakfast", "lunch", "dinner"].includes(meal)) {
    return NextResponse.json({ error: "meal must be breakfast, lunch, or dinner" }, { status: 400 });
  }

  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 });
  }

  // Can only rate today or yesterday
  const ratingDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  ratingDate.setHours(0, 0, 0, 0);

  if (ratingDate < yesterday) {
    return NextResponse.json({ error: "Can only rate today's or yesterday's meals" }, { status: 400 });
  }

  const result = await prisma.mealRating.upsert({
    where: {
      date_meal_memberId: {
        date: new Date(date),
        meal,
        memberId: session.user.id,
      },
    },
    update: { rating, comment: comment?.trim() || null },
    create: {
      date: new Date(date),
      meal,
      rating,
      comment: comment?.trim() || null,
      memberId: session.user.id,
      messId,
    },
  });

  return NextResponse.json(result);
}
