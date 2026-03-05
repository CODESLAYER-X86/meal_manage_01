import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

// GET bazar trips
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const date = searchParams.get("date");
  const pending = searchParams.get("pending"); // "true" = only unapproved

  const where: Record<string, unknown> = { messId };
  if (date) {
    where.date = new Date(date);
  } else if (month && year) {
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);
    where.date = { gte: startDate, lte: endDate };
  }
  if (pending === "true") {
    where.approved = false;
  }

  const trips = await prisma.bazarTrip.findMany({
    where,
    include: {
      buyer: { select: { id: true, name: true } },
      items: { orderBy: { serialNo: "asc" } },
    },
    orderBy: { date: "desc" },
  });

  // Resolve companion names
  const allCompanionIds = [...new Set(trips.flatMap((t) => t.companionIds))];
  const companionUsers = allCompanionIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: allCompanionIds } },
        select: { id: true, name: true },
      })
    : [];
  const companionMap = Object.fromEntries(companionUsers.map((u) => [u.id, u.name]));

  // Add trip counts for the period
  const members = await prisma.user.findMany({
    where: { messId, isActive: true },
    select: { id: true, name: true },
  });

  // Year stats: count approved trips (as buyer or companion)
  const currentYear = Number(year) || new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);
  const yearTrips = await prisma.bazarTrip.findMany({
    where: { messId, approved: true, date: { gte: yearStart, lte: yearEnd } },
    select: { buyerId: true, companionIds: true },
  });

  const tripCounts: Record<string, number> = {};
  for (const t of yearTrips) {
    tripCounts[t.buyerId] = (tripCounts[t.buyerId] || 0) + 1;
    for (const cid of t.companionIds) {
      tripCounts[cid] = (tripCounts[cid] || 0) + 1;
    }
  }

  return NextResponse.json({ trips, companionMap, members, tripCounts });
}

// POST - any member submits a bazar trip (needs manager approval)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const messId = session.user.messId;

  const body = await request.json();
  const { date, note, items, companionIds } = body;
  // items: [{ itemName, quantity, unit, price }]

  const totalCost = items.reduce(
    (sum: number, item: { price: number }) => sum + (item.price || 0),
    0
  );

  const trip = await prisma.bazarTrip.create({
    data: {
      date: new Date(date),
      buyerId: session.user.id,
      messId,
      totalCost,
      note,
      companionIds: companionIds || [],
      approved: false,
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
    include: { items: true, buyer: { select: { id: true, name: true } } },
  });

  await createAuditLog({
    editedById: session.user.id,
    messId,
    tableName: "BazarTrip",
    recordId: trip.id,
    fieldName: "all",
    oldValue: null,
    newValue: `৳${totalCost} - ${items.length} items (pending approval)`,
    action: "CREATE",
  });

  return NextResponse.json(trip);
}

// PATCH - Manager approves or rejects a bazar trip
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId || session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Only manager can approve" }, { status: 403 });
  }
  const messId = session.user.messId;

  const body = await request.json();
  const { id, action } = body;

  if (!id || !action) {
    return NextResponse.json({ error: "id and action are required" }, { status: 400 });
  }

  const trip = await prisma.bazarTrip.findUnique({
    where: { id },
    include: { buyer: { select: { name: true } } },
  });
  if (!trip || trip.messId !== messId) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  if (action === "approve") {
    const updated = await prisma.bazarTrip.update({
      where: { id },
      data: { approved: true, approvedAt: new Date(), approvedById: session.user.id },
      include: { buyer: { select: { id: true, name: true } }, items: true },
    });

    await createAuditLog({
      editedById: session.user.id,
      messId,
      tableName: "BazarTrip",
      recordId: id,
      fieldName: "approved",
      oldValue: "false",
      newValue: "true",
      action: "UPDATE",
    });

    return NextResponse.json({ success: true, trip: updated });
  }

  if (action === "reject") {
    // Delete the trip entirely
    await prisma.bazarItem.deleteMany({ where: { tripId: id } });
    await prisma.bazarTrip.delete({ where: { id } });

    await createAuditLog({
      editedById: session.user.id,
      messId,
      tableName: "BazarTrip",
      recordId: id,
      fieldName: "all",
      oldValue: `৳${trip.totalCost} by ${trip.buyer.name}`,
      newValue: null,
      action: "DELETE",
    });

    return NextResponse.json({ success: true, deleted: true });
  }

  // Edit bazar trip (manager only) — update items, note, date
  if (action === "edit") {
    const { items, note, date } = body;

    // Delete old items and re-create
    if (items && Array.isArray(items)) {
      await prisma.bazarItem.deleteMany({ where: { tripId: id } });
      const totalCost = items.reduce(
        (sum: number, item: { price: number }) => sum + (item.price || 0),
        0
      );
      const updated = await prisma.bazarTrip.update({
        where: { id },
        data: {
          totalCost,
          note: note ?? trip.note,
          date: date ? new Date(date) : trip.date,
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
        include: { buyer: { select: { id: true, name: true } }, items: true },
      });

      await createAuditLog({
        editedById: session.user.id,
        messId,
        tableName: "BazarTrip",
        recordId: id,
        fieldName: "items",
        oldValue: `৳${trip.totalCost}`,
        newValue: `৳${totalCost} - ${items.length} items`,
        action: "UPDATE",
      });

      return NextResponse.json({ success: true, trip: updated });
    }

    // Update note/date only
    const updated = await prisma.bazarTrip.update({
      where: { id },
      data: {
        note: note ?? trip.note,
        date: date ? new Date(date) : trip.date,
      },
      include: { buyer: { select: { id: true, name: true } }, items: true },
    });

    await createAuditLog({
      editedById: session.user.id,
      messId,
      tableName: "BazarTrip",
      recordId: id,
      fieldName: "note/date",
      oldValue: trip.note || "",
      newValue: note || "",
      action: "UPDATE",
    });

    return NextResponse.json({ success: true, trip: updated });
  }

  return NextResponse.json({ error: "Invalid action (approve/reject/edit)" }, { status: 400 });
}

// DELETE - Delete a bazar trip (manager or the buyer if still pending)
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const trip = await prisma.bazarTrip.findUnique({ where: { id } });
  if (!trip || trip.messId !== session.user.messId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isManager = session.user.role === "MANAGER";
  const isBuyer = trip.buyerId === session.user.id;

  if (!isManager && !isBuyer) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  if (!isManager && trip.approved) {
    return NextResponse.json({ error: "Cannot delete approved trip. Ask manager." }, { status: 403 });
  }

  await createAuditLog({
    editedById: session.user.id,
    messId: session.user.messId,
    tableName: "BazarTrip",
    recordId: id,
    fieldName: "trip",
    oldValue: `৳${trip.totalCost} by ${trip.buyerId}`,
    newValue: "",
    action: "DELETE",
  });

  await prisma.bazarItem.deleteMany({ where: { tripId: id } });
  await prisma.bazarTrip.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
