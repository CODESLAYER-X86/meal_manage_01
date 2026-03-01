import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

// GET bazar trips
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const date = searchParams.get("date");

  const where: Record<string, unknown> = {};
  if (date) {
    where.date = new Date(date);
  } else if (month && year) {
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);
    where.date = { gte: startDate, lte: endDate };
  }

  const trips = await prisma.bazarTrip.findMany({
    where,
    include: {
      buyer: { select: { id: true, name: true } },
      items: { orderBy: { serialNo: "asc" } },
    },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(trips);
}

// POST - create a bazar trip with items (manager only)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { date, buyerId, note, items } = body;
  // items: [{ itemName, quantity, unit, price }]

  const totalCost = items.reduce(
    (sum: number, item: { price: number }) => sum + (item.price || 0),
    0
  );

  const trip = await prisma.bazarTrip.create({
    data: {
      date: new Date(date),
      buyerId,
      totalCost,
      note,
      items: {
        create: items.map(
          (
            item: { itemName: string; quantity: number; unit: string; price: number },
            index: number
          ) => ({
            serialNo: index + 1,
            itemName: item.itemName,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price || 0,
          })
        ),
      },
    },
    include: { items: true },
  });

  await createAuditLog({
    editedById: session.user.id,
    tableName: "BazarTrip",
    recordId: trip.id,
    fieldName: "all",
    oldValue: null,
    newValue: `৳${totalCost} - ${items.length} items`,
    action: "CREATE",
  });

  return NextResponse.json(trip);
}
