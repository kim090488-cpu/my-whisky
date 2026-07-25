import { useCallback, useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { isEdited } from "@/lib/format";
import { isValidUuid } from "@/lib/params";

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
type Comment = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author: Author | null;
};

const CATEGORY_LABEL: Record<Post["category"], string> = {
  question: "질문", recommendation: "추천", tip: "팁", free: "잡담",
};

export default function CommunityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [liked, setLiked] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentPending, setCommentPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!id || !isValidUuid(id)) { setNotFound(true); setLoading(false); return; }
    const { data: pRaw } = await supabase
      .from("community_posts")
      .select("id, user_id, category, title, body, like_count, comment_count, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();
    const p = pRaw as unknown as Omit<Post, "author"> | null;
    if (!p) { setNotFound(true); setLoading(false); return; }

    const [authorRes, commentsRes, likedRes] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name").eq("id", p.user_id).maybeSingle(),
      supabase.from("community_post_comments").select("id, user_id, body, created_at, updated_at").eq("post_id", id).order("created_at", { ascending: true }),
      session
        ? supabase.from("community_post_likes").select("id").eq("user_id", session.user.id).eq("post_id", id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setPost({ ...p, author: (authorRes.data as Author | null) ?? null });
    setLiked(!!likedRes.data);

    const cRows = (commentsRes.data ?? []) as unknown as Array<Omit<Comment, "author">>;
    if (cRows.length === 0) { setComments([]); setLoading(false); return; }
    const cUserIds = Array.from(new Set(cRows.map((c) => c.user_id)));
    const { data: cAuthors } = await supabase.from("profiles").select("id, username, display_name").in("id", cUserIds);
    const cById = new Map<string, Author>();
    for (const a of (cAuthors ?? []) as Author[]) cById.set(a.id, a);
    setComments(cRows.map((c) => ({ ...c, author: cById.get(c.user_id) ?? null })));
    setLoading(false);
  }, [id, session]);

  useEffect(() => { void load(); }, [load]);

  async function toggleLike() {
    if (!session) { router.push("/(tabs)/me" as never); return; }
    if (!post || likePending) return;
    const prev = { liked, count: post.like_count };
    setLikePending(true);
    setLiked(!prev.liked);
    setPost({ ...post, like_count: prev.liked ? Math.max(0, prev.count - 1) : prev.count + 1 });
    if (prev.liked) {
      const { error } = await supabase.from("community_post_likes").delete()
        .eq("post_id", post.id).eq("user_id", session.user.id);
      if (error) { setLiked(prev.liked); setPost({ ...post, like_count: prev.count }); }
    } else {
      const { error } = await supabase.from("community_post_likes")
        .insert({ post_id: post.id, user_id: session.user.id });
      if (error) { setLiked(prev.liked); setPost({ ...post, like_count: prev.count }); }
    }
    setLikePending(false);
  }

  async function submitComment() {
    if (!session || !post || commentPending) return;
    const text = commentBody.trim();
    if (!text) return;
    if (text.length > 2000) return Alert.alert("길이 초과", "2000자 이내로 작성해주세요.");
    setCommentPending(true);
    const { error } = await supabase.from("community_post_comments")
      .insert({ post_id: post.id, user_id: session.user.id, body: text });
    setCommentPending(false);
    if (error) return Alert.alert("실패", error.message);
    setCommentBody("");
    await load();
  }

  async function deleteComment(commentId: string) {
    if (!session) return;
    Alert.alert("댓글 삭제", "이 댓글을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive", onPress: async () => {
          const { error } = await supabase.from("community_post_comments")
            .delete().eq("id", commentId).eq("user_id", session.user.id);
          if (error) return Alert.alert("실패", error.message);
          await load();
        },
      },
    ]);
  }

  async function deletePost() {
    if (!session || !post) return;
    Alert.alert("게시글 삭제", "이 게시글을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive", onPress: async () => {
          const { error } = await supabase.from("community_posts")
            .delete().eq("id", post.id).eq("user_id", session.user.id);
          if (error) return Alert.alert("실패", error.message);
          router.back();
        },
      },
    ]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#fbbf24" /></View>;
  if (notFound || !post) return (
    <View style={styles.center}>
      <Ionicons name="alert-circle-outline" size={40} color="#525252" />
      <Text style={styles.muted}>게시글을 찾을 수 없어요.</Text>
    </View>
  );

  const authorName = post.author?.display_name ?? post.author?.username ?? "익명";
  const isOwn = post.user_id === session?.user.id;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#0a0a0a" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: "게시글" }} />
      <KeyboardAwareScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" enableOnAndroid extraScrollHeight={80}>
        <View style={styles.header}>
          <View style={styles.headTopRow}>
            <View style={[styles.catBadge, styles[`catBadge_${post.category}`]]}>
              <Text style={[styles.catBadgeText, styles[`catBadgeText_${post.category}`]]}>{CATEGORY_LABEL[post.category]}</Text>
            </View>
            {isOwn && (
              <View style={styles.ownActions}>
                <Pressable onPress={() => router.push(`/community/new?edit=${post.id}` as never)} hitSlop={6}>
                  <Text style={styles.ownActionText}>수정</Text>
                </Pressable>
                <Pressable onPress={deletePost} hitSlop={6}>
                  <Text style={[styles.ownActionText, { color: "#f43f5e" }]}>삭제</Text>
                </Pressable>
              </View>
            )}
          </View>
          <Text style={styles.title}>{post.title}</Text>
          <View style={styles.metaRow}>
            <Pressable onPress={() => post.author?.username && router.push(`/profile/${post.author.username}` as never)} hitSlop={4}>
              <Text style={styles.author}>{authorName}</Text>
            </Pressable>
            <Text style={styles.time}>· {post.created_at.slice(0, 10)}</Text>
            {isEdited(post.created_at, post.updated_at) && <Text style={styles.editedBadge}>수정됨</Text>}
          </View>
        </View>

        <Text style={styles.body}>{post.body}</Text>

        <View style={styles.actionRow}>
          <Pressable onPress={toggleLike} disabled={likePending} hitSlop={8} style={styles.likeBtn}>
            <Ionicons name={liked ? "heart" : "heart-outline"} size={22} color={liked ? "#f43f5e" : "#fafafa"} />
            <Text style={styles.likeText}>{post.like_count}</Text>
          </Pressable>
          <View style={styles.metric}>
            <Ionicons name="chatbubble-outline" size={18} color="#a3a3a3" />
            <Text style={styles.metricText}>{post.comment_count}</Text>
          </View>
        </View>

        {/* Comments */}
        <View style={styles.commentsSection}>
          <Text style={styles.sectionTitle}>댓글 {post.comment_count}</Text>
          {session ? (
            <View style={styles.composer}>
              <TextInput
                value={commentBody}
                onChangeText={setCommentBody}
                multiline
                maxLength={2000}
                placeholder="댓글 작성…"
                placeholderTextColor="#525252"
                style={styles.commentInput}
              />
              <Pressable
                onPress={submitComment}
                disabled={commentPending || !commentBody.trim()}
                style={({ pressed }) => [
                  styles.commentSubmit,
                  (commentPending || !commentBody.trim()) && { opacity: 0.5 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.commentSubmitText}>{commentPending ? "…" : "등록"}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => router.push("/(tabs)/me" as never)}>
              <Text style={styles.loginCta}>
                <Text style={{ color: "#fbbf24" }}>로그인</Text> 후 댓글 작성 가능
              </Text>
            </Pressable>
          )}

          {comments.length === 0 ? (
            <Text style={styles.emptyComment}>첫 댓글을 남겨보세요.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {comments.map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  <View style={styles.commentHead}>
                    <Pressable onPress={() => c.author?.username && router.push(`/profile/${c.author.username}` as never)} hitSlop={4}>
                      <Text style={styles.commentAuthor}>{c.author?.display_name ?? c.author?.username ?? "익명"}</Text>
                    </Pressable>
                    <Text style={styles.commentTime}>{c.created_at.slice(0, 10)}</Text>
                    {c.user_id === session?.user.id && (
                      <Pressable onPress={() => deleteComment(c.id)} hitSlop={4}>
                        <Text style={styles.commentDelete}>삭제</Text>
                      </Pressable>
                    )}
                  </View>
                  <Text style={styles.commentBody}>{c.body}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a", padding: 24, gap: 10 },
  muted: { color: "#737373", textAlign: "center" },

  header: { padding: 16, gap: 8 },
  headTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  catBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start" },
  catBadge_question: { backgroundColor: "rgba(59, 130, 246, 0.15)" },
  catBadge_recommendation: { backgroundColor: "rgba(251, 191, 36, 0.15)" },
  catBadge_tip: { backgroundColor: "rgba(16, 185, 129, 0.15)" },
  catBadge_free: { backgroundColor: "rgba(163, 163, 163, 0.15)" },
  catBadgeText: { fontSize: 11, fontWeight: "700" },
  catBadgeText_question: { color: "#93c5fd" },
  catBadgeText_recommendation: { color: "#fde68a" },
  catBadgeText_tip: { color: "#6ee7b7" },
  catBadgeText_free: { color: "#d4d4d4" },
  ownActions: { flexDirection: "row", gap: 12 },
  ownActionText: { color: "#a3a3a3", fontSize: 12 },

  title: { color: "#fafafa", fontSize: 20, fontWeight: "700", lineHeight: 26 },
  metaRow: { flexDirection: "row", gap: 6, alignItems: "baseline" },
  author: { color: "#fbbf24", fontSize: 12, fontWeight: "600" },
  time: { color: "#737373", fontSize: 11 },
  editedBadge: { color: "#737373", fontSize: 10, fontStyle: "italic" },

  body: { color: "#e5e5e5", fontSize: 14, lineHeight: 22, padding: 16, paddingTop: 0 },

  actionRow: { flexDirection: "row", gap: 20, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#171717" },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  likeText: { color: "#fafafa", fontSize: 14, fontWeight: "500" },
  metric: { flexDirection: "row", alignItems: "center", gap: 6 },
  metricText: { color: "#a3a3a3", fontSize: 14 },

  commentsSection: { padding: 16, gap: 12 },
  sectionTitle: { color: "#a3a3a3", fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },

  composer: {
    borderWidth: 1, borderColor: "#262626", backgroundColor: "#111",
    borderRadius: 8, padding: 10, flexDirection: "row", gap: 8, alignItems: "flex-end",
  },
  commentInput: {
    flex: 1,
    color: "#fafafa", fontSize: 14,
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8,
    minHeight: 44, maxHeight: 120, textAlignVertical: "top",
  },
  commentSubmit: { backgroundColor: "#fbbf24", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 6 },
  commentSubmitText: { color: "#0a0a0a", fontSize: 12, fontWeight: "700" },
  loginCta: { color: "#a3a3a3", fontSize: 12, textAlign: "center", paddingVertical: 10 },
  emptyComment: { color: "#525252", fontSize: 12, textAlign: "center", paddingVertical: 12 },

  commentItem: { backgroundColor: "#111", borderWidth: 1, borderColor: "#262626", borderRadius: 8, padding: 12, gap: 4 },
  commentHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  commentAuthor: { color: "#fafafa", fontSize: 12, fontWeight: "600" },
  commentTime: { color: "#737373", fontSize: 10, flex: 1 },
  commentDelete: { color: "#fca5a5", fontSize: 11 },
  commentBody: { color: "#e5e5e5", fontSize: 13, lineHeight: 19 },
});
