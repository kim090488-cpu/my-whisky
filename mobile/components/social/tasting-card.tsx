import { useEffect, useState } from "react";
import {
  View, Text, Image, Pressable, StyleSheet, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { tastingPhotoUrl } from "@/lib/uploads";
import { CommentsThread } from "@/app/tastings/[id]/_comments-thread";
import type { TastingVisibility } from "@/types/database";

export type TastingCardData = {
  id: string;
  tasted_at: string;
  score: number | null;
  notes: string | null;
  visibility: TastingVisibility;
  user_id: string;
  like_count: number;
  comment_count: number;
  photos: string[] | null;
  profile: { username: string; display_name: string | null } | null;
};

type Props = {
  tasting: TastingCardData;
  currentUserId: string | null;
};

export function TastingCard({ tasting: t, currentUserId }: Props) {
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(t.like_count);
  const [commentCount, setCommentCount] = useState(t.comment_count);
  const [likePending, setLikePending] = useState(false);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    if (!currentUserId) {
      setLiked(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("tasting_likes")
        .select("id")
        .eq("tasting_id", t.id)
        .eq("user_id", currentUserId)
        .maybeSingle();
      setLiked(!!data);
    })();
  }, [t.id, currentUserId]);

  async function toggleLike() {
    if (!currentUserId) {
      router.push("/(tabs)/me" as never);
      return;
    }
    if (likePending) return;

    const prev = { liked, count: likeCount };
    setLikePending(true);
    setLiked(!prev.liked);
    setLikeCount(prev.liked ? Math.max(0, prev.count - 1) : prev.count + 1);

    const op = prev.liked
      ? supabase.from("tasting_likes").delete().eq("user_id", currentUserId).eq("tasting_id", t.id)
      : supabase.from("tasting_likes").insert({ user_id: currentUserId, tasting_id: t.id });
    const { error } = await op;
    if (error) {
      setLiked(prev.liked);
      setLikeCount(prev.count);
    }
    setLikePending(false);
  }

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => t.profile?.username && router.push(`/profile/${t.profile.username}` as never)}
          style={{ flex: 1 }}
          hitSlop={6}
        >
          <Text style={styles.author} numberOfLines={1}>
            <Text style={styles.authorName}>
              {t.profile?.display_name ?? t.profile?.username ?? "익명"}
            </Text>
            {"  "}
            <Text style={styles.date}>· {t.tasted_at}</Text>
            {t.user_id === currentUserId && (
              <Text style={styles.myNoteBadge}>  내 노트</Text>
            )}
            {t.visibility !== "public" && (
              <Text style={styles.visibilityBadge}>
                {"  "}{t.visibility === "private" ? "비공개" : "팔로워만"}
              </Text>
            )}
          </Text>
        </Pressable>
        {t.score !== null && <Text style={styles.score}>{t.score}</Text>}
      </View>

      <Pressable
        onPress={() => router.push(`/tastings/${t.id}` as never)}
        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
      >
        {t.notes && <Text style={styles.notes}>{t.notes}</Text>}
        {t.photos && t.photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
            {t.photos.map((p) => {
              const url = tastingPhotoUrl(p);
              return url ? (
                <Image key={p} source={{ uri: url }} style={styles.photo} />
              ) : null;
            })}
          </ScrollView>
        )}
      </Pressable>

      <View style={styles.actionRow}>
        <Pressable
          onPress={toggleLike}
          disabled={likePending}
          hitSlop={8}
          style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.actionIcon, liked && styles.actionIconActive]}>
            {liked ? "♥" : "♡"}
          </Text>
          <Text style={styles.actionCount}>{likeCount}</Text>
        </Pressable>

        <Pressable
          onPress={() => setShowComments((v) => !v)}
          hitSlop={8}
          style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{commentCount}</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push(`/tastings/${t.id}` as never)}
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.detailLink}>자세히 →</Text>
        </Pressable>
      </View>

      {showComments && (
        <View style={styles.commentsInline}>
          <CommentsThread
            tastingId={t.id}
            initialCount={commentCount}
            currentUserId={currentUserId}
            onCountChange={setCommentCount}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 10, padding: 14, gap: 8,
  },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  author: { fontSize: 12, color: "#a3a3a3" },
  authorName: { color: "#fafafa", fontSize: 13, fontWeight: "600" },
  date: { color: "#737373", fontSize: 11 },
  myNoteBadge: { color: "#fbbf24", fontSize: 10 },
  visibilityBadge: { color: "#525252", fontSize: 10 },
  score: { color: "#fbbf24", fontSize: 22, fontWeight: "700", minWidth: 44, textAlign: "right" },
  notes: { color: "#e5e5e5", fontSize: 13, lineHeight: 19, marginTop: 4 },
  photoStrip: { marginTop: 8 },
  photo: { width: 80, height: 80, borderRadius: 6, marginRight: 6, backgroundColor: "#262626" },
  actionRow: {
    flexDirection: "row", alignItems: "center", gap: 16,
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: "#262626",
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionIcon: { fontSize: 16, color: "#a3a3a3" },
  actionIconActive: { color: "#f43f5e" },
  actionCount: { fontSize: 12, color: "#a3a3a3" },
  detailLink: { fontSize: 11, color: "#fbbf24", marginLeft: "auto" },
  commentsInline: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: "#262626",
  },
});
