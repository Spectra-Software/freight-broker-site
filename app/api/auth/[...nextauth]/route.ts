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

    // 🔑 JWT (source of truth for role)
    async jwt({ token, user }) {
      const email = token.email || user?.email;

      if (email) {
        const dbUser = await prisma.user.findUnique({
          where: { email },
        });

        token.role = dbUser?.role ?? "USER";
      }

      return token;
    },

    // 📦 SESSION (frontend sees this)
    async session({ session, token }) {
      if (session.user?.email) {
        const app = await prisma.application.findFirst({
          where: { email: session.user.email },
          orderBy: { createdAt: "desc" },
        });

        session.user = {
          ...session.user,
          role: (token.role as "USER" | "ADMIN") ?? "USER",
          status: app?.status ?? "NONE",
          allowed: app?.status === "APPROVED",
        };
      }

      return session;
    },
  },
});

export { handler as GET, handler as POST };