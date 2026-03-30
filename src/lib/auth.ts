import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcryptjs from "bcryptjs";
import crypto from "crypto";
import prisma from "@/lib/prisma";

// Helper: check if an email is in the PLATFORM_ADMIN_EMAIL list (comma-separated)
export function isAllowedAdminEmail(email: string): boolean {
  const envVal = process.env.PLATFORM_ADMIN_EMAIL;
  if (!envVal) return false;
  const allowed = envVal.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.toLowerCase().trim());
}

// Custom error so NextAuth v5 surfaces it to the client as error.code
class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: (credentials.email as string).toLowerCase().trim() },
        });

        if (!user || !user.isActive) {
          console.warn(`[SECURITY] Failed login: ${credentials.email} (user not found or inactive)`);
          return null;
        }

        // Block login if email not verified
        if (!user.emailVerified) {
          throw new EmailNotVerifiedError();
        }

        const passwordMatch = await bcryptjs.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) {
          console.warn(`[SECURITY] Failed login: ${credentials.email} (wrong password)`);
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isAdmin: user.isAdmin,
          isOfficer: user.isOfficer,
          messId: user.messId,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        
        const email = user.email.toLowerCase().trim();
        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          if (!existingUser.isActive) {
            console.warn(`[SECURITY] Failed Google login: ${email} (inactive account)`);
            return false;
          }
        } else {
          // Auto-provision Google user
          const randomPassword = await bcryptjs.hash(crypto.randomBytes(16).toString("hex"), 10);
          await prisma.user.create({
            data: {
              name: user.name || "Google User",
              email,
              password: randomPassword,
              role: "MEMBER",
              isAdmin: false,
              isOfficer: false,
              isActive: true,
              emailVerified: true, // Auto verify since it came from Google
            },
          });
        }
        return true;
      }
      return true; // allow credentials or other signIn to pass through
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        // Find user again for Google login intercept to get correct role/id
        let dbUser = user;
        if (!dbUser.id || !dbUser.role) {
           const fetched = await prisma.user.findUnique({ where: { email: user.email!.toLowerCase() } });
           if (fetched) dbUser = fetched as any;
        }
        token.id = dbUser.id;
        token.role = (dbUser as { role: string }).role;
        token.isAdmin = (dbUser as { isAdmin: boolean }).isAdmin;
        token.isOfficer = (dbUser as { isOfficer?: boolean }).isOfficer ?? false;
        token.messId = (dbUser as { messId: string | null }).messId;
        token.lastRefresh = Date.now();
      }
      
      // Handle manual session update — validate messId against DB before accepting
      // SECURITY: Never allow role/isAdmin/isOfficer updates from client
      if (trigger === "update" && session !== null) {
        const requestedMessId = session.user?.messId;
        if (requestedMessId && requestedMessId !== token.messId) {
          // Validate that this mess actually exists and user belongs to it
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { messId: true },
          });
          token.messId = dbUser?.messId ?? null;
        }
      }

      // Refresh role/messId from DB frequently to prevent stale data
      // (e.g. after mess deletion, kick, or role change by admin)
      const REFRESH_INTERVAL = 30 * 1000; // 30 seconds
      const now = Date.now();
      if (token.id && (!token.lastRefresh || now - (token.lastRefresh as number) >= REFRESH_INTERVAL)) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, isAdmin: true, isOfficer: true, messId: true, email: true },
          });
          if (dbUser) {
            token.role = dbUser.role;
            const shouldBeAdmin = isAllowedAdminEmail(dbUser.email);
            
            // Auto-promote: email is in env var but DB doesn't have isAdmin yet
            if (shouldBeAdmin && !dbUser.isAdmin) {
              await prisma.user.update({
                where: { id: token.id as string },
                data: { isAdmin: true },
              });
              token.isAdmin = true;
            }
            // Auto-revoke: DB has isAdmin but email no longer in env var
            else if (!shouldBeAdmin && dbUser.isAdmin) {
              await prisma.user.update({
                where: { id: token.id as string },
                data: { isAdmin: false },
              });
              token.isAdmin = false;
            }
            else {
              token.isAdmin = dbUser.isAdmin;
            }
            
            token.isOfficer = dbUser.isOfficer;
            token.messId = dbUser.messId;
          }
          token.lastRefresh = now;
        } catch {
          // If DB is unreachable, keep existing values
        }
      }

      // STRICT ENFORCEMENT: Never return isAdmin=true if email is not allowed,
      // regardless of DB state or refresh timing. This ensures immediate revocation
      // if an email is removed from the PLATFORM_ADMIN_EMAIL env variable.
      if (token.isAdmin) {
        const tokenEmail = (token.email as string) || (session?.user?.email as string) || "";
        if (!isAllowedAdminEmail(tokenEmail)) {
           token.isAdmin = false;
        }
      }
      // Also strictly auto-promote on login if email *is* allowed and token doesn't have it yet
      else {
        const tokenEmail = (token.email as string) || (session?.user?.email as string) || "";
        if (isAllowedAdminEmail(tokenEmail)) {
           token.isAdmin = true;
           // We don't necessarily update DB here to save a write, the 5-min refresh will catch it later
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role: string }).role = token.role as string;
        (session.user as { isAdmin: boolean }).isAdmin = token.isAdmin as boolean;
        (session.user as unknown as { isOfficer: boolean }).isOfficer = token.isOfficer as boolean;
        (session.user as { messId: string | null }).messId = token.messId as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
