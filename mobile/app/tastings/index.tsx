import { useCallback, useEffect, useState } from "react";
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, Image, RefreshControl,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { COUNTRY_FLAG, formatScore } from "@/lib/format";
import { tastingPhotoUrl } from "@/lib/uploads";
import type { WhiskyCountry, TastingVisibility } from "@/types/database";

type Sort = "recent" | "score" | "likes";

const SORTS: { value: Sort; label: string }[] = [
  { value: "recent", label: "최근" },
  { value: "score", label: "점수" },
  { value: "likes", label: "좋아요" },
];

const PAGE = 20;

type Item = {
  id: string;
  tasted_at: string;
  score: number | null;
  notes: string | null;
  photos: string[] | null;
  visibility: TastingVisibility;
  user_id: string;
  bottling_id: string;
  like_count: number;
  comment_count: number;
  would_buy_again: boolean | null;
  value_for_money: number | null;
  profile: { username: string; display_name: string | null; avatar_url: string | null } | null;
  bottling: {
    id: string;
    name: string;
    name_kr: string | null;
    distillery_name: string;
    distillery_name_kr: string | null;
    country: WhiskyCountry;
  } | null;
};

export default function TastingsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const [items, setItems] = useState<Item[]>([]);
  const [sort, setSort] = useState<Sort>("recent");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [end, setEnd] = useState(false);

  const fetchPage = useCallback(
    async (offset: number, currentSort: Sort): Promise<Item[]> => {
      let q = supabase
        .from("tastings")
        .select(
          "id, tasted_at, score, notes, photos, visibility, user_id, bottling_id, like_count, comment_count, would_buy_again, value_for_money, created_at",
        )
        .eq("visibility", "public");

      if (currentSort === "score") {
        q = q.order("score", { ascending: false, nullsFirst: false });
      } else if (currentSort === "likes") {
        q = q.order("like_count", { ascending: false });
      } else {
        q = q.order("created_at", { ascending: false });
      }

      const { data: raw } = await q.range(offset, offset + PAGE - 1);
      const list = (raw ?? []) as Omit<Item, "profile" | "bottling">[];
      if (list.length === 0) return [];

      const userIds = Array.from(new Set(list.map((t) => t.user_id)));
      const bottlingIds = Array.from(new Set(list.map((t) => t.bottling_id)));
      const [profRes, btRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", userIds),
        supabase
          .from("bottling_card_stats")
          .select("id, name, name_kr, distillery_name, distillery_name_kr, country")
          .in("id", bottlingIds),
      ]);
      const profM = new Map<string, NonNullable<Item["profile"]>>();
      for (const p of (profRes.data ?? []) as NonNullable<Item["profile"]>[]) {
        profM.set((p as unknown as { id: string }).id, p);
      }
      const btM = new Map<string, NonNullable<Item["bottling"]>>();
      for (const b of (btRes.data ?? []) as NonNullable<Item["bottling"]>[]) {
        btM.set(b.id, b);
      }

      return list.map((t) => ({
        ...t,
        profile: profM.get(t.user_id) ?? null,
        bottling: btM.get(t.bottling_id) ?? null,
      }));
    },
    [],
  );

  const reset = useCallback(
    async (currentSort: Sort) => {
      setLoading(true);
      const data = await fetchPage(0, currentSort);
      setItems(data);
      setEnd(data.length < PAGE);
      setLoading(false);
    },
    [fetchPage],
  );

  useEffect(() => {
    reset(sort);
  }, [sort, reset]);

  async function onRefresh() {
    setRefreshing(true);
    const data = await fetchPage(0, sort);
    setItems(data);
    setEnd(data.length < PAGE);
    setRefreshing(false);
  }

  async function loadMore() {
    if (loading || refreshing || end) return;
    setLoading(true);
    const data = await fetchPage(items.length, sort);
    setItems((prev) => [...prev, ...data]);
    if (data.length < PAGE) setEnd(true);
    setLoading(false);
  }

  return (
    <>
      <Stack.Screen options={{ title: "테이스팅 노트" }} />
      <View style={styles.container}>
        <View style={styles.sortRow}>
          {SORTS.map((s) => (
            <Pressable
              key={s.value}
              onPress={() => setSort(s.value)}
              style={({ pressed }) => [
                styles.sortBtn,
                sort === s.value && styles.sortBtnActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.sortText, sort === s.value && styles.sortTextActive]}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          data={items}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 24 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fbbf24" />
          }
          ListFooterComponent={
            loading && !refreshing && items.length > 0 ? (
              <ActivityIndicator color="#fbbf24" style={{ marginVertical: 20 }} />
            ) : null
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color="#fbbf24" style={{ marginTop: 40 }} />
            ) : (
              <Text style={styles.empty}>아직 공개된 노트가 없어요.</Text>
            )
          }
          renderItem={({ item }) => {
            const p = item.profile;
            const b = item.bottling;
            const name = p?.display_name ?? p?.username ?? "익명";
            const photoUrl = item.photos?.[0] ? tastingPhotoUrl(item.photos[0]) : null;
            return (
              <Pressable
                onPress={() => router.push(`/tastings/${item.id}`)}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.authorRow}>
                    <Avatar name={name} url={p?.avatar_url ?? null} size={28} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          if (p?.username) router.push(`/profile/${p.username}`);
                        }}
                        hitSlop={6}
                      >
                        <Text style={styles.authorName} numberOfLines={1}>
                          {name}
                          {item.user_id === session?.user.id && (
                            <Text style={styles.selfBadge}>  · 내 노트</Text>
                          )}
                        </Text>
                      </Pressable>
                      <Text style={styles.date}>{item.tasted_at}</Text>
                    </View>
                  </View>
                </View>

                {b && (
                  <Text style={styles.bottling} numberOfLines={2}>
                    {COUNTRY_FLAG[b.country]} {b.distillery_name_kr ?? b.distillery_name}
                    <Text style={styles.muted}>{"  ·  "}</Text>
                    <Text style={styles.bottlingName}>{b.name_kr ?? b.name}</Text>
                  </Text>
                )}

                <View style={styles.tagRow}>
                  {item.score !== null && (
                    <Text style={styles.score}>{formatScore(item.score)}</Text>
                  )}
                  {item.would_buy_again === true && (
                    <Text style={styles.tagPos}>✓ 다시 살래요</Text>
                  )}
                  {item.would_buy_again === false && (
                    <Text style={styles.tagNeg}>✗ 안 살래요</Text>
                  )}
                  {item.value_for_money !== null && (
                    <Text style={styles.tagMuted}>가성비 {item.value_for_money}/5</Text>
                  )}
                </View>

                {item.notes && (
                  <Text style={styles.notes} numberOfLines={3}>{item.notes}</Text>
                )}

                {photoUrl && (
                  <Image
                    source={{ uri: photoUrl }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                )}

                <View style={styles.footer}>
                  <Text style={styles.footerText}>
                    ♡ {item.like_count} · 💬 {item.comment_count}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    </>
  );
}

function Avatar({ name, url, size }: { name: string; url: string | null; size: number }) {
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "rgba(180, 83, 9, 0.3)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fde68a", fontSize: size * 0.5, fontWeight: "600" }}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },

  sortRow: { flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  sortBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#262626",
    backgroundColor: "#171717",
  },
  sortBtnActive: {
    borderColor: "#fbbf24",
    backgroundColor: "rgba(251, 191, 36, 0.1)",
  },
  sortText: { color: "#a3a3a3", fontSize: 12 },
  sortTextActive: { color: "#fde68a", fontWeight: "600" },

  empty: { color: "#737373", textAlign: "center", fontSize: 14, marginTop: 60 },
  muted: { color: "#737373" },

  card: {
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 10,
    padding: 14,
  },
  cardHeader: { marginBottom: 10 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  authorName: { color: "#fafafa", fontSize: 13, fontWeight: "600" },
  selfBadge: { color: "#fbbf24", fontSize: 11, fontWeight: "500" },
  date: { color: "#737373", fontSize: 11, marginTop: 2 },

  bottling: { color: "#a3a3a3", fontSize: 13, lineHeight: 18 },
  bottlingName: { color: "#fafafa", fontWeight: "500" },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8, alignItems: "center" },
  score: { color: "#fbbf24", fontSize: 16, fontWeight: "700", marginRight: 4 },
  tagPos: {
    color: "#86efac",
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(4, 120, 87, 0.4)",
    backgroundColor: "rgba(52, 211, 153, 0.1)",
    overflow: "hidden",
  },
  tagNeg: {
    color: "#fca5a5",
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(159, 18, 57, 0.4)",
    backgroundColor: "rgba(251, 113, 133, 0.1)",
    overflow: "hidden",
  },
  tagMuted: {
    color: "#a3a3a3",
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#262626",
    backgroundColor: "rgba(64, 64, 64, 0.3)",
    overflow: "hidden",
  },

  notes: { color: "#d4d4d4", fontSize: 13, lineHeight: 19, marginTop: 10 },
  photo: { width: "100%", height: 160, borderRadius: 8, marginTop: 10 },

  footer: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#262626" },
  footerText: { color: "#525252", fontSize: 11 },
});
