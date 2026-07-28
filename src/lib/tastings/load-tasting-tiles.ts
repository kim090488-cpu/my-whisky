import type { SupabaseClient } from "@supabase/supabase-js";
import type { TastingTileData } from "@/components/social/tasting-tile";
import type { Database, WhiskyCountry } from "@/types/database";

export type TastingBaseRow = Omit<TastingTileData, "profile" | "bottling" | "liked"> & {
  bottling_id: string;
};

export const TASTING_TILE_COLUMNS =
  "id, tasted_at, score, notes, photos, visibility, user_id, bottling_id, like_count, comment_count, would_buy_again, value_for_money, sweetness, smokiness, fruitiness, spiciness, smoothness, complexity, finish_length, tags";

export async function enrichTastings(
  supabase: SupabaseClient<Database>,
  rows: TastingBaseRow[],
  currentUserId: string | null,
): Promise<TastingTileData[]> {
  if (rows.length === 0) return [];

  const bottlingIds = Array.from(new Set(rows.map((r) => r.bottling_id)));
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const tastingIds = rows.map((r) => r.id);

  const [bsRes, profsRes, myLikesRes] = await Promise.all([
    supabase
      .from("bottling_card_stats")
      .select("id, name, name_kr, distillery_name, distillery_name_kr, country, label_image_url")
      .in("id", bottlingIds),
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", userIds),
    currentUserId
      ? supabase
          .from("tasting_likes")
          .select("tasting_id")
          .eq("user_id", currentUserId)
          .in("tasting_id", tastingIds)
      : Promise.resolve({ data: [] as { tasting_id: string }[] } as const),
  ]);

  const bottlingsById = new Map<string, TastingTileData["bottling"]>();
  const bsTyped = (bsRes.data ?? []) as Array<{
    id: string | null;
    name: string | null;
    name_kr: string | null;
    distillery_name: string | null;
    distillery_name_kr: string | null;
    country: WhiskyCountry | null;
    label_image_url: string | null;
  }>;
  for (const b of bsTyped) {
    if (!b.id || !b.name || !b.distillery_name || !b.country) continue;
    bottlingsById.set(b.id, {
      id: b.id,
      name: b.name,
      name_kr: b.name_kr,
      distillery_name: b.distillery_name,
      distillery_name_kr: b.distillery_name_kr,
      country: b.country,
      label_image_url: b.label_image_url,
    });
  }

  const profilesById = new Map<
    string,
    { username: string; display_name: string | null; avatar_url: string | null }
  >();
  const psTyped = (profsRes.data ?? []) as Array<{
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  }>;
  for (const p of psTyped) {
    profilesById.set(p.id, {
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
    });
  }

  const likedIds = new Set(
    ((myLikesRes.data ?? []) as { tasting_id: string }[]).map((l) => l.tasting_id),
  );

  return rows.map((r) => ({
    ...r,
    profile: profilesById.get(r.user_id) ?? null,
    bottling: bottlingsById.get(r.bottling_id) ?? null,
    liked: likedIds.has(r.id),
  }));
}

export async function loadTastingTilesByIds(
  supabase: SupabaseClient<Database>,
  ids: string[],
  currentUserId: string | null,
): Promise<TastingTileData[]> {
  if (ids.length === 0) return [];

  const tastingsQ = await supabase
    .from("tastings")
    .select(TASTING_TILE_COLUMNS)
    .in("id", ids);

  const rows = (tastingsQ.data ?? []) as TastingBaseRow[];
  const enriched = await enrichTastings(supabase, rows, currentUserId);
  const byId = new Map(enriched.map((t) => [t.id, t]));
  return ids
    .map((id) => byId.get(id))
    .filter((v): v is TastingTileData => v !== undefined);
}
