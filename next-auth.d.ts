import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;

      role: "USER" | "ADMIN";
      status: "PENDING" | "APPROVED" | "DENIED" | "NONE";
      allowed: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email?: string;
    role: "USER" | "ADMIN";
	accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
  }
}