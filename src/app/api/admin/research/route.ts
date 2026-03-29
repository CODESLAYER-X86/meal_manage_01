import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/admin/research?type=meals|bazar|deposits|members|plans|ratings&from=&to=&messId=&format=csv|json
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !((session.user as any).isAdmin || (session.user as any).isOfficer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "meals";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const messId = searchParams.get("messId");
  const format = searchParams.get("format") || "json";
  const limit = Math.min(Number(searchParams.get("limit") || 10000), 50000);

  const dateFilter: Record<string, unknown> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);
  const hasDateFilter = Object.keys(dateFilter).length > 0;

  const messFilter = messId ? { messId } : {};

  try {
    let data: unknown[] = [];
    let columns: string[] = [];

    switch (type) {
      case "meals": {
        const raw = await prisma.mealEntry.findMany({
          where: {
            ...messFilter,
            ...(hasDateFilter ? { date: dateFilter } : {}),
          },
          include: {
            member: { select: { name: true, email: true } },
            mess: { select: { name: true } },
          },
          orderBy: { date: "desc" },
          take: limit,
        });
        columns = ["date", "messName", "memberName", "memberEmail", "breakfast", "lunch", "dinner", "total", "meals"];
        data = raw.map((r) => ({
          date: r.date.toISOString().split("T")[0],
          messName: r.mess.name,
          memberName: r.member.name,
          memberEmail: r.member.email,
          breakfast: r.breakfast,
          lunch: r.lunch,
          dinner: r.dinner,
          total: r.total,
          meals: r.meals,
        }));
        break;
      }

      case "bazar": {
        const raw = await prisma.bazarItem.findMany({
          where: {
            trip: {
              ...messFilter,
              ...(hasDateFilter ? { date: dateFilter } : {}),
            },
          },
          include: {
            trip: {
              select: {
                date: true,
                totalCost: true,
                buyer: { select: { name: true } },
                mess: { select: { name: true } },
              },
            },
          },
          orderBy: { trip: { date: "desc" } },
          take: limit,
        });
        columns = ["date", "messName", "buyer", "itemName", "normalizedName", "category", "quantity", "unit", "price", "tripTotal"];
        data = raw.map((r) => ({
          date: r.trip.date.toISOString().split("T")[0],
          messName: r.trip.mess.name,
          buyer: r.trip.buyer.name,
          itemName: r.itemName,
          normalizedName: r.normalizedName || "",
          category: r.category || "",
          quantity: r.quantity,
          unit: r.unit,
          price: r.price,
          tripTotal: r.trip.totalCost,
        }));
        break;
      }

      case "deposits": {
        const raw = await prisma.deposit.findMany({
          where: {
            ...messFilter,
            ...(hasDateFilter ? { date: dateFilter } : {}),
          },
          include: {
            member: { select: { name: true, email: true } },
            mess: { select: { name: true } },
          },
          orderBy: { date: "desc" },
          take: limit,
        });
        columns = ["date", "messName", "memberName", "memberEmail", "amount", "note"];
        data = raw.map((r) => ({
          date: r.date.toISOString().split("T")[0],
          messName: r.mess.name,
          memberName: r.member.name,
          memberEmail: r.member.email,
          amount: r.amount,
          note: r.note || "",
        }));
        break;
      }

      case "members": {
        const raw = await prisma.user.findMany({
          where: messId ? { messId } : {},
          include: {
            mess: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        });
        columns = ["name", "email", "phone", "role", "messName", "isActive", "joinDate", "createdAt"];
        data = raw.map((r) => ({
          name: r.name,
          email: r.email,
          phone: r.phone || "",
          role: r.role,
          messName: r.mess?.name || "No mess",
          isActive: r.isActive,
          joinDate: r.joinDate.toISOString().split("T")[0],
          createdAt: r.createdAt.toISOString().split("T")[0],
        }));
        break;
      }

      case "plans": {
        const raw = await prisma.mealPlan.findMany({
          where: {
            ...messFilter,
            ...(hasDateFilter ? { date: dateFilter } : {}),
          },
          include: {
            mess: { select: { name: true } },
          },
          orderBy: { date: "desc" },
          take: limit,
        });
        columns = ["date", "messName", "breakfast", "lunch", "dinner", "cancelledMeals", "wastage"];
        data = raw.map((r) => ({
          date: r.date.toISOString().split("T")[0],
          messName: r.mess.name,
          breakfast: r.breakfast || "",
          lunch: r.lunch || "",
          dinner: r.dinner || "",
          cancelledMeals: r.cancelledMeals,
          wastage: r.wastage,
        }));
        break;
      }

      case "ratings": {
        const raw = await prisma.mealRating.findMany({
          where: {
            ...messFilter,
            ...(hasDateFilter ? { date: dateFilter } : {}),
          },
          include: {
            member: { select: { name: true } },
            mess: { select: { name: true } },
          },
          orderBy: { date: "desc" },
          take: limit,
        });
        columns = ["date", "messName", "memberName", "meal", "rating", "comment"];
        data = raw.map((r) => ({
          date: r.date.toISOString().split("T")[0],
          messName: r.mess.name,
          memberName: r.member.name,
          meal: r.meal,
          rating: r.rating,
          comment: r.comment || "",
        }));
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // CSV format
    if (format === "csv") {
      const csvHeader = columns.join(",");
      const csvRows = data.map((row) => {
        const r = row as Record<string, unknown>;
        return columns.map((col) => {
          const val = String(r[col] ?? "");
          // Escape CSV values containing commas, quotes, or newlines
          if (val.includes(",") || val.includes('"') || val.includes("\n")) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }).join(",");
      });
      const csv = [csvHeader, ...csvRows].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${type}_export_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // JSON format (default)
    return NextResponse.json({
      type,
      count: data.length,
      columns,
      data,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
