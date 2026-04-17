import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ messId: string }> }) {
  const session = await auth();
  if (!session?.user || !(session.user.isAdmin || session.user.isOfficer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { messId } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "csv";

  try {
    const mess = await prisma.mess.findUnique({
      where: { id: messId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!mess) {
      return NextResponse.json({ error: "Mess not found" }, { status: 404 });
    }

    const [
      members,
      mealEntries,
      deposits,
      bazarTrips,
      washroomCleanings,
      billSettings,
      billPayments,
      auditLogs,
    ] = await Promise.all([
      prisma.user.findMany({
        where: { messId },
        select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, joinDate: true },
        orderBy: { name: "asc" },
      }),
      prisma.mealEntry.findMany({
        where: { messId },
        include: { member: { select: { name: true } } },
        orderBy: { date: "desc" },
      }),
      prisma.deposit.findMany({
        where: { messId },
        include: { member: { select: { name: true } } },
        orderBy: { date: "desc" },
      }),
      prisma.bazarTrip.findMany({
        where: { messId },
        include: {
          buyer: { select: { name: true } },
          items: { orderBy: { serialNo: "asc" } },
        },
        orderBy: { date: "desc" },
      }),
      prisma.washroomCleaning.findMany({
        where: { messId },
        include: { member: { select: { name: true } } },
        orderBy: { date: "desc" },
      }),
      prisma.billSetting.findMany({ where: { messId }, orderBy: [{ year: "desc" }, { month: "desc" }] }),
      prisma.billPayment.findMany({
        where: { messId },
        include: { member: { select: { name: true } } },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      }),
      prisma.auditLog.findMany({
        where: { messId },
        include: { editedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const sanitizedMessName = mess.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().split('T')[0];

    // Format .messmate (JSON)
    if (format === "messmate") {
      const data = {
        metadata: {
          formatVersion: "1.0",
          exportedAt: new Date().toISOString(),
          exportedBy: session.user.id,
          type: "full_backup",
        },
        mess,
        members,
        mealEntries,
        deposits,
        bazarTrips,
        washroomCleanings,
        billSettings,
        billPayments,
        auditLogs,
      };

      const filename = `${sanitizedMessName}_backup_${timestamp}.messmate`;
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Format CSV (Multi-section CSV)
    else if (format === "csv") {
      const csvSections: string[] = [];

      const esc = (val: unknown) => {
        if (val === null || val === undefined) return "";
        const s = String(val);
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const fmtDate = (d: Date | string) => new Date(d).toISOString().split("T")[0];

      // File Header
      csvSections.push("=== MESSMATE PLATFORM DATA EXPORT ===");
      csvSections.push(`Mess Name: ${mess.name}`);
      csvSections.push(`Invite Code: ${mess.inviteCode}`);
      csvSections.push(`Export Date: ${timestamp}`);
      csvSections.push("");

      // 1. Members
      csvSections.push("=== MEMBERS ===");
      csvSections.push("ID,Name,Email,Phone,Role,Status,Join Date");
      for (const m of members) {
        csvSections.push(`${m.id},${esc(m.name)},${esc(m.email)},${esc(m.phone)},${m.role},${m.isActive ? "Active" : "Inactive"},${fmtDate(m.joinDate)}`);
      }
      csvSections.push("");

      // 2. Meal Entries
      csvSections.push("=== MEAL ENTRIES ===");
      csvSections.push("Date,Member,Breakfast,Lunch,Dinner,Total");
      for (const e of mealEntries) {
        csvSections.push(`${fmtDate(e.date)},${esc(e.member.name)},${e.breakfast},${e.lunch},${e.dinner},${e.total}`);
      }
      csvSections.push("");

      // 3. Deposits
      csvSections.push("=== DEPOSITS ===");
      csvSections.push("Date,Member,Amount,Note");
      for (const d of deposits) {
        csvSections.push(`${fmtDate(d.date)},${esc(d.member.name)},${d.amount},${esc(d.note)}`);
      }
      csvSections.push("");

      // 4. Bazar Trips
      csvSections.push("=== BAZAR TRIPS ===");
      csvSections.push("Date,Buyer,Total Cost,Status,Items");
      for (const t of bazarTrips) {
        const itemSummary = t.items.map(i => `${i.itemName} (${i.quantity}${i.unit})`).join("; ");
        const status = t.approved ? "Approved" : "Pending";
        csvSections.push(`${fmtDate(t.date)},${esc(t.buyer.name)},${t.totalCost},${status},${esc(itemSummary)}`);
      }
      csvSections.push("");

      // 5. Bill Payments
      csvSections.push("=== BILL PAYMENTS ===");
      csvSections.push("Month,Year,Member,Amount,Note,Confirmed");
      for (const p of billPayments) {
        csvSections.push(`${p.month},${p.year},${esc(p.member.name)},${p.amount},${esc(p.note)},${p.confirmed ? "Yes" : "No"}`);
      }
      csvSections.push("");

      // 6. Audit Logs
      csvSections.push("=== AUDIT LOGS ===");
      csvSections.push("Date,Edited By,Action,Table,Field,Old Value,New Value");
      for (const a of auditLogs) {
        csvSections.push(`${fmtDate(a.createdAt)},${esc(a.editedBy?.name || "System")},${a.action},${a.tableName},${esc(a.fieldName)},${esc(a.oldValue)},${esc(a.newValue)}`);
      }

      const filename = `${sanitizedMessName}_data_${timestamp}.csv`;
      return new NextResponse(csvSections.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid format requested" }, { status: 400 });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 });
  }
}
