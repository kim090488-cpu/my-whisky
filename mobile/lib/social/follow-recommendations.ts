import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { loadTasteProfile, type TasteTag } from "@/lib/tastings/taste-profile";

export type FollowRecommendationTopNote = {
  tastingId: string;
  bottlingId: string;
  bottlingName: string;
  bottlingNameKr: string | null;
  distilleryName: string;
  distilleryNameKr: string | null;
  score: number | null;
  labelImageUrl: string | null;
};

export type CommonBottling = {
  id: string;
  name: string;
  nameKr: string | null;
  distilleryName: string;
  distilleryNameKr: string | null;
};

export type FollowRecommendation = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  publicNoteCount: number;
  sharedTags: TasteTag[];
  matchScore: number;
  topNote: FollowRecommendationTopNote | null;
  commonBottlings: CommonBottling[];
};

const CANDIDATE_POOL = 10;
const MAX_RESULTS = 3;
const COMMON_LOVE_MIN_SCORE = 85;
const MAX_COMMON_BOTTLINGS = 2;

function tagWeight(key: string): number {
  if (key.startsWith("flavor:") || key.startsWith("anti-flavor:")) return 3;
  if (key.startsWith("country:") || key.startsWith("region:") || key.startsWith("cask:")) return 2;
  return 1;
}

/** Weighted Jaccard × 100. 두 집합 모두 비었으면 0. */
function weightedJaccard(a: TasteTag[], b: TasteTag[]): number {
  const bKeys = new Map(b.map((t) => [t.key, t]));
  let interW = 0;
  let unionW = 0;
  const seen = new Set<string>();
  for (const t of a) {
    const w = tagWeight(t.key);
    unionW += w;
    seen.add(t.key);
    if (bKeys.has(t.key)) interW += w;
  }
  for (const t of b) {
    if (seen.has(t.key)) continue;
    unionW += tagWeight(t.key);
  }
  if (unionW === 0) return 0;
  return Math.round((interW / unionW) * 100);
}

export type FollowRecommendationOptions = {
  viewerId?: string | null;
  excludeIds?: string[];
};

export async function loadFollowRecommendations(
  supabase: SupabaseClient<Database>,
  basisUserId: string,
  opts: FollowRecommendationOptions = {},
): Promise<FollowRecommendation[]> {
  const basisProfile = await loadTasteProfile(supabase, basisUserId, {
    publicOnly: opts.viewerId !== basisUserId,
  });
  if (basisProfile.tags.length === 0) return [];

  const excludeSet = new Set<string>([basisUserId, ...(opts.excludeIds ?? [])]);
  if (opts.viewerId) excludeSet.add(opts.viewerId);

  const candidatesRes = await supabase
    .from("top_reviewers")
    .select("id, username, display_name, avatar_url, public_note_count")
    .gt("public_note_count", 0)
    .order("total_likes_received", { ascending: false })
    .order("public_note_count", { ascending: false })
    .limit(CANDIDATE_POOL + excludeSet.size);

  const candidates = ((candidatesRes.data ?? []) as Array<{
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    public_note_count: number;
  }>).filter((c) => !excludeSet.has(c.id));

  let followedIds = new Set<string>();
  if (opts.viewerId) {
    const followsRes = await supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", opts.viewerId);
    followedIds = new Set(
      ((followsRes.data ?? []) as { followee_id: string }[]).map((f) => f.followee_id),
    );
  }
  const nonFollowed = candidates.filter((c) => !followedIds.has(c.id));
  if (nonFollowed.length === 0) return [];

  const profiles = await Promise.all(
    nonFollowed.map((c) => loadTasteProfile(supabase, c.id, { publicOnly: true })),
  );

  const basisTagKeys = new Set(basisProfile.tags.map((t) => t.key));
  const scored = nonFollowed
    .map((c, i) => {
      const candidateTags = profiles[i].tags;
      const shared = candidateTags.filter((t) => basisTagKeys.has(t.key));
      const matchScore = weightedJaccard(basisProfile.tags, candidateTags);
      return { c, shared, matchScore };
    })
    .filter(({ shared }) => shared.length > 0)
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return b.shared.length - a.shared.length;
    });

  const finalists = scored.slice(0, MAX_RESULTS);
  const finalistIds = finalists.map(({ c }) => c.id);
  const [topNotes, commonBottlings] = await Promise.all([
    loadTopNotesFor(supabase, finalistIds),
    loadCommonBottlingsFor(supabase, basisUserId, finalistIds, {
      basisPublicOnly: opts.viewerId !== basisUserId,
    }),
  ]);

  return finalists.map(({ c, shared, matchScore }) => ({
    id: c.id,
    username: c.username,
    display_name: c.display_name,
    avatar_url: c.avatar_url,
    publicNoteCount: c.public_note_count,
    sharedTags: shared,
    matchScore,
    topNote: topNotes.get(c.id) ?? null,
    commonBottlings: commonBottlings.get(c.id) ?? [],
  }));
}

async function loadHighScoredBottlingIds(
  supabase: SupabaseClient<Database>,
  userId: string,
  opts: { publicOnly: boolean },
): Promise<Set<string>> {
  let q = supabase
    .from("tastings")
    .select("bottling_id")
    .eq("user_id", userId)
    .gte("score", COMMON_LOVE_MIN_SCORE)
    .not("bottling_id", "is", null);
  if (opts.publicOnly) q = q.eq("visibility", "public");
  const { data } = await q;
  const ids = new Set<string>();
  for (const r of ((data ?? []) as Array<{ bottling_id: string | null }>)) {
    if (r.bottling_id) ids.add(r.bottling_id);
  }
  return ids;
}

async function loadCommonBottlingsFor(
  supabase: SupabaseClient<Database>,
  basisUserId: string,
  candidateIds: string[],
  opts: { basisPublicOnly: boolean },
): Promise<Map<string, CommonBottling[]>> {
  const result = new Map<string, CommonBottling[]>();
  if (candidateIds.length === 0) return result;

  const [basisSet, ...candidateSets] = await Promise.all([
    loadHighScoredBottlingIds(supabase, basisUserId, { publicOnly: opts.basisPublicOnly }),
    ...candidateIds.map((cid) =>
      loadHighScoredBottlingIds(supabase, cid, { publicOnly: true }),
    ),
  ]);

  if (basisSet.size === 0) return result;

  const commonIdsPerCandidate = candidateIds.map((cid, i) => {
    const set = candidateSets[i];
    const common: string[] = [];
    for (const b of set) {
      if (basisSet.has(b)) {
        common.push(b);
        if (common.length >= MAX_COMMON_BOTTLINGS) break;
      }
    }
    return { cid, common };
  });

  const allCommonIds = Array.from(
    new Set(commonIdsPerCandidate.flatMap((r) => r.common)),
  );
  if (allCommonIds.length === 0) return result;

  const bottlingsRes = await supabase
    .from("bottling_card_stats")
    .select("id, name, name_kr, distillery_name, distillery_name_kr")
    .in("id", allCommonIds);

  const bottlingsById = new Map<string, CommonBottling>();
  for (const b of ((bottlingsRes.data ?? []) as Array<{
    id: string | null;
    name: string;
    name_kr: string | null;
    distillery_name: string;
    distillery_name_kr: string | null;
  }>)) {
    if (b.id) {
      bottlingsById.set(b.id, {
        id: b.id,
        name: b.name,
        nameKr: b.name_kr,
        distilleryName: b.distillery_name,
        distilleryNameKr: b.distillery_name_kr,
      });
    }
  }

  for (const { cid, common } of commonIdsPerCandidate) {
    const list = common
      .map((id) => bottlingsById.get(id))
      .filter((v): v is CommonBottling => !!v);
    if (list.length > 0) result.set(cid, list);
  }

  return result;
}

async function loadTopNotesFor(
  supabase: SupabaseClient<Database>,
  userIds: string[],
): Promise<Map<string, FollowRecommendationTopNote>> {
  const result = new Map<string, FollowRecommendationTopNote>();
  if (userIds.length === 0) return result;

  const perUser = await Promise.all(
    userIds.map(async (uid) => {
      const res = await supabase
        .from("tastings")
        .select("id, bottling_id, score")
        .eq("user_id", uid)
        .eq("visibility", "public")
        .not("bottling_id", "is", null)
        .order("score", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1);
      const row = (res.data ?? [])[0] as
        | { id: string; bottling_id: string; score: number | null }
        | undefined;
      return { uid, row: row ?? null };
    }),
  );

  const bottlingIds = Array.from(
    new Set(perUser.map((p) => p.row?.bottling_id).filter((v): v is string => !!v)),
  );
  if (bottlingIds.length === 0) return result;

  const bottlingsRes = await supabase
    .from("bottling_card_stats")
    .select("id, name, name_kr, distillery_name, distillery_name_kr, label_image_url")
    .in("id", bottlingIds);

  const bottlingsById = new Map<
    string,
    {
      name: string;
      name_kr: string | null;
      distillery_name: string;
      distillery_name_kr: string | null;
      label_image_url: string | null;
    }
  >();
  for (const b of (bottlingsRes.data ?? []) as Array<{
    id: string | null;
    name: string;
    name_kr: string | null;
    distillery_name: string;
    distillery_name_kr: string | null;
    label_image_url: string | null;
  }>) {
    if (b.id) bottlingsById.set(b.id, b);
  }

  for (const { uid, row } of perUser) {
    if (!row) continue;
    const b = bottlingsById.get(row.bottling_id);
    if (!b) continue;
    result.set(uid, {
      tastingId: row.id,
      bottlingId: row.bottling_id,
      bottlingName: b.name,
      bottlingNameKr: b.name_kr,
      distilleryName: b.distillery_name,
      distilleryNameKr: b.distillery_name_kr,
      score: row.score,
      labelImageUrl: b.label_image_url,
    });
  }

  return result;
}
