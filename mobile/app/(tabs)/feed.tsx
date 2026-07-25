import { useCallback, useEffect, useState } from "react";
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Image,
  Dimensions, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { COUNTRY_FLAG, isEdited } from "@/lib/format";
import { postPhotoUrl, tastingPhotoUrl } from "@/lib/uploads";
import type { WhiskyCountry, TastingVisibility } from "@/types/database";

const WINDOW_W = Dimensions.get("window").width;

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Bottling = {
  id: string;
  name: string;
  name_kr: string | null;
  distillery_name: string;
  country: WhiskyCountry;
};

type FeedItem = {
  kind: "post" | "tasting";
  id: string;
  user_id: string;
  body: string | null;              // post.body or tasting.notes
  photos: string[];
  created_at: string;
  updated_at: string;
  like_count: number;
  comment_count: number;
  visibility: TastingVisibility;
  bottling_id: string | null;
  score: number | null;             // tasting only
  author?: Profile;
  bottling?: Bottling;
  liked: boolean;
};

export default function FeedScreen() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [empty, setEmpty] = useState<"no_session" | "no_follows" | "no_items" | null>(null);

  const load = useCallback(async () => {
    if (!session) return;

    const { data: follows } = await supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", session.user.id);
    const followeeIds = ((follows ?? []) as Array<{ followee_id: string }>).map((f) => f.followee_id);
    if (followeeIds.length === 0) {
      setItems([]); setEmpty("no_follows"); setLoading(false); return;
    }

    // 모먼트(posts) + 사진 있는 노트(tastings) 병합
    const [postsRes, tastingsRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, user_id, body, photos, visibility, bottling_id, like_count, comment_count, created_at, updated_at")
        .in("user_id", followeeIds)
        .in("visibility", ["public", "followers"])
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("tastings")
        .select("id, user_id, notes, photos, visibility, bottling_id, like_count, comment_count, created_at, updated_at, score")
        .in("user_id", followeeIds)
        .in("visibility", ["public", "followers"])
        .not("photos", "is", null)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const rawPosts = (postsRes.data ?? []) as unknown as Array<{
      id: string; user_id: string; body: string | null; photos: string[];
      visibility: TastingVisibility; bottling_id: string | null;
      like_count: number; comment_count: number;
      created_at: string; updated_at: string;
    }>;
    const rawTastings = (tastingsRes.data ?? []) as unknown as Array<{
      id: string; user_id: string; notes: string | null; photos: string[] | null;
      visibility: TastingVisibility; bottling_id: string;
      like_count: number; comment_count: number;
      created_at: string; updated_at: string; score: number | null;
    }>;

    const merged: FeedItem[] = [
      ...rawPosts.map<FeedItem>((p) => ({
        kind: "post", id: p.id, user_id: p.user_id, body: p.body,
        photos: p.photos ?? [], created_at: p.created_at, updated_at: p.updated_at,
        like_count: p.like_count, comment_count: p.comment_count,
        visibility: p.visibility, bottling_id: p.bottling_id, score: null,
        liked: false,
      })),
      ...rawTastings
        .filter((t) => (t.photos ?? []).length > 0)
        .map<FeedItem>((t) => ({
          kind: "tasting", id: t.id, user_id: t.user_id, body: t.notes,
          photos: t.photos ?? [], created_at: t.created_at, updated_at: t.updated_at,
          like_count: t.like_count, comment_count: t.comment_count,
          visibility: t.visibility, bottling_id: t.bottling_id, score: t.score,
          liked: false,
        })),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 40);

    if (merged.length === 0) {
      setItems([]); setEmpty("no_items"); setLoading(false); return;
    }

    // 프로필 + 보틀링 + 내 좋아요 상태 병렬 fetch
    const userIds = Array.from(new Set(merged.map((m) => m.user_id)));
    const bottlingIds = Array.from(new Set(merged.map((m) => m.bottling_id).filter((v): v is string => !!v)));
    const postIds = merged.filter((m) => m.kind === "post").map((m) => m.id);
    const tastingIds = merged.filter((m) => m.kind === "tasting").map((m) => m.id);

    const [profsRes, btsRes, postLikesRes, tastingLikesRes] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", userIds),
      bottlingIds.length > 0
        ? supabase.from("bottling_card_stats").select("id, name, name_kr, distillery_name, country").in("id", bottlingIds)
        : Promise.resolve({ data: [] as unknown[] } as const),
      postIds.length > 0
        ? supabase.from("post_likes").select("post_id").eq("user_id", session.user.id).in("post_id", postIds)
        : Promise.resolve({ data: [] as unknown[] } as const),
      tastingIds.length > 0
        ? supabase.from("tasting_likes").select("tasting_id").eq("user_id", session.user.id).in("tasting_id", tastingIds)
        : Promise.resolve({ data: [] as unknown[] } as const),
    ]);

    const profsById = new Map<string, Profile>();
    for (const p of (profsRes.data ?? []) as Profile[]) profsById.set(p.id, p);
    const btsById = new Map<string, Bottling>();
    for (const b of (btsRes.data ?? []) as Array<Bottling & { id: string | null }>) {
      if (b.id) btsById.set(b.id, b);
    }
    const likedPostIds = new Set(((postLikesRes.data ?? []) as Array<{ post_id: string }>).map((r) => r.post_id));
    const likedTastingIds = new Set(((tastingLikesRes.data ?? []) as Array<{ tasting_id: string }>).map((r) => r.tasting_id));

    setItems(
      merged.map((m) => ({
        ...m,
        author: profsById.get(m.user_id),
        bottling: m.bottling_id ? btsById.get(m.bottling_id) : undefined,
        liked: m.kind === "post" ? likedPostIds.has(m.id) : likedTastingIds.has(m.id),
      })),
    );
    setEmpty(null);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      setEmpty("no_session"); setLoading(false); return;
    }
    setLoading(true);
    void load();
  }, [session, sessionLoading, load]);

  useFocusEffect(useCallback(() => {
    if (session && !loading) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]));

  if (loading) return <View style={styles.center}><ActivityIndicator color="#fbbf24" /></View>;

  if (empty === "no_session") return (
    <View style={styles.center}>
      <Text style={styles.muted}>로그인 후 피드를 볼 수 있어요.</Text>
    </View>
  );
  if (empty === "no_follows") return (
    <View style={styles.center}>
      <Ionicons name="people-outline" size={40} color="#525252" />
      <Text style={styles.muted}>아직 팔로우한 사람이 없어요.</Text>
      <Text style={styles.subMuted}>노트에서 작성자를 탭하면 프로필로 이동해서 팔로우할 수 있어요.</Text>
    </View>
  );
  if (empty === "no_items") return (
    <View style={styles.center}>
      <Ionicons name="image-outline" size={40} color="#525252" />
      <Text style={styles.muted}>팔로우한 사람들의 사진이 아직 없어요.</Text>
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: "#0a0a0a" }}
      data={items}
      keyExtractor={(i) => `${i.kind}-${i.id}`}
      contentContainerStyle={{ paddingBottom: 24 }}
      renderItem={({ item }) => (
        <FeedCard item={item} onUpdate={(updater) => {
          setItems((prev) => prev.map((x) => x.id === item.id && x.kind === item.kind ? updater(x) : x));
        }} />
      )}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
          tintColor="#fbbf24"
        />
      }
    />
  );
}

function FeedCard({ item, onUpdate }: { item: FeedItem; onUpdate: (updater: (prev: FeedItem) => FeedItem) => void }) {
  const router = useRouter();
  const { session } = useSession();
  const [likePending, setLikePending] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const authorName = item.author?.display_name ?? item.author?.username ?? "익명";
  const initial = authorName.trim().charAt(0).toUpperCase();
  const detailPath = item.kind === "post" ? `/posts/${item.id}` : `/tastings/${item.id}`;

  async function toggleLike() {
    if (!session || likePending) {
      if (!session) router.push("/(tabs)/me" as never);
      return;
    }
    const prev = { liked: item.liked, count: item.like_count };
    onUpdate((it) => ({
      ...it,
      liked: !prev.liked,
      like_count: prev.liked ? Math.max(0, prev.count - 1) : prev.count + 1,
    }));
    setLikePending(true);
    const table = item.kind === "post" ? "post_likes" : "tasting_likes";
    const idCol = item.kind === "post" ? "post_id" : "tasting_id";
    const op = prev.liked
      ? supabase.from(table).delete().eq("user_id", session.user.id).eq(idCol, item.id)
      : supabase.from(table).insert({ user_id: session.user.id, [idCol]: item.id });
    const { error } = await op;
    if (error) {
      onUpdate((it) => ({ ...it, liked: prev.liked, like_count: prev.count }));
    }
    setLikePending(false);
  }

  const photoUrl = (path: string) => item.kind === "post" ? postPhotoUrl(path) : tastingPhotoUrl(path);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHead}>
        <Pressable
          disabled={!item.author?.username}
          onPress={() => item.author?.username && router.push(`/profile/${item.author.username}` as never)}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initial}</Text>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Pressable
            disabled={!item.author?.username}
            onPress={() => item.author?.username && router.push(`/profile/${item.author.username}` as never)}
            hitSlop={4}
          >
            <Text style={styles.author} numberOfLines={1}>{authorName}</Text>
          </Pressable>
          <View style={styles.metaRow}>
            <Text style={styles.subLine} numberOfLines={1}>
              {item.kind === "post" ? "모먼트" : `노트 · ${item.score ?? ""}`}
              {isEdited(item.created_at, item.updated_at) && "  · 수정됨"}
            </Text>
          </View>
        </View>
      </View>

      {/* Photos (가로 스크롤 — Pressable 없이 스와이프 방해 방지) */}
      <View>
        <FlatList
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={item.photos}
          keyExtractor={(p, i) => `${p}-${i}`}
          onScroll={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / WINDOW_W);
            if (i !== photoIndex) setPhotoIndex(i);
          }}
          scrollEventThrottle={16}
          renderItem={({ item: p }) => {
            const url = photoUrl(p);
            return url ? (
              <Image source={{ uri: url }} style={styles.photo} resizeMode="cover" />
            ) : (
              <View style={styles.photo} />
            );
          }}
        />
        {item.photos.length > 1 && (
          <View style={styles.dots} pointerEvents="none">
            {item.photos.map((_, i) => (
              <View key={i} style={[styles.dot, i === photoIndex && styles.dotActive]} />
            ))}
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <Pressable onPress={toggleLike} hitSlop={8} disabled={likePending} style={styles.actionBtn}>
          <Ionicons
            name={item.liked ? "heart" : "heart-outline"}
            size={26}
            color={item.liked ? "#f43f5e" : "#fafafa"}
          />
        </Pressable>
        <Pressable onPress={() => router.push(detailPath as never)} hitSlop={8} style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={24} color="#fafafa" />
        </Pressable>
      </View>

      {/* Counts */}
      {item.like_count > 0 && (
        <Text style={styles.counts}>좋아요 {item.like_count}개</Text>
      )}

      {/* Caption */}
      {item.body && (
        <Text style={styles.caption} numberOfLines={3}>
          <Text style={styles.captionAuthor}>{authorName}</Text>
          {"  "}
          {item.body}
        </Text>
      )}

      {/* Whisky tag */}
      {item.bottling && (
        <Pressable
          onPress={() => item.bottling && router.push(`/(tabs)/whiskies/${item.bottling.id}` as never)}
          style={styles.tagRow}
        >
          <Ionicons name="wine-outline" size={12} color="#fbbf24" />
          <Text style={styles.tagText} numberOfLines={1}>
            {COUNTRY_FLAG[item.bottling.country]} {item.bottling.distillery_name} · {item.bottling.name_kr ?? item.bottling.name}
          </Text>
        </Pressable>
      )}

      {/* Comments preview */}
      {item.comment_count > 0 && (
        <Pressable onPress={() => router.push(detailPath as never)} hitSlop={4}>
          <Text style={styles.commentsLink}>댓글 {item.comment_count}개 보기</Text>
        </Pressable>
      )}

      {/* Time */}
      <Text style={styles.time}>{item.created_at.slice(0, 10)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a", padding: 24, gap: 10 },
  muted: { color: "#a3a3a3", textAlign: "center", fontSize: 14 },
  subMuted: { color: "#737373", textAlign: "center", fontSize: 12 },

  card: {
    backgroundColor: "#0a0a0a",
    borderBottomWidth: 1, borderBottomColor: "#171717",
    paddingBottom: 12,
  },
  cardHead: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#1f1f1f",
    borderWidth: 1, borderColor: "#404040",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fbbf24", fontSize: 14, fontWeight: "700" },
  author: { color: "#fafafa", fontSize: 13, fontWeight: "600" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  subLine: { color: "#737373", fontSize: 11 },

  photo: { width: WINDOW_W, height: WINDOW_W, backgroundColor: "#171717" },
  dots: {
    position: "absolute", bottom: 10, left: 0, right: 0,
    flexDirection: "row", justifyContent: "center", gap: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { backgroundColor: "#fbbf24" },

  actionRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4,
  },
  actionBtn: { padding: 4 },

  counts: { color: "#fafafa", fontSize: 13, fontWeight: "600", paddingHorizontal: 14, marginTop: 2 },
  caption: { color: "#e5e5e5", fontSize: 13, paddingHorizontal: 14, marginTop: 6, lineHeight: 18 },
  captionAuthor: { color: "#fafafa", fontWeight: "600" },

  tagRow: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 14, marginTop: 8,
  },
  tagText: { color: "#a3a3a3", fontSize: 11, flex: 1 },

  commentsLink: { color: "#737373", fontSize: 12, paddingHorizontal: 14, marginTop: 6 },
  time: { color: "#525252", fontSize: 10, paddingHorizontal: 14, marginTop: 6, textTransform: "uppercase" },
});
