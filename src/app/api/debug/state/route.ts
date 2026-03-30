import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Temporary diagnostic — DELETE after use
export async function GET() {
  const messes = await prisma.mess.findMany({
    select: { id: true, name: true, inviteCode: true, createdAt: true },
  });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, messId: true },
  });

  return NextResponse.json({ 
    messCount: messes.length, 
    messes, 
    userCount: users.length,
    users: users.map(u => ({
      ...u,
      id: u.id.slice(0, 10) + "...",
      messId: u.messId ? u.messId.slice(0, 10) + "..." : null,
    })),
  });
}
