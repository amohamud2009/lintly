import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getFeatureLimit, type FeatureKey } from "@/lib/plans";

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

export async function getUser(githubId: string) {
  const { data, error } = await getSupabase()
    .from("users")
    .select("*")
    .eq("github_id", githubId)
    .single();

  if (error) throw error;
  return data;
}

export async function upsertUser(user: {
  github_id: string;
  email: string;
  name: string;
  avatar_url: string;
}) {
  const { data, error } = await getSupabase()
    .from("users")
    .upsert(user, { onConflict: "github_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getSubscription(userId: string) {
  // userId may be a GitHub ID (from session) — resolve to UUID first
  const { data: user } = await getSupabase()
    .from("users")
    .select("id")
    .eq("github_id", userId)
    .single();

  const lookupId = user?.id ?? userId;

  const { data, error } = await getSupabase()
    .from("subscriptions")
    .select("*")
    .eq("user_id", lookupId)
    .single();

  if (error) return null;
  return data;
}

export async function logReview(review: {
  user_id: string;
  repo: string;
  pr_number: number;
  status: string;
  comments_posted: number;
  score?: number;
  summary?: string;
  ai_comments?: unknown;
  pr_author?: string;
}) {
  const { data, error } = await getSupabase()
    .from("reviews")
    .insert(review)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export interface UserSettings {
  severity_threshold: "all" | "warning" | "critical";
  custom_instructions: string;
  ai_code_mode: boolean;
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const { data } = await getSupabase()
    .from("user_settings")
    .select("severity_threshold, custom_instructions, ai_code_mode")
    .eq("user_id", userId)
    .single();

  return {
    severity_threshold: data?.severity_threshold ?? "all",
    custom_instructions: data?.custom_instructions ?? "",
    ai_code_mode: data?.ai_code_mode ?? false,
  };
}

export async function updateUserSettings(
  userId: string,
  settings: Partial<UserSettings>
) {
  const { error } = await getSupabase()
    .from("user_settings")
    .upsert(
      { user_id: userId, ...settings, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  if (error) throw error;
}

const featureTableMap: Record<string, string> = {
  reviews: "reviews",
  securityScans: "security_scans",
};

export async function getMonthlyFeatureCount(userId: string, table: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count, error } = await getSupabase()
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  if (error) return 0;
  return count ?? 0;
}

async function getOrgPooledCount(orgId: string, table: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: members } = await getSupabase()
    .from("organization_members")
    .select("user_id, users(github_id)")
    .eq("org_id", orgId)
    .eq("invite_status", "accepted");

  if (!members || members.length === 0) return 0;

  const userIds = members.map((m) => {
    const user = m.users as unknown as { github_id: string } | null;
    return user?.github_id ?? m.user_id;
  }).filter(Boolean);

  let total = 0;
  for (const uid of userIds) {
    const { count } = await getSupabase()
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid)
      .gte("created_at", startOfMonth.toISOString());
    total += count ?? 0;
  }
  return total;
}

async function getOrgPooledChatCount(orgId: string): Promise<number> {
  const { data: members } = await getSupabase()
    .from("organization_members")
    .select("user_id, users(github_id, chat_messages_used)")
    .eq("org_id", orgId)
    .eq("invite_status", "accepted");

  if (!members || members.length === 0) return 0;

  return members.reduce((sum, m) => {
    const user = m.users as unknown as { chat_messages_used?: number } | null;
    return sum + (user?.chat_messages_used ?? 0);
  }, 0);
}

export async function canUseFeature(
  userId: string,
  feature: FeatureKey
): Promise<{ allowed: boolean; used: number; limit: number; plan: string }> {
  const sub = await getSubscription(userId);
  let plan = sub?.plan ?? "free";
  let billingInterval = sub?.billing_interval as string | undefined;
  let extraSeats = (sub?.extra_seats as number) ?? 0;
  let orgId: string | null = null;

  const uuid = await getUserUuid(userId);
  if (uuid) {
    const org = await getOrganizationForUser(uuid);
    if (org) {
      orgId = org.id;
      const { data: orgSub } = await getSupabase()
        .from("subscriptions")
        .select("plan, billing_interval, status, extra_seats")
        .eq("org_id", org.id)
        .single();

      if (orgSub && orgSub.status === "active") {
        plan = orgSub.plan;
        billingInterval = orgSub.billing_interval;
        extraSeats = orgSub.extra_seats ?? 0;
      }
    }
  }

  const totalSeats = plan === "team" ? 4 + extraSeats : undefined;
  const limit = getFeatureLimit(plan, feature, billingInterval, totalSeats);

  if (limit === Infinity && plan !== "free") {
    return { allowed: true, used: 0, limit: Infinity, plan };
  }

  if (limit === 0) {
    return { allowed: false, used: 0, limit: 0, plan };
  }

  if (feature === "chatMessages") {
    const used = orgId
      ? await getOrgPooledChatCount(orgId)
      : await (async () => {
          const { data } = await getSupabase()
            .from("users")
            .select("chat_messages_used")
            .eq("github_id", userId)
            .single();
          return data?.chat_messages_used ?? 0;
        })();
    return { allowed: used < limit, used, limit, plan };
  }

  const table = featureTableMap[feature];
  if (table) {
    const used = orgId
      ? await getOrgPooledCount(orgId, table)
      : await getMonthlyFeatureCount(userId, table);
    return { allowed: used < limit, used, limit, plan };
  }

  return { allowed: true, used: 0, limit, plan };
}

export async function canRunReview(
  userId: string
): Promise<{ allowed: boolean; used: number; limit: number; plan: string }> {
  return canUseFeature(userId, "reviews");
}

export async function logSecurityScan(scan: {
  user_id: string;
  repo: string;
  commit_sha?: string;
  branch?: string;
  issues_found: number;
  scan_results: unknown;
}) {
  const { error } = await getSupabase().from("security_scans").insert(scan);
  if (error) throw error;
}

export async function incrementChatMessages(githubId: string) {
  await getSupabase().rpc("increment_chat_messages", { gid: githubId });
}

// ── Organization helpers ──

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  invited_email: string | null;
  invite_token: string | null;
  invite_status: "pending" | "accepted";
  created_at: string;
  user?: { name: string; email: string; avatar_url: string; github_id: string };
}

export async function createOrganization(
  name: string,
  slug: string,
  ownerUuid: string
): Promise<Organization> {
  const sb = getSupabase();
  const { data: org, error } = await sb
    .from("organizations")
    .insert({ name, slug, owner_id: ownerUuid })
    .select()
    .single();
  if (error) throw error;

  await sb.from("organization_members").insert({
    org_id: org.id,
    user_id: ownerUuid,
    role: "owner",
    invite_status: "accepted",
  });

  return org;
}

export async function getOrganizationForUser(userUuid: string): Promise<Organization | null> {
  const { data } = await getSupabase()
    .from("organization_members")
    .select("org_id, organizations(*)")
    .eq("user_id", userUuid)
    .eq("invite_status", "accepted")
    .limit(1)
    .single();

  if (!data) return null;
  return (data as Record<string, unknown>).organizations as Organization;
}

export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data } = await getSupabase()
    .from("organization_members")
    .select("*, users(name, email, avatar_url, github_id)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  return ((data ?? []) as unknown as (OrgMember & { users: OrgMember["user"] })[]).map((m) => ({
    ...m,
    user: m.users ?? undefined,
  }));
}

export async function getOrgMemberRole(orgId: string, userUuid: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userUuid)
    .eq("invite_status", "accepted")
    .single();
  return data?.role ?? null;
}

export async function getUserUuid(githubId: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from("users")
    .select("id")
    .eq("github_id", githubId)
    .single();
  return data?.id ?? null;
}
