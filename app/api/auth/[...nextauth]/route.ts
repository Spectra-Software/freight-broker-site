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
      const email = user.email;
      if (!email) return false;

      await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          role: "USER",
        },
      });

      return true;
    },

    // 🔑 JWT (THIS IS REQUIRED FOR ROLE TO PERSIST)
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        token.role = dbUser?.role ?? "USER";
      }

      return token;
    },

    // 📦 SESSION (WHAT YOUR FRONTEND USES)
    async session({ session, token }) {
      const email = session.user?.email;

      if (!email) return session;

      // get latest application
      const app = await prisma.application.findFirst({
        where: { email },
        orderBy: { createdAt: "desc" },
      });

      return {
        ...session,
        user: {
          ...session.user,

          // 🔐 admin role
          role: token.role as string,

          // 📄 application status
          status: app?.status ?? "NONE",

          // ✅ approved access flag
          allowed: app?.status === "APPROVED",
        },
      };
    },
  },
});

export { handler as GET, handler as POST };