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

  secret: process.env.NEXTAUTH_SECRET,

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

    async jwt({ token }) {
      if (!token.email) return token;

      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
        });

        if (dbUser) {
          token.role = dbUser.role;
          token.id = dbUser.id;
        } else {
          token.role = "USER";
        }
      } catch (err) {
        console.error("JWT error:", err);
      }

      return token;
    },

    async session({ session, token }) {
      if (!session.user) return session;

      try {
        const app = await prisma.application.findFirst({
          where: { email: session.user.email! },
          orderBy: { createdAt: "desc" },
        });

        session.user = {
          ...session.user,
          role: token.role as "USER" | "ADMIN",
          status: app?.status ?? "NONE",
          allowed: app?.status === "APPROVED",
          id: token.id as string,
        };
      } catch (err) {
        console.error("SESSION error:", err);
      }

      return session;
    },
  },
});

export { handler as GET, handler as POST };