import { NextResponse } from "next/server";

// BazarDuty model has been removed.
// Bazar trips are now tracked via BazarTrip with manager approval.
// This route is deprecated — returns empty data for backward compat.

export async function GET() {
  return NextResponse.json({ duties: [], members: [], yearlyStats: {}, deprecated: true });
}

export async function POST() {
  return NextResponse.json({ error: "Bazar duty replaced by bazar trip approval system. Use /api/bazar instead." }, { status: 410 });
}

export async function PATCH() {
  return NextResponse.json({ error: "Bazar duty replaced by bazar trip approval system. Use /api/bazar instead." }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({ error: "Bazar duty replaced by bazar trip approval system. Use /api/bazar instead." }, { status: 410 });
}
