import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

// POST /api/auth/resend-verification
// Body: { email }
export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();
        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        // Security: always return generic message — don't reveal if email exists
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.emailVerified) {
            return NextResponse.json({
                message: "If that email is registered and unverified, we sent a new link.",
            });
        }

        // Rate limit: delete any existing unused tokens first (max 1 active at a time)
        await prisma.verificationToken.deleteMany({
            where: { userId: user.id, type: "EMAIL_VERIFY", used: false },
        });

        // Create new token (24h)
        const token = crypto.randomBytes(32).toString("hex");
        await prisma.verificationToken.create({
            data: {
                token,
                userId: user.id,
                type: "EMAIL_VERIFY",
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });

        await sendVerificationEmail(user.email, user.name, token);

        return NextResponse.json({
            message: "If that email is registered and unverified, we sent a new link.",
        });
    } catch (error) {
        console.error("Resend verification error:", error);
        return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }
}
