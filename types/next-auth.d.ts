import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      role: "admin" | "user" | "contact";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
  }
}
