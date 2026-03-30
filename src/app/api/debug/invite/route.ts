import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Public diagnostic endpoint — no auth required
// GET /api/debug/invite?code=MESS-XXXXXXXX
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim().toUpperCase();

  try {
    // Test basic DB connectivity
    const messCount = await prisma.mess.count();

    if (!code) {
      // Just test DB connectivity
      const messes = await prisma.mess.findMany({
        select: { inviteCode: true, name: true, id: true },
      });
      return NextResponse.json({
        status: "db_connected",
        messCount,
        messes: messes.map((m) => ({
          id: m.id.slice(0, 8) + "...",
          name: m.name,
          inviteCode: m.inviteCode,
        })),
      });
    }

    // Test specific invite code lookup
    const byUnique = await prisma.mess.findUnique({
      where: { inviteCode: code },
      select: { id: true, name: true, inviteCode: true },
    });

    const byFirst = await prisma.mess.findFirst({
      where: { inviteCode: code },
      select: { id: true, name: true, inviteCode: true },
    });

    return NextResponse.json({
      status: "db_connected",
      searchedCode: code,
      findUnique: byUnique ? { name: byUnique.name, code: byUnique.inviteCode } : null,
      findFirst: byFirst ? { name: byFirst.name, code: byFirst.inviteCode } : null,
      messCount,
    });
  } catch (error: unknown) {
    return NextResponse.json({
      status: "db_error",
      error: (error as Error).message,
      stack: (error as Error).stack?.split("\n").slice(0, 5),
    }, { status: 500 });
  }
}
