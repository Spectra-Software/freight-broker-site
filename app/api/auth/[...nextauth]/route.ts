import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    // 🔐 CREATE USER ON FIRST LOGIN
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

    // 🔑 JWT — SINGLE SOURCE OF TRUTH FOR ROLE
    async jwt({ token }) {
      if (!token.email) return token;

      const dbUser = await prisma.user.findUnique({
        where: { email: token.email },
      });

      if (dbUser) {
        token.role = dbUser.role;
        token.id = dbUser.id;
      } else {
        token.role = "USER";
      }

      return token;
    },

    // 📦 SESSION — WHAT FRONTEND USES
    async session({ session, token }) {
      if (!session.user) return session;

      const app = await prisma.application.findFirst({
        where: { email: session.user.email! },
        orderBy: { createdAt: "desc" },
      });

      session.user = {
        ...session.user,

        // 🔐 secure role from DB via JWT
        role: token.role as "USER" | "ADMIN",

        // 🧾 application info
        status: app?.status ?? "NONE",
        allowed: app?.status === "APPROVED",

        // optional but useful
        id: token.id as string,
      };

      return session;
    },
  },
});

export { handler as GET, handler as POST };