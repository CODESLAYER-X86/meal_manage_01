import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: string;
    isAdmin: boolean;
    isOfficer: boolean;
    messId: string | null;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      isAdmin: boolean;
      isOfficer: boolean;
      messId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    isAdmin: boolean;
    isOfficer: boolean;
    messId: string | null;
  }
}
