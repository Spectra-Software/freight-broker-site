import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

// 🔥 Refresh Google access token
async function refreshAccessToken(token: any) {
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
        refresh_token: token.refreshToken,
      }),
    });

    const data = await res.json();

    if (!res.ok) throw data;

    return {
      ...token,
      accessToken: data.access_token,
      accessTokenExpires: Date.now() + data.expires_in * 1000,
      refreshToken: data.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error("TOKEN REFRESH ERROR", error);
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

          // 🔥 REQUIRED FOR GMAIL
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
    // ==============================
    // USER SYNC
    // ==============================
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

    // ==============================
    // 🔥 JWT (STORE + REFRESH TOKENS)
    // ==============================
    async jwt({ token, account, user }) {
      // FIRST LOGIN
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : undefined,
          email: user?.email ?? token.email,
        };
      }

      // STILL VALID
      if (
        token.accessTokenExpires &&
        Date.now() < token.accessTokenExpires
      ) {
        return token;
      }

      // 🔥 EXPIRED → REFRESH
      return await refreshAccessToken(token);
    },

    // ==============================
    // SESSION (EXPOSE TOKENS)
    // ==============================
    async session({ session, token }) {
      if (!session.user) return session;

      const app = await prisma.application.findFirst({
        where: { email: session.user.email! },
        orderBy: { createdAt: "desc" },
      });

      session.user = {
        ...session.user,
        role: (token.role as "USER" | "ADMIN") ?? "USER",
        allowed:
          token.role === "ADMIN"
            ? true
            : app?.status === "APPROVED",
        status: app?.status ?? "NONE",
        id: token.id as string,
      };

      // 🔥 MAKE AVAILABLE TO API ROUTES
      (session as any).accessToken = token.accessToken;
      (session as any).refreshToken = token.refreshToken;

      return session;
    },
  },
};