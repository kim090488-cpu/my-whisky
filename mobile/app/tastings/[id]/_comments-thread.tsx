import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { ReportButton } from "@/components/report-button";

export type Comment = {
  id: string;
  body: string;
  parent_id: string | null;
  user_id: string;
  created_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type Props = {
  tastingId: string;
  initialCount: number;
  currentUserId: string | null;
  onCountChange?: (next: number) => void;
};

export function CommentsThread({
  tastingId, initialCount, currentUserId, onCountChange,
}: Props) {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tastingId]);

  async function load() {
    setLoading(true);
    const { data: rows } = await supabase
      .from("tasting_comments")
      .select("id, body, parent_id, user_id, created_at")
      .eq("tasting_id", tastingId)
      .order("created_at", { ascending: true });

    const list = (rows ?? []) as unknown as Omit<Comment, "profile">[];
    const userIds = Array.from(new Set(list.map((c) => c.user_id)));
    const profById = new Map<string, Comment["profile"]>();
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", userIds);
      for (const p of (profs ?? []) as NonNullable<Comment["profile"]>[]) {
        profById.set(p.id, p);
      }
    }
    setComments(
      list.map((c) => ({
        ...c,
        profile: profById.get(c.user_id) ?? null,
      })),
    );
    setLoading(false);
  }

  function updateCount(next: number) {
    setCount(next);
    onCountChange?.(next);
  }

  async function submit() {
    if (!currentUserId) {
      router.push("/login" as never);
      return;
    }
    setError(null);
    const text = body.trim();
    if (!text || submitting) return;
    if (text.length > 1000) {
      setError("1000자 이내로 작성해주세요.");
      return;
    }
    setSubmitting(true);

    const { error: insertError } = await supabase
      .from("tasting_comments")
      .insert({
        tasting_id: tastingId,
        user_id: currentUserId,
        body: text,
        parent_id: replyTo?.id ?? null,
      });
    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }
    setBody("");
    setReplyTo(null);
    setSubmitting(false);
    await load();
    updateCount(count + 1);
  }

  function requestDelete(commentId: string) {
    Alert.alert("댓글 삭제", "이 댓글을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => void doDelete(commentId),
      },
    ]);
  }

  async function doDelete(commentId: string) {
    if (!currentUserId) return;
    const { error: delError } = await supabase
      .from("tasting_comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", currentUserId);
    if (delError) {
      Alert.alert("삭제 실패", delError.message);
      return;
    }
    await load();
    updateCount(Math.max(0, count - 1));
  }

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesOf = (parentId: string) =>
    comments.filter((c) => c.parent_id === parentId);

  return (
    <View>
      {/* Composer */}
      {currentUserId ? (
        <View style={styles.composer}>
          {replyTo && (
            <View style={styles.replyBadge}>
              <Text style={styles.replyBadgeText}>
                {replyTo.profile?.display_name ?? replyTo.profile?.username ?? "사용자"} 님께 답글
              </Text>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                <Text style={styles.replyBadgeClose}>×</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.composerRow}>
            <TextInput
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={1000}
              placeholder={replyTo ? "답글 작성…" : "댓글 작성…"}
              placeholderTextColor="#525252"
              style={styles.textInput}
            />
            <Pressable
              onPress={submit}
              disabled={submitting || !body.trim()}
              style={({ pressed }) => [
                styles.submitBtn,
                (submitting || !body.trim()) && styles.submitBtnDisabled,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.submitBtnText}>
                {submitting ? "…" : "등록"}
              </Text>
            </Pressable>
          </View>
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      ) : (
        <Pressable onPress={() => router.push("/login" as never)}>
          <Text style={styles.loginCta}>
            <Text style={styles.loginCtaLink}>로그인</Text>
            <Text> 후 댓글을 작성할 수 있어요.</Text>
          </Text>
        </Pressable>
      )}

      {/* Header */}
      <Text style={styles.header}>
        댓글 <Text style={styles.headerCount}>{count}</Text>
      </Text>

      {/* List */}
      {loading && comments.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color="#a3a3a3" size="small" />
        </View>
      ) : topLevel.length === 0 ? (
        <Text style={styles.empty}>첫 댓글을 남겨보세요.</Text>
      ) : (
        <View style={{ gap: 14 }}>
          {topLevel.map((c) => (
            <View key={c.id}>
              <CommentItem
                c={c}
                isOwn={c.user_id === currentUserId}
                onDelete={() => requestDelete(c.id)}
                onReply={currentUserId ? () => setReplyTo(c) : undefined}
                currentUserId={currentUserId}
                router={router}
              />
              {repliesOf(c.id).length > 0 && (
                <View style={styles.repliesWrap}>
                  {repliesOf(c.id).map((r) => (
                    <CommentItem
                      key={r.id}
                      c={r}
                      isOwn={r.user_id === currentUserId}
                      onDelete={() => requestDelete(r.id)}
                      currentUserId={currentUserId}
                      router={router}
                    />
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function CommentItem({
  c, isOwn, onDelete, onReply, currentUserId, router,
}: {
  c: Comment;
  isOwn: boolean;
  onDelete: () => void;
  onReply?: () => void;
  currentUserId: string | null;
  router: ReturnType<typeof useRouter>;
}) {
  const name = c.profile?.display_name ?? c.profile?.username ?? "익명";
  const initial = name.trim().charAt(0).toUpperCase();
  const canPushProfile = !!c.profile?.username;

  return (
    <View style={styles.item}>
      <Pressable
        disabled={!canPushProfile}
        onPress={() => canPushProfile && router.push(`/profile/${c.profile!.username}` as never)}
        style={styles.avatar}
      >
        <Text style={styles.avatarText}>{initial}</Text>
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.itemHead}>
          <Pressable
            disabled={!canPushProfile}
            onPress={() => canPushProfile && router.push(`/profile/${c.profile!.username}` as never)}
            hitSlop={4}
          >
            <Text style={styles.author}>{name}</Text>
          </Pressable>
          <Text style={styles.time}>{formatTime(c.created_at)}</Text>
        </View>
        <Text style={styles.body}>{c.body}</Text>
        <View style={styles.actions}>
          {onReply && (
            <Pressable onPress={onReply} hitSlop={4}>
              <Text style={styles.actionText}>답글</Text>
            </Pressable>
          )}
          {isOwn && (
            <Pressable onPress={onDelete} hitSlop={4}>
              <Text style={[styles.actionText, styles.actionDelete]}>삭제</Text>
            </Pressable>
          )}
          <ReportButton
            targetTable="comment"
            targetId={c.id}
            ownerId={c.user_id}
            currentUserId={currentUserId}
          />
        </View>
      </View>
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  return d.toISOString().slice(0, 10);
}

const styles = StyleSheet.create({
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
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: "#0a0a0a", fontSize: 12, fontWeight: "600" },
  errorText: { color: "#fca5a5", fontSize: 11, marginTop: 6 },

  replyBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 4,
    marginBottom: 6,
  },
  replyBadgeText: { color: "#fde68a", fontSize: 11 },
  replyBadgeClose: { color: "#fbbf24", fontSize: 16, paddingHorizontal: 4 },

  loginCta: {
    color: "#a3a3a3", fontSize: 12,
    marginBottom: 16,
  },
  loginCtaLink: { color: "#fbbf24" },

  header: {
    color: "#a3a3a3", fontSize: 12, fontWeight: "600",
    marginBottom: 10,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  headerCount: { color: "#fbbf24" },

  center: { alignItems: "center", paddingVertical: 12 },
  empty: { color: "#525252", fontSize: 12, paddingVertical: 8 },

  item: { flexDirection: "row", gap: 10 },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(180, 83, 9, 0.3)",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fde68a", fontSize: 12, fontWeight: "600" },
  itemHead: {
    flexDirection: "row", alignItems: "baseline", gap: 8,
  },
  author: { color: "#fafafa", fontSize: 12, fontWeight: "600" },
  time: { color: "#525252", fontSize: 10 },
  body: {
    color: "#e5e5e5", fontSize: 13, lineHeight: 19, marginTop: 2,
  },
  actions: {
    flexDirection: "row", gap: 12, marginTop: 4,
  },
  actionText: { color: "#737373", fontSize: 11 },
  actionDelete: { color: "#fca5a5" },

  repliesWrap: {
    marginLeft: 40, marginTop: 10, gap: 10,
    borderLeftWidth: 2, borderLeftColor: "#262626",
    paddingLeft: 10,
  },
});
