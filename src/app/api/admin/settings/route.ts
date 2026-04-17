import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

// Helper: check if session user is admin or officer
function hasAdminAccess(session: Session | null): boolean {
  return !!(session?.user?.isAdmin || session?.user?.isOfficer);
}

// GET — Fetch all platform settings
export async function GET() {
  const session = await auth();
  if (!session?.user || !hasAdminAccess(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const settings = await prisma.adminSetting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }

  return NextResponse.json({
    cleanup_enabled: map["cleanup_enabled"] ?? "true",
    cleanup_months: map["cleanup_months"] ?? "2",
  });
}

// PATCH — Update a platform setting (admin only — not officers)
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !session.user.isAdmin) {
    return NextResponse.json({ error: "Only Platform Admins can change settings." }, { status: 403 });
  }

  const body = await request.json();
  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  }

  const allowedKeys = ["cleanup_enabled", "cleanup_months"];
  if (!allowedKeys.includes(key)) {
    return NextResponse.json({ error: `Invalid setting key. Allowed: ${allowedKeys.join(", ")}` }, { status: 400 });
  }

  // Validate values
  if (key === "cleanup_enabled" && !["true", "false"].includes(value)) {
    return NextResponse.json({ error: "cleanup_enabled must be 'true' or 'false'" }, { status: 400 });
  }
  if (key === "cleanup_months") {
    const months = Number(value);
    if (isNaN(months) || months < 1 || months > 24) {
      return NextResponse.json({ error: "cleanup_months must be between 1 and 24" }, { status: 400 });
    }
  }

  await prisma.adminSetting.upsert({
    where: { key },
    update: { value: String(value) },
    create: { key, value: String(value) },
  });

  return NextResponse.json({ success: true, key, value: String(value) });
}
