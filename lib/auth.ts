import { NextAuthOptions } from "next-auth";
import { upsertUser } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "github",
      name: "GitHub",
      type: "oauth",
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        url: "https://github.com/login/oauth/authorize",
        params: { scope: "read:user user:email repo" },
      },
      token: {
        url: "https://github.com/login/oauth/access_token",
        async request({ params }: { params: Record<string, unknown> }) {
          const res = await fetch(
            "https://github.com/login/oauth/access_token",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code: params.code,
              }),
            }
          );
          const tokens = await res.json();
          if (tokens.error) {
            throw new Error(
              `GitHub token error: ${tokens.error_description || tokens.error}`
            );
          }
          return { tokens };
        },
      },
      userinfo: {
        url: "https://api.github.com/user",
        async request({ tokens }: { tokens: { access_token?: string } }) {
          const res = await fetch("https://api.github.com/user", {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              "User-Agent": "next-auth",
            },
          });
          if (!res.ok) {
            throw new Error(`GitHub userinfo failed: ${res.status}`);
          }
          return await res.json();
        },
      },
      profile(profile: {
        id: number;
        login: string;
        name: string | null;
        email: string | null;
        avatar_url: string;
      }) {
        return {
          id: String(profile.id),
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
        };
      },
      checks: ["state"],
    },
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.id || user.id === "undefined") return false;

      if (account?.provider === "github" && profile) {
        const ghProfile = profile as { id?: number; sub?: string };
        await upsertUser({
          github_id: String(
            ghProfile.id ?? ghProfile.sub ?? account.providerAccountId
          ),
          email: user.email ?? "",
          name: user.name ?? "",
          avatar_url: user.image ?? "",
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.sub;
        session.user.image = token.picture as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
