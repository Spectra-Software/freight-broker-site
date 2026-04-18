import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

const handler = NextAuth({
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
    // ==============================
    // SIGN IN
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
    // JWT CALLBACK
    // ==============================
    async jwt({ token, account, user }) {
      // 🔥 FIRST LOGIN ONLY
      if (account) {
  token.accessToken = account.access_token;
  token.refreshToken = account.refresh_token ?? token.refreshToken;
  token.accessTokenExpires = account.expires_at
    ? account.expires_at * 1000
    : undefined;

  // 🔥 SAFE DB WRITE (WON’T BREAK LOGIN)
  try {
    if (token.email) {
      await prisma.user.update({
        where: { email: token.email },
        data: {
          accessToken: token.accessToken,
          refreshToken: token.refreshToken || undefined,
          tokenExpiry: token.accessTokenExpires
            ? new Date(token.accessTokenExpires)
            : null,
        },
      });
    }
  } catch (err) {
    console.error("TOKEN SAVE ERROR:", err);
  }
}

      // ensure email exists
      if (!token.email && user?.email) {
        token.email = user.email;
      }

      // load DB user
      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
        });

        if (dbUser) {
          token.role = dbUser.role;
          token.id = dbUser.id;
        } else {
          token.role = "USER";
        }
      }

      return token;
    },

    // ==============================
    // SESSION
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

      // 🔥 expose tokens
      (session as any).accessToken = token.accessToken;
      (session as any).refreshToken = token.refreshToken;
      (session as any).accessTokenExpires = token.accessTokenExpires;

      return session;
    },
  },
});

export { handler as GET, handler as POST };