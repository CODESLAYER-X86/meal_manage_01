import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcryptjs from "bcryptjs";
import prisma from "@/lib/prisma";

// Custom error so NextAuth v5 surfaces it to the client as error.code
class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
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
          messId: user.messId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.isAdmin = (user as { isAdmin: boolean }).isAdmin;
        token.messId = (user as { messId: string | null }).messId;
        token.lastRefresh = Date.now();
      }
      // Refresh role/messId from DB every 5 minutes (not every request)
      const REFRESH_INTERVAL = 5 * 60 * 1000;
      const now = Date.now();
      if (token.id && (!token.lastRefresh || now - (token.lastRefresh as number) >= REFRESH_INTERVAL)) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, isAdmin: true, messId: true },
          });
          if (dbUser) {
            token.role = dbUser.role;
            token.isAdmin = dbUser.isAdmin;
            token.messId = dbUser.messId;
          }
          token.lastRefresh = now;
        } catch {
          // If DB is unreachable, keep existing values
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role: string }).role = token.role as string;
        (session.user as { isAdmin: boolean }).isAdmin = token.isAdmin as boolean;
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
