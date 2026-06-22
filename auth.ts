import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users, accounts, sessions, verificationTokens,
} from "@/lib/db/schema";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable:              users,
    accountsTable:           accounts,
    sessionsTable:           sessions,
    verificationTokensTable: verificationTokens,
  }),

  providers: [
    Credentials({
      credentials: {
        email:    { label: "Email",         type: "email" },
        password: { label: "Mot de passe",  type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
          .limit(1);

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        );
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name ?? "", role: user.role ?? "contact" };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub  = user.id;
        token.role = (user as { role?: string }).role ?? "contact";
      } else if (token.sub && !token.role) {
        // Session existante sans role (créée avant la migration) — lecture DB unique
        const [dbUser] = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, token.sub))
          .limit(1);
        token.role = dbUser?.role ?? "contact";
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.role = (token.role ?? "contact") as "admin" | "user" | "contact";
      return session;
    },
  },
});
