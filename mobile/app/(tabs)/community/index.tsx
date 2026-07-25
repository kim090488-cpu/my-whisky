import { useCallback, useEffect, useState } from "react";
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { isEdited } from "@/lib/format";
import { loadBlockedUserIds } from "@/lib/blocks";

const CATEGORIES = [
  { v: "all", label: "전체" },
  { v: "question", label: "질문" },
  { v: "recommendation", label: "추천" },
  { v: "tip", label: "팁" },
  { v: "free", label: "잡담" },
] as const;
type CatFilter = (typeof CATEGORIES)[number]["v"];

type Author = { id: string; username: string; display_name: string | null };
type Post = {
  id: string;
  user_id: string;
  category: "question" | "recommendation" | "tip" | "free";
  title: string;
  body: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  author: Author | null;
};

const CATEGORY_LABEL: Record<Post["category"], string> = {
  question: "질문",
  recommendation: "추천",
  tip: "팁",
  free: "잡담",
};

type MatchKind = "title" | "body" | "comment";

export default function CommunityList() {
  const router = useRouter();
  const { session } = useSession();
  const [items, setItems] = useState<Array<Post & { match?: MatchKind }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cat, setCat] = useState<CatFilter>("all");
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    const query = q.trim();

    // 검색 모드
    if (query.length >= 1) {
      setSearching(true);
      const safe = query.replace(/[%_\\]/g, (m) => `\\${m}`);
      const pattern = `%${safe}%`;

      const [postsRes, commentsRes] = await Promise.all([
        supabase
          .from("community_posts")
          .select("id, user_id, category, title, body, like_count, comment_count, created_at, updated_at")
          .or(`title.ilike.${pattern},body.ilike.${pattern}`)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("community_post_comments")
          .select("post_id")
          .ilike("body", pattern)
          .limit(100),
      ]);

      const titleBodyRows = (postsRes.data ?? []) as unknown as Array<Omit<Post, "author">>;
      const titleMatch = new Set<string>();
      const bodyMatch = new Set<string>();
      const qLower = query.toLowerCase();
      for (const p of titleBodyRows) {
        if (p.title.toLowerCase().includes(qLower)) titleMatch.add(p.id);
        else if (p.body.toLowerCase().includes(qLower)) bodyMatch.add(p.id);
      }

      const commentPostIds = Array.from(new Set(((commentsRes.data ?? []) as Array<{ post_id: string }>).map((c) => c.post_id)));
      const missingIds = commentPostIds.filter((id) => !titleBodyRows.some((p) => p.id === id));
      const extraRows = missingIds.length > 0
        ? ((await supabase
            .from("community_posts")
            .select("id, user_id, category, title, body, like_count, comment_count, created_at, updated_at")
            .in("id", missingIds)).data ?? []) as unknown as Array<Omit<Post, "author">>
        : [];

      const all = [...titleBodyRows, ...extraRows];
      let filtered = cat !== "all" ? all.filter((p) => p.category === cat) : all;

      if (filtered.length === 0) { setItems([]); setSearching(false); setLoading(false); return; }
      const userIds = Array.from(new Set(filtered.map((r) => r.user_id)));
      const { data: profs } = await supabase.from("profiles").select("id, username, display_name").in("id", userIds);
      const profById = new Map<string, Author>();
      for (const p of (profs ?? []) as Author[]) profById.set(p.id, p);
      const commentSet = new Set(commentPostIds);

      setItems(filtered.map((r) => ({
        ...r,
        author: profById.get(r.user_id) ?? null,
        match: titleMatch.has(r.id) ? "title" : bodyMatch.has(r.id) ? "body" : commentSet.has(r.id) ? "comment" : "title",
      })));
      setSearching(false);
      setLoading(false);
      return;
    }

    // 일반 리스트
    let list = supabase
      .from("community_posts")
      .select("id, user_id, category, title, body, like_count, comment_count, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (cat !== "all") list = list.eq("category", cat);
    const { data } = await list;
    const rows = (data ?? []) as unknown as Array<Omit<Post, "author">>;
    if (rows.length === 0) { setItems([]); setLoading(false); return; }
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profs } = await supabase.from("profiles").select("id, username, display_name").in("id", userIds);
    const profById = new Map<string, Author>();
    for (const p of (profs ?? []) as Author[]) profById.set(p.id, p);
    const blocked = await loadBlockedUserIds(session?.user.id);
    const visible = rows.filter((r) => !blocked.has(r.user_id));
    setItems(visible.map((r) => ({ ...r, author: profById.get(r.user_id) ?? null })));
    setLoading(false);
  }, [cat, q, session]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => { void load(); }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);
  useFocusEffect(useCallback(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []));

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="#a3a3a3" />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="제목 · 본문 · 댓글 검색"
          placeholderTextColor="#525252"
          autoCapitalize="none"
          returnKeyType="search"
          style={styles.searchInput}
        />
        {q.length > 0 && (
          <Pressable onPress={() => setQ("")} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#525252" />
          </Pressable>
        )}
      </View>
      <View style={styles.catRow}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.v}
            onPress={() => setCat(c.v as CatFilter)}
            style={({ pressed }) => [styles.catPill, cat === c.v && styles.catPillActive, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.catText, cat === c.v && styles.catTextActive]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#fbbf24" /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={40} color="#525252" />
          <Text style={styles.muted}>아직 게시글이 없어요.</Text>
          {session && (
            <Pressable onPress={() => router.push("/community/new" as never)}>
              <Text style={styles.link}>+ 첫 게시글 작성하기</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 96 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor="#fbbf24" />
          }
          renderItem={({ item: p }) => (
            <Pressable
              onPress={() => router.push(`/community/${p.id}` as never)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.cardHead}>
                <View style={[styles.catBadge, styles[`catBadge_${p.category}`]]}>
                  <Text style={[styles.catBadgeText, styles[`catBadgeText_${p.category}`]]}>
                    {CATEGORY_LABEL[p.category]}
                  </Text>
                </View>
                {p.match && (
                  <Text style={styles.matchTag}>
                    {p.match === "title" ? "제목 매칭" : p.match === "body" ? "본문 매칭" : "댓글 매칭"}
                  </Text>
                )}
                <Text style={styles.author} numberOfLines={1}>
                  {p.author?.display_name ?? p.author?.username ?? "익명"}
                </Text>
                <Text style={styles.time}>{p.created_at.slice(0, 10)}</Text>
                {isEdited(p.created_at, p.updated_at) && <Text style={styles.editedBadge}>수정됨</Text>}
              </View>
              <Text style={styles.title} numberOfLines={2}>{p.title}</Text>
              <Text style={styles.body} numberOfLines={2}>{p.body}</Text>
              <View style={styles.footer}>
                <View style={styles.metric}><Ionicons name="heart-outline" size={12} color="#a3a3a3" /><Text style={styles.metricText}>{p.like_count}</Text></View>
                <View style={styles.metric}><Ionicons name="chatbubble-outline" size={12} color="#a3a3a3" /><Text style={styles.metricText}>{p.comment_count}</Text></View>
              </View>
            </Pressable>
          )}
        />
      )}

      {session && (
        <Pressable onPress={() => router.push("/community/new" as never)} style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}>
          <Ionicons name="create-outline" size={26} color="#0a0a0a" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  muted: { color: "#737373", fontSize: 13 },
  link: { color: "#fbbf24", fontSize: 13, marginTop: 8, fontWeight: "600" },

  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 12, marginTop: 12,
    paddingHorizontal: 12,
    backgroundColor: "#171717", borderWidth: 1, borderColor: "#262626",
    borderRadius: 8,
  },
  searchInput: { flex: 1, color: "#fafafa", fontSize: 14, paddingVertical: 10 },
  matchTag: { color: "#fbbf24", fontSize: 10, fontStyle: "italic" },
  catRow: { flexDirection: "row", gap: 6, padding: 12, flexWrap: "wrap" },
  catPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: "#262626", backgroundColor: "#171717" },
  catPillActive: { borderColor: "#fbbf24", backgroundColor: "rgba(251, 191, 36, 0.1)" },
  catText: { color: "#a3a3a3", fontSize: 11 },
  catTextActive: { color: "#fbbf24", fontWeight: "600" },

  card: {
    backgroundColor: "#111",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 10, padding: 14, gap: 6,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catBadge_question: { backgroundColor: "rgba(59, 130, 246, 0.15)" },
  catBadge_recommendation: { backgroundColor: "rgba(251, 191, 36, 0.15)" },
  catBadge_tip: { backgroundColor: "rgba(16, 185, 129, 0.15)" },
  catBadge_free: { backgroundColor: "rgba(163, 163, 163, 0.15)" },
  catBadgeText: { fontSize: 10, fontWeight: "700" },
  catBadgeText_question: { color: "#93c5fd" },
  catBadgeText_recommendation: { color: "#fde68a" },
  catBadgeText_tip: { color: "#6ee7b7" },
  catBadgeText_free: { color: "#d4d4d4" },

  author: { color: "#a3a3a3", fontSize: 12, flex: 1 },
  time: { color: "#737373", fontSize: 10 },
  editedBadge: { color: "#737373", fontSize: 10, fontStyle: "italic" },

  title: { color: "#fafafa", fontSize: 15, fontWeight: "600", marginTop: 2 },
  body: { color: "#a3a3a3", fontSize: 13, lineHeight: 18 },

  footer: { flexDirection: "row", gap: 14, marginTop: 4 },
  metric: { flexDirection: "row", alignItems: "center", gap: 3 },
  metricText: { color: "#a3a3a3", fontSize: 11 },

  fab: {
    position: "absolute", right: 20, bottom: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#fbbf24",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#fbbf24", shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
