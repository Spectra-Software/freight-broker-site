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
      prompt: "select_account consent",
      access_type: "offline",
      response_type: "code",
    },
  },
}),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    // ✅ Create user if not exists
    async signIn({ user }) {
      if (!user.email) return false;

      await prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: {
          email: user.email,
          role: "USER", // default role
        },
      });

      return true;
    },

    // ✅ Attach role + id to token
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

    // ✅ Attach role + approval status to session
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

      return session;
    },
  },
});

export { handler as GET, handler as POST };