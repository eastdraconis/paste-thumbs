import { createHash } from "crypto";
import type { NextAuthOptions, Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function buildProviders() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return [];
  }

  return [
    GoogleProvider({
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
    }),
  ];
}

export function ownerShareToken(email?: string): string {
  const seed = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "paste-thumbs-share-secret";
  const normalizedEmail = (email || "").toLowerCase().trim();
  return createHash("sha256").update(`${normalizedEmail}:${seed}`).digest("hex").slice(0, 24);
}

export const authOptions: NextAuthOptions = {
  providers: buildProviders(),
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;
      }

      const email =
        token.email ||
        (profile && typeof profile === "object" && typeof (profile as { email?: string }).email === "string"
          ? (profile as { email?: string }).email
          : undefined);

      if (!token.sub && email) {
        token.sub = email;
      }

      token.shareToken = ownerShareToken(email);
      return token as JWT & { provider?: string; providerAccountId?: string; shareToken?: string };
    },
    async session({ session, token }) {
      const user = session.user as (User & { provider?: string; providerAccountId?: string; shareToken?: string }) | undefined;

      if (user) {
        session.user = {
          ...user,
          id: token.sub || user.id,
          provider: token.provider as string | undefined,
          providerAccountId: token.providerAccountId as string | undefined,
          shareToken: token.shareToken as string | undefined,
        };
      }

      return session as Session;
    },
  },
};
