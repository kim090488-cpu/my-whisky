import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const HIGH_SCORE = 85;
const VIEWER_MIN_HIGH_BOTTLINGS = 3;
const POOL_LIMIT = 20;
const MIN_INTERSECTION = 2;
const MAX_RESULTS = 3;

export type SimilarTaster = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  tastingId: string;
  tastingScore: number;
  commonBottlingCount: number;
};

export async function loadSimilarTastersForBottling(
  supabase: SupabaseClient<Database>,
  bottlingId: string,
  viewerId: string,
): Promise<SimilarTaster[]> {
  // viewer의 고평점 보틀링 (이 보틀링 제외)
  const viewerHighRes = await supabase
    .from("tastings")
    .select("bottling_id")
    .eq("user_id", viewerId)
    .eq("visibility", "public")
    .gte("score", HIGH_SCORE)
    .neq("bottling_id", bottlingId);
  const viewerHighSet = new Set<string>();
  for (const r of ((viewerHighRes.data ?? []) as { bottling_id: string | null }[])) {
    if (r.bottling_id) viewerHighSet.add(r.bottling_id);
  }
  if (viewerHighSet.size < VIEWER_MIN_HIGH_BOTTLINGS) return [];

  // 이 보틀링을 고평점한 유저 풀
  const poolRes = await supabase
    .from("tastings")
    .select("id, user_id, score, tasted_at")
    .eq("bottling_id", bottlingId)
    .eq("visibility", "public")
    .gte("score", HIGH_SCORE)
    .neq("user_id", viewerId)
    .order("score", { ascending: false, nullsFirst: false })
    .order("tasted_at", { ascending: false })
    .limit(POOL_LIMIT);

  type PoolRow = { id: string; user_id: string; score: number; tasted_at: string };
  const poolRows = (poolRes.data ?? []) as unknown as PoolRow[];
  if (poolRows.length === 0) return [];

  // 유저당 최고 tasting 1개만 (score desc 정렬됐으니 first-win)
  const byUser = new Map<string, PoolRow>();
  for (const r of poolRows) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, r);
  }
  const candidateIds = Array.from(byUser.keys());

  // 후보들의 고평점 보틀링 IDs 일괄 fetch
  const candHighRes = await supabase
    .from("tastings")
    .select("user_id, bottling_id")
    .in("user_id", candidateIds)
    .eq("visibility", "public")
    .gte("score", HIGH_SCORE);

  const highByUser = new Map<string, Set<string>>();
  for (const r of ((candHighRes.data ?? []) as { user_id: string; bottling_id: string | null }[])) {
    if (!r.bottling_id) continue;
    let set = highByUser.get(r.user_id);
    if (!set) {
      set = new Set<string>();
      highByUser.set(r.user_id, set);
    }
    set.add(r.bottling_id);
  }

  // 교집합 스코어링
  type Scored = {
    userId: string;
    tastingId: string;
    tastingScore: number;
    commonCount: number;
  };
  const scored: Scored[] = [];
  for (const [uid, top] of byUser) {
    const theirSet = highByUser.get(uid);
    if (!theirSet) continue;
    let common = 0;
    for (const b of theirSet) {
      if (b === bottlingId) continue;
      if (viewerHighSet.has(b)) common++;
    }
    if (common < MIN_INTERSECTION) continue;
    scored.push({
      userId: uid,
      tastingId: top.id,
      tastingScore: top.score,
      commonCount: common,
    });
  }
  if (scored.length === 0) return [];

  scored.sort(
    (a, b) => b.commonCount - a.commonCount || b.tastingScore - a.tastingScore,
  );
  const finalists = scored.slice(0, MAX_RESULTS);

  // 프로필 fetch
  const profilesRes = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in(
      "id",
      finalists.map((s) => s.userId),
    );
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

  const result: SimilarTaster[] = [];
  for (const s of finalists) {
    const p = profilesById.get(s.userId);
    if (!p) continue;
    result.push({
      userId: p.id,
      username: p.username,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      tastingId: s.tastingId,
      tastingScore: s.tastingScore,
      commonBottlingCount: s.commonCount,
    });
  }
  return result;
}
