import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

// POST /api/auth/forgot-password
// Body: { email }
export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();
        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        // Security: always return generic message — never reveal if email exists
        const genericResponse = NextResponse.json({
            message: "If an account with that email exists, we've sent a reset link.",
        });

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) return genericResponse;

        // Delete any existing password reset tokens for this user (max 1 active)
        await prisma.verificationToken.deleteMany({
            where: { userId: user.id, type: "PASSWORD_RESET", used: false },
        });

        // Create reset token (1 hour)
        const token = crypto.randomBytes(32).toString("hex");
        await prisma.verificationToken.create({
            data: {
                token,
                userId: user.id,
                type: "PASSWORD_RESET",
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            },
        });

        await sendPasswordResetEmail(user.email, user.name, token);

        return genericResponse;
    } catch (error) {
        console.error("Forgot password error:", error);
        // Still return generic to not leak info
        return NextResponse.json({
            message: "If an account with that email exists, we've sent a reset link.",
        });
    }
}
