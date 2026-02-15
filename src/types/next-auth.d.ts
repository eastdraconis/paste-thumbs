import type { DefaultSession, DefaultUser } from "next-auth";
import type { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user?: {
      id?: string;
      provider?: string;
      providerAccountId?: string;
      shareToken?: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    provider?: string;
    providerAccountId?: string;
    shareToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    provider?: string;
    providerAccountId?: string;
    shareToken?: string;
  }
}
