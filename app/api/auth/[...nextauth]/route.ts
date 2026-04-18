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

          // IMPORTANT: ensures refresh_token is returned consistently
          access_type: "offline",
          response_type: "code",

          // 🔥 FULL GMAIL ACCESS SCOPES
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
    // USER CREATION / SYNC
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
    // JWT CALLBACK (CORE GMAIL LOGIC)
    // ==============================
    async jwt({ token, account, user }) {
      // 🔥 FIRST LOGIN ONLY (store Google tokens)
      if (account) {
        token.accessToken = account.access_token;

        // IMPORTANT: only exists sometimes (Google limitation)
        token.refreshToken = account.refresh_token ?? token.refreshToken;

        token.provider = account.provider;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : null;
      }

      // ensure email exists
      if (!token.email && user?.email) {
        token.email = user.email;
      }

      // ==============================
      // LOAD USER FROM DATABASE
      // ==============================
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

      // ==============================
      // OPTIONAL: TOKEN EXPIRY CHECK
      // ==============================
      if (
        token.accessTokenExpires &&
        Date.now() > (token.accessTokenExpires as number)
      ) {
        // token expired (we’ll handle refresh later in Step 3)
        token.accessTokenExpired = true;
      }

      return token;
    },

    // ==============================
    // SESSION CALLBACK (FRONTEND ACCESS)
    // ==============================
    async session({ session, token }) {
      if (!session.user) return session;

      // latest application status
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

      // 🔥 expose Gmail tokens for API routes
      (session as any).accessToken = token.accessToken;
      (session as any).refreshToken = token.refreshToken;
      (session as any).accessTokenExpires = token.accessTokenExpires;

      return session;
    },
  },
});

export { handler as GET, handler as POST };