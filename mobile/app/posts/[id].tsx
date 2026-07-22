import { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, Image,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { postPhotoUrl } from "@/lib/uploads";
import { COUNTRY_FLAG } from "@/lib/format";
import type { WhiskyCountry, TastingVisibility } from "@/types/database";
import { PhotoLightbox } from "../tastings/[id]/_photo-lightbox";

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
};

type Comment = {
  id: string;
  body: string;
  user_id: string;
  parent_id: string | null;
  created_at: string;
  author: Profile | null;
};

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();

  const [post, setPost] = useState<Post | null>(null);
  const [author, setAuthor] = useState<Profile | null>(null);
  const [bottling, setBottling] = useState<Bottling | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likePending, setLikePending] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadComments = useCallback(async (postId: string) => {
    const { data: rawComments } = await supabase
      .from("post_comments")
      .select("id, body, user_id, parent_id, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    const list = (rawComments ?? []) as unknown as Omit<Comment, "author">[];
    if (list.length === 0) {
      setComments([]);
      return;
    }
    const uIds = Array.from(new Set(list.map((c) => c.user_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", uIds);
    const byId = new Map<string, Profile>();
    for (const p of (profs ?? []) as Profile[]) byId.set(p.id, p);
    setComments(list.map((c) => ({ ...c, author: byId.get(c.user_id) ?? null })));
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setNotFound(false);

      const { data: raw } = await supabase
        .from("posts")
        .select(
          "id, user_id, body, photos, visibility, bottling_id, location_name, like_count, comment_count, created_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (!raw) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const p = raw as unknown as Post;
      setPost(p);
      setLikeCount(p.like_count ?? 0);

      const [profRes, botRes, likeRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("id", p.user_id)
          .maybeSingle(),
        p.bottling_id
          ? supabase
              .from("bottling_card_stats")
              .select("id, name, name_kr, distillery_name, distillery_name_kr, country")
              .eq("id", p.bottling_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        session
          ? supabase
              .from("post_likes")
              .select("id")
              .eq("user_id", session.user.id)
              .eq("post_id", p.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setAuthor((profRes.data ?? null) as Profile | null);
      const b = botRes.data as unknown as
        | { id: string | null; name: string; name_kr: string | null; distillery_name: string; distillery_name_kr: string | null; country: WhiskyCountry }
        | null;
      setBottling(b && b.id ? {
        id: b.id, name: b.name, name_kr: b.name_kr,
        distillery_name: b.distillery_name, distillery_name_kr: b.distillery_name_kr,
        country: b.country,
      } : null);
      setLiked(!!likeRes.data);

      await loadComments(p.id);
      setLoading(false);
    })();
  }, [id, session, loadComments]);

  async function toggleLike() {
    if (!session) {
      router.push("/login" as never);
      return;
    }
    if (!post || likePending) return;

    const prev = { liked, count: likeCount };
    setLikePending(true);
    setLiked(!prev.liked);
    setLikeCount(prev.liked ? Math.max(0, prev.count - 1) : prev.count + 1);

    if (prev.liked) {
      const { error } = await supabase
        .from("post_likes")
        .delete()
        .eq("user_id", session.user.id)
        .eq("post_id", post.id);
      if (error) { setLiked(prev.liked); setLikeCount(prev.count); }
    } else {
      const { error } = await supabase
        .from("post_likes")
        .insert({ user_id: session.user.id, post_id: post.id });
      if (error) { setLiked(prev.liked); setLikeCount(prev.count); }
    }
    setLikePending(false);
  }

  async function submitComment() {
    if (!session) {
      router.push("/login" as never);
      return;
    }
    if (!post) return;
    setCommentError(null);
    const text = commentBody.trim();
    if (!text || commentSubmitting) return;
    if (text.length > 1000) {
      setCommentError("1000자 이내로 작성해주세요.");
      return;
    }
    setCommentSubmitting(true);
    const { error } = await supabase.from("post_comments").insert({
      post_id: post.id,
      user_id: session.user.id,
      body: text,
    });
    if (error) {
      setCommentError(error.message);
      setCommentSubmitting(false);
      return;
    }
    setCommentBody("");
    setCommentSubmitting(false);
    await loadComments(post.id);
    setPost({ ...post, comment_count: post.comment_count + 1 });
  }

  function requestDeleteComment(commentId: string) {
    Alert.alert("댓글 삭제", "이 댓글을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => void doDeleteComment(commentId),
      },
    ]);
  }

  async function doDeleteComment(commentId: string) {
    if (!session || !post) return;
    const { error } = await supabase
      .from("post_comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", session.user.id);
    if (error) {
      Alert.alert("삭제 실패", error.message);
      return;
    }
    await loadComments(post.id);
    setPost({ ...post, comment_count: Math.max(0, post.comment_count - 1) });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fbbf24" />
      </View>
    );
  }
  if (notFound || !post) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>모먼트를 찾을 수 없어요.</Text>
      </View>
    );
  }

  const authorName = author?.display_name ?? author?.username ?? "익명";
  const initial = authorName.trim().charAt(0).toUpperCase();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0a0a0a" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "모먼트" }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* author header */}
        <View style={styles.header}>
          <Pressable
            disabled={!author?.username}
            onPress={() => author?.username && router.push(`/profile/${author.username}` as never)}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{initial}</Text>
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Pressable
              disabled={!author?.username}
              onPress={() => author?.username && router.push(`/profile/${author.username}` as never)}
            >
              <Text style={styles.authorName}>{authorName}</Text>
            </Pressable>
            <View style={styles.metaRow}>
              <Text style={styles.date}>{post.created_at.slice(0, 10)}</Text>
              {post.visibility !== "public" && (
                <View style={styles.visibilityPill}>
                  <Ionicons
                    name={post.visibility === "private" ? "lock-closed" : "people"}
                    size={9}
                    color="#a3a3a3"
                  />
                  <Text style={styles.visibilityText}>
                    {post.visibility === "private" ? "비공개" : "팔로워만"}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* photos */}
        {post.photos.length > 0 && (
          <View style={styles.photosBlock}>
            {post.photos.length === 1 ? (
              <Pressable onPress={() => setLightboxIndex(0)} style={styles.singlePhoto}>
                <Image
                  source={{ uri: postPhotoUrl(post.photos[0]) ?? undefined }}
                  style={styles.singlePhotoImg}
                  resizeMode="cover"
                />
              </Pressable>
            ) : (
              <View style={styles.photoGrid}>
                {post.photos.map((path, i) => {
                  const url = postPhotoUrl(path);
                  return url ? (
                    <Pressable
                      key={path}
                      onPress={() => setLightboxIndex(i)}
                      style={styles.photoCell}
                    >
                      <Image source={{ uri: url }} style={styles.photoImg} resizeMode="cover" />
                    </Pressable>
                  ) : null;
                })}
              </View>
            )}
          </View>
        )}

        {/* body */}
        {post.body && (
          <Text style={styles.body}>{post.body}</Text>
        )}

        {/* meta pills */}
        {(bottling || post.location_name) && (
          <View style={styles.pillRow}>
            {bottling && (
              <Pressable
                onPress={() => router.push(`/whiskies/${bottling.id}` as never)}
                style={styles.bottlingPill}
              >
                <Text style={styles.bottlingPillText} numberOfLines={1}>
                  🥃 {COUNTRY_FLAG[bottling.country]}{" "}
                  {bottling.distillery_name_kr ?? bottling.distillery_name} · {bottling.name_kr ?? bottling.name}
                </Text>
              </Pressable>
            )}
            {post.location_name && (
              <View style={styles.locationPill}>
                <Ionicons name="location-outline" size={11} color="#a3a3a3" />
                <Text style={styles.locationText}>{post.location_name}</Text>
              </View>
            )}
          </View>
        )}

        {/* actions */}
        <View style={styles.actionBar}>
          <Pressable
            onPress={toggleLike}
            disabled={likePending}
            style={({ pressed }) => [styles.likeBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={22}
              color={liked ? "#fbbf24" : "#a3a3a3"}
            />
            <Text style={[styles.likeCount, liked && { color: "#fbbf24" }]}>{likeCount}</Text>
          </Pressable>
          <View style={styles.commentPill}>
            <Ionicons name="chatbubble-outline" size={16} color="#a3a3a3" />
            <Text style={styles.commentCount}>{post.comment_count}</Text>
          </View>
        </View>

        {/* comments */}
        <View style={styles.commentsSection}>
          {session ? (
            <View style={styles.composer}>
              <View style={styles.composerRow}>
                <TextInput
                  value={commentBody}
                  onChangeText={setCommentBody}
                  multiline
                  maxLength={1000}
                  placeholder="댓글 작성…"
                  placeholderTextColor="#525252"
                  style={styles.textInput}
                />
                <Pressable
                  onPress={submitComment}
                  disabled={commentSubmitting || !commentBody.trim()}
                  style={({ pressed }) => [
                    styles.submitBtn,
                    (commentSubmitting || !commentBody.trim()) && { opacity: 0.5 },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.submitBtnText}>
                    {commentSubmitting ? "…" : "등록"}
                  </Text>
                </Pressable>
              </View>
              {commentError && <Text style={styles.errorText}>{commentError}</Text>}
            </View>
          ) : (
            <Pressable onPress={() => router.push("/login" as never)}>
              <Text style={styles.loginCta}>
                <Text style={styles.loginCtaLink}>로그인</Text>
                <Text> 후 댓글을 작성할 수 있어요.</Text>
              </Text>
            </Pressable>
          )}

          <Text style={styles.commentHeader}>
            댓글 <Text style={styles.commentHeaderCount}>{post.comment_count}</Text>
          </Text>

          {comments.length === 0 ? (
            <Text style={styles.empty}>첫 댓글을 남겨보세요.</Text>
          ) : (
            <View style={{ gap: 14 }}>
              {comments.map((c) => {
                const name = c.author?.display_name ?? c.author?.username ?? "익명";
                const cInitial = name.trim().charAt(0).toUpperCase();
                const isOwn = c.user_id === session?.user.id;
                const canPush = !!c.author?.username;
                return (
                  <View key={c.id} style={styles.commentItem}>
                    <Pressable
                      disabled={!canPush}
                      onPress={() => canPush && router.push(`/profile/${c.author!.username}` as never)}
                      style={styles.commentAvatar}
                    >
                      <Text style={styles.commentAvatarText}>{cInitial}</Text>
                    </Pressable>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.commentHead}>
                        <Pressable
                          disabled={!canPush}
                          onPress={() => canPush && router.push(`/profile/${c.author!.username}` as never)}
                          hitSlop={4}
                        >
                          <Text style={styles.commentAuthor}>{name}</Text>
                        </Pressable>
                        <Text style={styles.commentTime}>{c.created_at.slice(0, 10)}</Text>
                      </View>
                      <Text style={styles.commentBody}>{c.body}</Text>
                      {isOwn && (
                        <View style={styles.commentActions}>
                          <Pressable onPress={() => requestDeleteComment(c.id)} hitSlop={4}>
                            <Text style={styles.actionDelete}>삭제</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Lightbox */}
      {post.photos.length > 0 && (
        <PhotoLightbox
          visible={lightboxIndex !== null}
          urls={post.photos.map((p) => postPhotoUrl(p))}
          initialIndex={lightboxIndex ?? 0}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#0a0a0a", padding: 24,
  },
  muted: { color: "#737373", fontSize: 13, textAlign: "center" },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(180, 83, 9, 0.3)",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fde68a", fontSize: 18, fontWeight: "600" },
  authorName: { color: "#fafafa", fontSize: 15, fontWeight: "600" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  date: { color: "#737373", fontSize: 11 },
  visibilityPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#262626",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  visibilityText: { color: "#a3a3a3", fontSize: 10 },

  photosBlock: { paddingHorizontal: 16, paddingTop: 12 },
  singlePhoto: {
    width: "100%", height: 320, borderRadius: 8, overflow: "hidden",
    borderWidth: 1, borderColor: "#262626", backgroundColor: "#0a0a0a",
  },
  singlePhotoImg: { width: "100%", height: "100%" },
  photoGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
  },
  photoCell: {
    width: "32.5%", aspectRatio: 1,
    borderRadius: 6, overflow: "hidden",
    borderWidth: 1, borderColor: "#262626",
  },
  photoImg: { width: "100%", height: "100%" },

  body: {
    color: "#f5f5f5", fontSize: 15, lineHeight: 22,
    paddingHorizontal: 16, paddingTop: 14,
  },

  pillRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
    paddingHorizontal: 16, paddingTop: 12,
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

  actionBar: {
    flexDirection: "row", alignItems: "center", gap: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    marginTop: 14,
    borderTopWidth: 1, borderTopColor: "#171717",
    borderBottomWidth: 1, borderBottomColor: "#171717",
  },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  likeCount: { color: "#a3a3a3", fontSize: 14, fontWeight: "500" },
  commentPill: { flexDirection: "row", alignItems: "center", gap: 6 },
  commentCount: { color: "#a3a3a3", fontSize: 13 },

  commentsSection: { paddingHorizontal: 16, paddingTop: 16 },
  composer: {
    marginBottom: 16,
    backgroundColor: "#0a0a0a",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 8, padding: 10,
  },
  composerRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  textInput: {
    flex: 1,
    color: "#f5f5f5", fontSize: 14,
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    minHeight: 44, maxHeight: 120,
    textAlignVertical: "top",
  },
  submitBtn: {
    backgroundColor: "#fbbf24",
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 6,
  },
  submitBtnText: { color: "#0a0a0a", fontSize: 12, fontWeight: "600" },
  errorText: { color: "#fca5a5", fontSize: 11, marginTop: 6 },

  loginCta: { color: "#a3a3a3", fontSize: 12, marginBottom: 16 },
  loginCtaLink: { color: "#fbbf24" },

  commentHeader: {
    color: "#a3a3a3", fontSize: 12, fontWeight: "600",
    marginBottom: 10,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  commentHeaderCount: { color: "#fbbf24" },
  empty: { color: "#525252", fontSize: 12, paddingVertical: 8 },

  commentItem: { flexDirection: "row", gap: 10 },
  commentAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(180, 83, 9, 0.3)",
    alignItems: "center", justifyContent: "center",
  },
  commentAvatarText: { color: "#fde68a", fontSize: 12, fontWeight: "600" },
  commentHead: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  commentAuthor: { color: "#fafafa", fontSize: 12, fontWeight: "600" },
  commentTime: { color: "#525252", fontSize: 10 },
  commentBody: { color: "#e5e5e5", fontSize: 13, lineHeight: 19, marginTop: 2 },
  commentActions: {
    flexDirection: "row", gap: 12, marginTop: 4,
  },
  actionDelete: { color: "#fca5a5", fontSize: 11 },
});
