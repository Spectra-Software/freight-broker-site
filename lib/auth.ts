import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

type TokenShape = {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpires?: number;
  email?: string;
  error?: string;
};

async function persistTokensToDb(email: string, token: TokenShape) {
  if (!token.accessToken) return;

  try {
    await prisma.user.update({
      where: { email },
      data: {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken ?? null,
        tokenExpiry: token.accessTokenExpires
          ? new Date(token.accessTokenExpires)
          : null,
      },
    });
  } catch (err) {
    console.error("DB SYNC FAILED (check Prisma schema fields):", err);
  }
}

async function refreshAccessToken(token: TokenShape) {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken ?? "",
      }),
    });

    const data = await res.json();
    if (!res.ok) throw data;

    const updatedToken: TokenShape = {
      ...token,
      accessToken: data.access_token,
      accessTokenExpires: Date.now() + (data.expires_in ?? 3600) * 1000,
      refreshToken: data.refresh_token ?? token.refreshToken,
    };

    if (token.email) {
      await persistTokensToDb(token.email, updatedToken);
    }

    return updatedToken;
  } catch (error) {
    console.error("TOKEN REFRESH ERROR:", error);

    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent select_account",
          access_type: "offline",
          response_type: "code",
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.modify",
          ].join(" "),
        },
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "jwt",
    maxAge: 60 * 60,
  },

  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      await prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: {
          email: user.email,
          role: "USER",
        },
      });

      return true;
    },

    async jwt({ token, account, user }) {
      const currentToken = token as TokenShape;

      if (account) {
        const updatedToken: TokenShape = {
          ...currentToken,
          accessToken: account.access_token ?? undefined,
          refreshToken: account.refresh_token ?? currentToken.refreshToken,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000,
          email: user?.email ?? currentToken.email,
        };

        if (updatedToken.email) {
          await persistTokensToDb(updatedToken.email, updatedToken);
        }

        return updatedToken as any;
      }

      if (
        currentToken.accessTokenExpires &&
        Date.now() < currentToken.accessTokenExpires
      ) {
        return currentToken as any;
      }

      return (await refreshAccessToken(currentToken)) as any;
    },

    async session({ session, token }) {
      if (!session.user) return session;

      const app = await prisma.application.findFirst({
        where: { email: session.user.email! },
        orderBy: { createdAt: "desc" },
      });

      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email! },
      });

      session.user = {
        ...session.user,
        role: (dbUser?.role as "USER" | "ADMIN") ?? "USER",
        allowed: dbUser?.role === "ADMIN" ? true : app?.status === "APPROVED",
        status: app?.status ?? "NONE",
        id: dbUser?.id as string,
      };

      (session as any).accessToken = (token as TokenShape).accessToken;
      (session as any).refreshToken = (token as TokenShape).refreshToken;

      return session;
    },
  },
};