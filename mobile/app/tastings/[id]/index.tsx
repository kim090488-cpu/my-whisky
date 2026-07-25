import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  COUNTRY_FLAG, COUNTRY_LABEL, CASK_LABEL,
  formatAge, formatAbv,
} from "@/lib/format";
import { bottlingImageUrl, tastingPhotoUrl } from "@/lib/uploads";
import { isValidUuid } from "@/lib/params";
import type { WhiskyCountry, CaskType, TastingVisibility } from "@/types/database";
import { FlavorRadar } from "./_flavor-radar";
import { CommentsThread } from "./_comments-thread";
import { PhotoLightbox } from "./_photo-lightbox";
import { ReportButton } from "@/components/report-button";

type Tasting = {
  id: string;
  tasted_at: string;
  score: number | null;
  notes: string | null;
  color: string | null;
  photos: string[] | null;
  visibility: TastingVisibility;
  user_id: string;
  bottling_id: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  sweetness: number | null;
  smokiness: number | null;
  fruitiness: number | null;
  spiciness: number | null;
  smoothness: number | null;
  complexity: number | null;
  finish_length: number | null;
};

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
  age_years: number | null;
  abv: number | null;
  cask_type: CaskType | null;
  label_image_url: string | null;
  distillery: {
    id: string;
    name: string;
    name_kr: string | null;
    country: WhiskyCountry;
    region: string | null;
  } | null;
};

export default function TastingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();

  const [t, setT] = useState<Tasting | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bottling, setBottling] = useState<Bottling | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likePending, setLikePending] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    if (!isValidUuid(id)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setNotFound(false);

      const { data: raw } = await supabase
        .from("tastings")
        .select(
          "id, tasted_at, score, notes, color, photos, visibility, user_id, bottling_id, like_count, comment_count, created_at, sweetness, smokiness, fruitiness, spiciness, smoothness, complexity, finish_length",
        )
        .eq("id", id)
        .maybeSingle();
      if (!raw) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const tRow = raw as unknown as Tasting;
      setT(tRow);
      setLikeCount(tRow.like_count ?? 0);
      setCommentCount(tRow.comment_count ?? 0);

      const [profRes, bRes, myLikeRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("id", tRow.user_id)
          .maybeSingle(),
        supabase
          .from("bottlings")
          .select(
            "id, name, name_kr, age_years, abv, cask_type, label_image_url, distillery:distilleries(id, name, name_kr, country, region)",
          )
          .eq("id", tRow.bottling_id)
          .maybeSingle(),
        session
          ? supabase
              .from("tasting_likes")
              .select("id")
              .eq("user_id", session.user.id)
              .eq("tasting_id", tRow.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setProfile((profRes.data ?? null) as Profile | null);
      const b = bRes.data as unknown as Bottling | null;
      if (b && Array.isArray((b as unknown as { distillery: unknown }).distillery)) {
        b.distillery = ((b as unknown as { distillery: Bottling["distillery"][] }).distillery)[0] ?? null;
      }
      setBottling(b);
      setLiked(!!myLikeRes.data);
      setLoading(false);
    })();
  }, [id, session]);

  async function toggleLike() {
    if (!session) {
      router.push("/login" as never);
      return;
    }
    if (!t || likePending) return;

    const prev = { liked, count: likeCount };
    setLikePending(true);
    setLiked(!prev.liked);
    setLikeCount(prev.liked ? Math.max(0, prev.count - 1) : prev.count + 1);

    if (prev.liked) {
      const { error } = await supabase
        .from("tasting_likes")
        .delete()
        .eq("user_id", session.user.id)
        .eq("tasting_id", t.id);
      if (error) {
        setLiked(prev.liked);
        setLikeCount(prev.count);
      }
    } else {
      const { error } = await supabase
        .from("tasting_likes")
        .insert({ user_id: session.user.id, tasting_id: t.id });
      if (error) {
        setLiked(prev.liked);
        setLikeCount(prev.count);
      }
    }
    setLikePending(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fbbf24" />
      </View>
    );
  }
  if (notFound || !t) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>노트를 찾을 수 없어요.</Text>
      </View>
    );
  }

  const authorName = profile?.display_name ?? profile?.username ?? "익명";
  const initial = authorName.trim().charAt(0).toUpperCase();
  const d = bottling?.distillery ?? null;
  const bottlingThumb = bottling ? bottlingImageUrl(bottling.label_image_url) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ title: "노트" }} />

      {/* 작성자 헤더 */}
      <View style={styles.header}>
        <Pressable
          disabled={!profile?.username}
          onPress={() => profile?.username && router.push(`/profile/${profile.username}` as never)}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initial}</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Pressable
            disabled={!profile?.username}
            onPress={() => profile?.username && router.push(`/profile/${profile.username}` as never)}
          >
            <Text style={styles.authorName}>{authorName}</Text>
          </Pressable>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{t.tasted_at}</Text>
            {t.visibility !== "public" && (
              <View style={styles.visibilityPill}>
                <Text style={styles.visibilityText}>
                  {t.visibility === "private" ? "비공개" : "팔로워만"}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* 보틀링 카드 */}
      {bottling && (
        <Pressable
          onPress={() => router.push(`/whiskies/${bottling.id}` as never)}
          style={({ pressed }) => [styles.bottlingCard, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.bottlingThumb}>
            {bottlingThumb ? (
              <Image source={{ uri: bottlingThumb }} style={styles.bottlingImage} resizeMode="contain" />
            ) : (
              <Text style={styles.bottlingThumbEmpty}>사진 없음</Text>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            {d && (
              <Text style={styles.bottlingDistillery} numberOfLines={1}>
                {COUNTRY_FLAG[d.country]} {d.name_kr ?? d.name} · {d.region ?? COUNTRY_LABEL[d.country]}
              </Text>
            )}
            <Text style={styles.bottlingName} numberOfLines={2}>
              {bottling.name_kr ?? bottling.name}
            </Text>
            {bottling.name_kr && bottling.name_kr !== bottling.name && (
              <Text style={styles.bottlingSubName} numberOfLines={1}>{bottling.name}</Text>
            )}
            <Text style={styles.bottlingMeta}>
              {formatAge(bottling.age_years)} · {formatAbv(bottling.abv)}
              {bottling.cask_type && bottling.cask_type !== "unknown" &&
                ` · ${CASK_LABEL[bottling.cask_type]}`}
            </Text>
          </View>
          {t.score !== null && (
            <View style={styles.scoreBox}>
              <Text style={styles.scoreValue}>{t.score}</Text>
              <Text style={styles.scoreDenom}>/ 100</Text>
            </View>
          )}
        </Pressable>
      )}

      {/* 향미 프로필 */}
      {(t.sweetness !== null || t.smokiness !== null || t.fruitiness !== null ||
        t.spiciness !== null || t.smoothness !== null || t.complexity !== null ||
        t.finish_length !== null) && (
        <View style={styles.flavorCard}>
          <Text style={styles.flavorLabel}>향미 프로필</Text>
          <FlavorRadar
            values={{
              sweetness: t.sweetness,
              smokiness: t.smokiness,
              fruitiness: t.fruitiness,
              spiciness: t.spiciness,
              smoothness: t.smoothness,
              complexity: t.complexity,
              finish_length: t.finish_length,
            }}
          />
        </View>
      )}

      {/* 본문 */}
      <View style={styles.bodySection}>
        {t.color && (
          <View style={styles.block}>
            <Text style={styles.blockLabel}>색</Text>
            <Text style={styles.blockText}>{t.color}</Text>
          </View>
        )}
        {t.notes && (
          <View style={styles.block}>
            <Text style={styles.blockLabel}>후기</Text>
            <Text style={[styles.blockText, styles.blockNotes]}>{t.notes}</Text>
          </View>
        )}
        {!t.color && !t.notes && (
          <Text style={styles.muted}>본문 없는 노트.</Text>
        )}

        {t.photos && t.photos.length > 0 && (
          <View style={styles.photoGrid}>
            {t.photos.map((path, i) => {
              const url = tastingPhotoUrl(path);
              return url ? (
                <Pressable
                  key={path}
                  onPress={() => setLightboxIndex(i)}
                  style={styles.photoCell}
                >
                  <Image source={{ uri: url }} style={styles.photo} resizeMode="cover" />
                </Pressable>
              ) : null;
            })}
          </View>
        )}
      </View>

      {/* 액션 바 */}
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
          <Text style={[styles.likeCount, liked && styles.likeCountActive]}>{likeCount}</Text>
        </Pressable>
        <View style={styles.commentPill}>
          <Ionicons name="chatbubble-outline" size={16} color="#a3a3a3" />
          <Text style={styles.commentCount}>{commentCount}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {session?.user.id === t.user_id ? (
          <Pressable
            onPress={() => router.push(`/tastings/${t.id}/edit` as never)}
            hitSlop={4}
          >
            <Text style={styles.editLink}>수정</Text>
          </Pressable>
        ) : (
          <ReportButton
            targetTable="tasting"
            targetId={t.id}
            ownerId={t.user_id}
            currentUserId={session?.user.id ?? null}
            compact={false}
          />
        )}
      </View>

      {/* 댓글 스레드 */}
      <View style={styles.commentsSection}>
        <CommentsThread
          tastingId={t.id}
          initialCount={commentCount}
          currentUserId={session?.user.id ?? null}
          onCountChange={setCommentCount}
        />
      </View>

      {/* 사진 라이트박스 */}
      {t.photos && t.photos.length > 0 && (
        <PhotoLightbox
          visible={lightboxIndex !== null}
          urls={t.photos.map((p) => tastingPhotoUrl(p))}
          initialIndex={lightboxIndex ?? 0}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
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
  metaText: { color: "#737373", fontSize: 11 },
  visibilityPill: {
    backgroundColor: "#262626",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  visibilityText: { color: "#a3a3a3", fontSize: 10 },

  bottlingCard: {
    marginHorizontal: 12, marginTop: 12,
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 10, padding: 12,
  },
  bottlingThumb: {
    width: 60, height: 60, borderRadius: 6,
    backgroundColor: "#0a0a0a",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  bottlingImage: { width: "100%", height: "100%" },
  bottlingThumbEmpty: { color: "#525252", fontSize: 9 },
  bottlingDistillery: { color: "#737373", fontSize: 11 },
  bottlingName: { color: "#fafafa", fontSize: 14, fontWeight: "500", marginTop: 2 },
  bottlingSubName: { color: "#737373", fontSize: 10 },
  bottlingMeta: { color: "#737373", fontSize: 11, marginTop: 3 },
  scoreBox: { alignItems: "flex-end", minWidth: 44 },
  scoreValue: { color: "#fbbf24", fontSize: 24, fontWeight: "700", lineHeight: 26 },
  scoreDenom: { color: "#737373", fontSize: 9 },

  flavorCard: {
    marginHorizontal: 12, marginTop: 12,
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 10,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4,
    gap: 4,
  },
  flavorLabel: {
    color: "#737373", fontSize: 10, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.5,
  },

  bodySection: {
    paddingHorizontal: 16, paddingTop: 20, gap: 16,
  },
  block: { gap: 4 },
  blockLabel: {
    color: "#737373", fontSize: 10, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  blockText: { color: "#e5e5e5", fontSize: 14, lineHeight: 20 },
  blockNotes: { color: "#f5f5f5", fontSize: 15, lineHeight: 22 },

  photoGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4,
  },
  photoCell: {
    width: "32%", aspectRatio: 1,
    borderRadius: 6, overflow: "hidden",
    borderWidth: 1, borderColor: "#262626",
  },
  photo: { width: "100%", height: "100%" },

  actionBar: {
    flexDirection: "row", alignItems: "center", gap: 16,
    paddingHorizontal: 16, paddingTop: 20, marginTop: 12,
    borderTopWidth: 1, borderTopColor: "#171717",
    paddingBottom: 8,
  },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  likeCount: { color: "#a3a3a3", fontSize: 14, fontWeight: "500" },
  likeCountActive: { color: "#fbbf24" },
  commentPill: { flexDirection: "row", alignItems: "center", gap: 6 },
  commentCount: { color: "#a3a3a3", fontSize: 13 },

  commentsSection: {
    paddingHorizontal: 16, paddingTop: 20,
  },
  editLink: { color: "#a3a3a3", fontSize: 13 },
});
