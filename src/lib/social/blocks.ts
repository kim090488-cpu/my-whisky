import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadBlockedUserIds(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", userId);
  return new Set(
    ((data ?? []) as Array<{ blocked_id: string }>).map((r) => r.blocked_id),
  );
}

export async function isBlockedByViewer(
  supabase: SupabaseClient,
  viewerId: string | null | undefined,
  targetId: string,
): Promise<boolean> {
  if (!viewerId) return false;
  const { data } = await supabase
    .from("user_blocks")
    .select("id")
    .eq("blocker_id", viewerId)
    .eq("blocked_id", targetId)
    .maybeSingle();
  return !!data;
}
