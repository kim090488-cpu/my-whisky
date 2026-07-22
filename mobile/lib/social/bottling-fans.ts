import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { loadTasteProfile, type TasteTag } from "@/lib/tastings/taste-profile";

const HIGH_SCORE = 85;
const POOL_LIMIT = 20;
const MAX_RESULTS = 4;

export type BottlingFan = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  tastingId: string;
  tastingScore: number;
  tags: TasteTag[];
};

export type BottlingFansOptions = {
  excludeUserId?: string | null;
};

/** 이 bottling을 고득점(85+)한 공개 유저 상위 몇 명 + 각 유저의 taste 태그. */
export async function loadBottlingFans(
  supabase: SupabaseClient<Database>,
  bottlingId: string,
  opts: BottlingFansOptions = {},
): Promise<BottlingFan[]> {
  const poolRes = await supabase
    .from("tastings")
    .select("id, user_id, score, tasted_at")
    .eq("bottling_id", bottlingId)
    .eq("visibility", "public")
    .gte("score", HIGH_SCORE)
    .order("score", { ascending: false, nullsFirst: false })
    .order("tasted_at", { ascending: false })
    .limit(POOL_LIMIT);

  type PoolRow = { id: string; user_id: string; score: number; tasted_at: string };
  const poolRows = (poolRes.data ?? []) as unknown as PoolRow[];
  if (poolRows.length === 0) return [];

  const excludeId = opts.excludeUserId ?? null;
  const byUser = new Map<string, PoolRow>();
  for (const r of poolRows) {
    if (excludeId && r.user_id === excludeId) continue;
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, r);
    if (byUser.size >= MAX_RESULTS) break;
  }
  if (byUser.size === 0) return [];

  const finalists = Array.from(byUser.values());
  const finalistIds = finalists.map((f) => f.user_id);

  const [profilesRes, tagsPerUser] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", finalistIds),
    Promise.all(
      finalistIds.map((uid) =>
        loadTasteProfile(supabase, uid, { publicOnly: true }).then((p) => p.tags),
      ),
    ),
  ]);

  type Profile = {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  const profilesById = new Map<string, Profile>();
  for (const p of ((profilesRes.data ?? []) as Profile[])) {
    profilesById.set(p.id, p);
  }

  const result: BottlingFan[] = [];
  for (let i = 0; i < finalists.length; i++) {
    const f = finalists[i];
    const p = profilesById.get(f.user_id);
    if (!p) continue;
    result.push({
      userId: p.id,
      username: p.username,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      tastingId: f.id,
      tastingScore: f.score,
      tags: tagsPerUser[i],
    });
  }
  return result;
}
