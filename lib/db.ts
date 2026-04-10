import { createClient, SupabaseClient } from "@supabase/supabase-js";

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
  const { data, error } = await getSupabase()
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
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
}) {
  const { data, error } = await getSupabase()
    .from("reviews")
    .insert(review)
    .select()
    .single();

  if (error) throw error;
  return data;
}
