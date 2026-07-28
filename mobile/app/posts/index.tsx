import { useCallback, useState } from "react";
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Image,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect, useLocalSearchParams, Stack } from "expo-router";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { postPhotoSignedUrls } from "@/lib/uploads";
import { COUNTRY_FLAG, isEdited } from "@/lib/format";
import type { WhiskyCountry, TastingVisibility } from "@/types/database";

const PAGE_SIZE = 12;

type Profile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Bottling = {
  id: string;
  name: string;
  name_kr: string | null;
  distillery_name: string;
  distillery_name_kr: string | null;
  country: WhiskyCountry;
};

type Post = {
  id: string;
  user_id: string;
  body: string | null;
  photos: string[];
  visibility: TastingVisibility;
  bottling_id: string | null;
  location_name: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  author: Profile | null;
  bottling: Bottling | null;
  liked: boolean;
};

export default function PostsList() {
  const router = useRouter();
  const { session } = useSession();
  const { mine } = useLocalSearchParams<{ mine?: string }>();
  const showMineOnly = mine === "1" && !!session;
  const [posts, setPosts] = useState<Post[]>([]);
  const [heroUrls, setHeroUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | TastingVisibility>("all");

  const load = useCallback(async () => {
    let query = supabase
      .from("posts")
      .select(
        "id, user_id, body, photos, visibility, bottling_id, location_name, like_count, comment_count, created_at, updated_at",
      );
    if (showMineOnly && session) {
      // 내 모먼트만: visibility 무관 (본인은 private/followers 다 볼 수 있음)
      query = query.eq("user_id", session.user.id);
      if (visibilityFilter !== "all") {
        query = query.eq("visibility", visibilityFilter);
      }
    } else {
      query = query.eq("visibility", "public");
    }
    const { data: rawPosts } = await query
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    const rows = (rawPosts ?? []) as unknown as Array<{
      id: string;
      user_id: string;
      body: string | null;
      photos: string[];
      visibility: TastingVisibility;
      bottling_id: string | null;
      location_name: string | null;
      like_count: number;
      comment_count: number;
      created_at: string;
      updated_at: string;
    }>;

    if (rows.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const bottlingIds = Array.from(
      new Set(rows.map((r) => r.bottling_id).filter((v): v is string => !!v)),
    );

    const [profRes, botRes, likedRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", userIds),
      bottlingIds.length > 0
        ? supabase
            .from("bottling_card_stats")
            .select("id, name, name_kr, distillery_name, distillery_name_kr, country")
            .in("id", bottlingIds)
        : Promise.resolve({ data: [] as unknown[] } as const),
      session
        ? supabase
            .from("post_likes")
            .select("post_id")
            .eq("user_id", session.user.id)
            .in("post_id", rows.map((r) => r.id))
        : Promise.resolve({ data: [] as unknown[] } as const),
    ]);

    const profById = new Map<string, Profile>();
    for (const p of (profRes.data ?? []) as Array<{
      id: string; username: string; display_name: string | null; avatar_url: string | null;
    }>) {
      profById.set(p.id, {
        username: p.username, display_name: p.display_name, avatar_url: p.avatar_url,
      });
    }

    const botById = new Map<string, Bottling>();
    for (const b of (botRes.data ?? []) as Array<{
      id: string | null; name: string; name_kr: string | null;
      distillery_name: string; distillery_name_kr: string | null; country: WhiskyCountry;
    }>) {
      if (b.id) {
        botById.set(b.id, {
          id: b.id, name: b.name, name_kr: b.name_kr,
          distillery_name: b.distillery_name,
          distillery_name_kr: b.distillery_name_kr,
          country: b.country,
        });
      }
    }

    const likedIds = new Set(
      ((likedRes.data ?? []) as Array<{ post_id: string }>).map((l) => l.post_id),
    );

    setPosts(
      rows.map((r) => ({
        ...r,
        author: profById.get(r.user_id) ?? null,
        bottling: r.bottling_id ? botById.get(r.bottling_id) ?? null : null,
        liked: likedIds.has(r.id),
      })),
    );
    setLoading(false);

    // post-photos private 버킷 — 각 카드 hero 사진 signed URL 발급
    const heroPaths = rows.map((r) => r.photos?.[0]).filter((p): p is string => !!p);
    if (heroPaths.length > 0) {
      const signed = await postPhotoSignedUrls(heroPaths);
      const map: Record<string, string> = {};
      for (let i = 0; i < heroPaths.length; i++) {
        const u = signed[i];
        if (u) map[heroPaths[i]] = u;
      }
      setHeroUrls(map);
    } else {
      setHeroUrls({});
    }
  }, [session, showMineOnly, visibilityFilter]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading && posts.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fbbf24" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: showMineOnly ? "내 모먼트" : "모먼트" }} />
      <FlatList
      style={{ backgroundColor: "#0a0a0a" }}
      data={posts}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 24 }}
      ListHeaderComponent={
        <View style={{ gap: 10 }}>
          {showMineOnly && (
            <View style={styles.filterRow}>
              {(["all", "public", "followers", "private"] as const).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setVisibilityFilter(v)}
                  style={({ pressed }) => [
                    styles.filterPill,
                    visibilityFilter === v && styles.filterPillActive,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.filterText, visibilityFilter === v && styles.filterTextActive]}>
                    {v === "all" ? "전체" : v === "public" ? "공개" : v === "followers" ? "팔로워만" : "비공개"}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {session && (
            <Pressable
              onPress={() => router.push("/posts/new" as never)}
              style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="add" size={18} color="#0a0a0a" />
              <Text style={styles.newBtnText}>모먼트 남기기</Text>
            </Pressable>
          )}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            {showMineOnly ? "아직 작성한 모먼트가 없어요." : "아직 공개된 모먼트가 없어요."}
          </Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor="#fbbf24"
        />
      }
      renderItem={({ item: p }) => (
        <PostCard post={p} heroUrl={p.photos?.[0] ? heroUrls[p.photos[0]] ?? null : null} router={router} />
      )}
    />
    </>
  );
}

function PostCard({
  post: p, heroUrl, router,
}: {
  post: Post;
  heroUrl: string | null;
  router: ReturnType<typeof useRouter>;
}) {
  const authorName = p.author?.display_name ?? p.author?.username ?? "익명";
  const initial = authorName.trim().charAt(0).toUpperCase();
  const heroPhoto = heroUrl;

  return (
    <Pressable
      onPress={() => router.push(`/posts/${p.id}` as never)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      {/* header */}
      <View style={styles.header}>
        <Pressable
          disabled={!p.author?.username}
          onPress={(e) => {
            e.stopPropagation();
            if (p.author?.username) router.push(`/profile/${p.author.username}` as never);
          }}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initial}</Text>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.headerRow}>
            <Text style={styles.author} numberOfLines={1}>{authorName}</Text>
            <Text style={styles.date}>{p.created_at.slice(0, 10)}</Text>
            {isEdited(p.created_at, p.updated_at) && (
              <Text style={styles.editedBadge}>수정됨</Text>
            )}
          </View>
        </View>
      </View>

      {/* hero photo (첫 장만) */}
      {heroPhoto && (
        <Image source={{ uri: heroPhoto }} style={styles.hero} resizeMode="cover" />
      )}
      {p.photos.length > 1 && (
        <View style={styles.photoCountBadge}>
          <Ionicons name="images" size={11} color="#fafafa" />
          <Text style={styles.photoCountText}>{p.photos.length}</Text>
        </View>
      )}

      {/* body */}
      {p.body && (
        <Text style={styles.body} numberOfLines={4}>{p.body}</Text>
      )}

      {/* pills */}
      {(p.bottling || p.location_name) && (
        <View style={styles.pillRow}>
          {p.bottling && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                router.push(`/whiskies/${p.bottling!.id}` as never);
              }}
              style={styles.bottlingPill}
            >
              <Text style={styles.bottlingPillText} numberOfLines={1}>
                🥃 {COUNTRY_FLAG[p.bottling.country]}{" "}
                {p.bottling.distillery_name_kr ?? p.bottling.distillery_name} · {p.bottling.name_kr ?? p.bottling.name}
              </Text>
            </Pressable>
          )}
          {p.location_name && (
            <View style={styles.locationPill}>
              <Ionicons name="location-outline" size={11} color="#a3a3a3" />
              <Text style={styles.locationText} numberOfLines={1}>{p.location_name}</Text>
            </View>
          )}
        </View>
      )}

      {/* footer */}
      <View style={styles.footer}>
        <View style={styles.footerStat}>
          <Ionicons name="chatbubble-outline" size={13} color="#a3a3a3" />
          <Text style={styles.footerNum}>{p.comment_count}</Text>
        </View>
        <View style={styles.footerStat}>
          <Ionicons
            name={p.liked ? "heart" : "heart-outline"}
            size={14}
            color={p.liked ? "#fbbf24" : "#a3a3a3"}
          />
          <Text style={[styles.footerNum, p.liked && { color: "#fbbf24" }]}>{p.like_count}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a" },
  emptyBox: {
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 10, padding: 32, alignItems: "center",
    backgroundColor: "#171717",
    marginTop: 12,
  },
  emptyText: { color: "#737373", fontSize: 13 },

  filterRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  filterPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: "#262626", backgroundColor: "#171717" },
  filterPillActive: { borderColor: "#fbbf24", backgroundColor: "rgba(251, 191, 36, 0.1)" },
  filterText: { color: "#a3a3a3", fontSize: 11 },
  filterTextActive: { color: "#fbbf24", fontWeight: "600" },
  newBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#fbbf24",
    paddingVertical: 10, borderRadius: 8,
    marginBottom: 4,
  },
  newBtnText: { color: "#0a0a0a", fontSize: 13, fontWeight: "600" },

  card: {
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 12, overflow: "hidden",
    position: "relative",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(180, 83, 9, 0.3)",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fde68a", fontSize: 14, fontWeight: "600" },
  headerRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  author: { color: "#fafafa", fontSize: 13, fontWeight: "600" },
  date: { color: "#737373", fontSize: 11 },
  editedBadge: { color: "#737373", fontSize: 10, fontStyle: "italic" },

  hero: { width: "100%", height: 240, backgroundColor: "#0a0a0a" },
  photoCountBadge: {
    position: "absolute", top: 60, right: 12,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8,
    flexDirection: "row", alignItems: "center", gap: 3,
  },
  photoCountText: { color: "#fafafa", fontSize: 10, fontWeight: "500" },

  body: {
    color: "#e5e5e5", fontSize: 14, lineHeight: 20,
    paddingHorizontal: 12, paddingTop: 10,
  },

  pillRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
    paddingHorizontal: 12, paddingTop: 10,
  },
  bottlingPill: {
    borderWidth: 1, borderColor: "rgba(180, 83, 9, 0.4)",
    backgroundColor: "rgba(251, 191, 36, 0.05)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    maxWidth: "100%",
  },
  bottlingPillText: { color: "#fde68a", fontSize: 11 },
  locationPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderWidth: 1, borderColor: "#262626",
    backgroundColor: "rgba(38, 38, 38, 0.4)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  locationText: { color: "#a3a3a3", fontSize: 11 },

  footer: {
    flexDirection: "row", justifyContent: "flex-end", gap: 14,
    borderTopWidth: 1, borderTopColor: "#262626",
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 10,
  },
  footerStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerNum: { color: "#a3a3a3", fontSize: 12, fontWeight: "500" },
});
