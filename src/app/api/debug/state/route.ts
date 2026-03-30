import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Temporary diagnostic — DELETE after use
export async function GET() {
  const messes = await prisma.mess.findMany({
    include: {
      members: { select: { id: true, name: true, email: true, role: true, messId: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, messId: true, isActive: true },
  });

  const joinRequests = await prisma.joinRequest.findMany({
    select: { id: true, userId: true, messId: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ 
    messCount: messes.length,
    messes: messes.map(m => ({
      id: m.id,
      name: m.name,
      inviteCode: m.inviteCode,
      createdBy: m.createdBy,
      memberCount: m.members.length,
      members: m.members.map(u => ({
        id: u.id.slice(0, 12) + "...",
        name: u.name,
        email: u.email,
        role: u.role,
        messIdMatch: u.messId === m.id,
      })),
    })),
    userCount: users.length,
    users: users.map(u => ({
      id: u.id.slice(0, 12) + "...",
      name: u.name,
      email: u.email,
      role: u.role,
      messId: u.messId ? u.messId.slice(0, 12) + "..." : null,
      isActive: u.isActive,
    })),
    recentJoinRequests: joinRequests.map(jr => ({
      id: jr.id.slice(0, 12) + "...",
      userId: jr.userId.slice(0, 12) + "...",
      messId: jr.messId.slice(0, 12) + "...",
      status: jr.status,
    })),
  });
}
