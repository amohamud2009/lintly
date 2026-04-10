import { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { upsertUser } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: { params: { scope: "read:user user:email repo" } },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "github" && profile) {
        await upsertUser({
          github_id: String(profile.sub ?? account.providerAccountId),
          email: user.email ?? "",
          name: user.name ?? "",
          avatar_url: user.image ?? "",
        });
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
