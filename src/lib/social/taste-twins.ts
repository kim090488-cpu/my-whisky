import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const HIGH_SCORE = 85;
const MIN_ANCHOR_SIZE = 3;
const MIN_INTERSECTION = 2;
const MAX_RESULTS = 3;
const PREVIEW_BOTTLINGS = 2;

export type TasteTwinPreviewBottling = {
  id: string;
  name: string;
  nameKr: string | null;
};

export type TasteTwin = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  commonBottlingCount: number;
  previewBottlings: TasteTwinPreviewBottling[];
};

export type TasteTwinsOptions = {
  viewerId?: string | null;
  excludeIds?: string[];
};

// 프로필 주인이 85+로 평가한 보틀링과 실제로 겹치는 유저 순위.
// loadFollowRecommendations 의 taste-tag 기반과 달리 concrete bottling intersection.
export async function loadTasteTwins(
  supabase: SupabaseClient<Database>,
  userId: string,
  opts: TasteTwinsOptions = {},
): Promise<TasteTwin[]> {
  // 앵커: 프로필 주인의 85+ 보틀링
  const anchorRes = await supabase
    .from("tastings")
    .select("bottling_id")
    .eq("user_id", userId)
    .eq("visibility", "public")
    .gte("score", HIGH_SCORE)
    .not("bottling_id", "is", null);
  const anchorIds = Array.from(
    new Set(
      ((anchorRes.data ?? []) as { bottling_id: string | null }[])
        .map((r) => r.bottling_id)
        .filter((v): v is string => !!v),
    ),
  );
  if (anchorIds.length < MIN_ANCHOR_SIZE) return [];

  // 이 보틀링들을 85+로 평가한 다른 유저들
  const excludeSet = new Set<string>([userId, ...(opts.excludeIds ?? [])]);
  if (opts.viewerId) excludeSet.add(opts.viewerId);

  const overlapsRes = await supabase
    .from("tastings")
    .select("user_id, bottling_id")
    .in("bottling_id", anchorIds)
    .eq("visibility", "public")
    .gte("score", HIGH_SCORE);

  // 유저별로 유니크 보틀링 카운트
  const perUser = new Map<string, Set<string>>();
  for (const r of ((overlapsRes.data ?? []) as { user_id: string; bottling_id: string | null }[])) {
    if (!r.bottling_id) continue;
    if (excludeSet.has(r.user_id)) continue;
    let s = perUser.get(r.user_id);
    if (!s) {
      s = new Set<string>();
      perUser.set(r.user_id, s);
    }
    s.add(r.bottling_id);
  }

  type Scored = { userId: string; count: number; sharedIds: string[] };
  const scored: Scored[] = [];
  for (const [uid, set] of perUser) {
    if (set.size < MIN_INTERSECTION) continue;
    scored.push({ userId: uid, count: set.size, sharedIds: Array.from(set) });
  }
  if (scored.length === 0) return [];

  scored.sort((a, b) => b.count - a.count);
  const finalists = scored.slice(0, MAX_RESULTS);

  // 프리뷰용 보틀링 이름 fetch (finalists의 shared bottling_ids 유니온)
  const previewIds = new Set<string>();
  for (const f of finalists) {
    for (const bid of f.sharedIds.slice(0, PREVIEW_BOTTLINGS)) previewIds.add(bid);
  }

  const [profilesRes, bottlingsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in(
        "id",
        finalists.map((f) => f.userId),
      ),
    previewIds.size > 0
      ? supabase
          .from("bottling_card_stats")
          .select("id, name, name_kr")
          .in("id", Array.from(previewIds))
      : Promise.resolve({ data: null } as const),
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

  const bottlingsById = new Map<string, TasteTwinPreviewBottling>();
  for (const b of ((bottlingsRes.data ?? []) as Array<{
    id: string | null;
    name: string;
    name_kr: string | null;
  }>)) {
    if (b.id) bottlingsById.set(b.id, { id: b.id, name: b.name, nameKr: b.name_kr });
  }

  const result: TasteTwin[] = [];
  for (const f of finalists) {
    const p = profilesById.get(f.userId);
    if (!p) continue;
    const preview: TasteTwinPreviewBottling[] = [];
    for (const bid of f.sharedIds.slice(0, PREVIEW_BOTTLINGS)) {
      const b = bottlingsById.get(bid);
      if (b) preview.push(b);
    }
    result.push({
      userId: p.id,
      username: p.username,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      commonBottlingCount: f.count,
      previewBottlings: preview,
    });
  }
  return result;
}
