import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, Image,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { COUNTRY_FLAG, formatAge, formatAbv } from "@/lib/format";
import type { WhiskyCountry, TastingVisibility } from "@/types/database";

type TrendingItem = {
  id: string;
  bottling_id: string;
  user_id: string;
  score: number | null;
  tasted_at: string;
  like_count: number;
  comment_count: number;
  recent_likes: number;
  notes: string | null;
  visibility: TastingVisibility;
};

type Bottling = {
  id: string;
  name: string;
  name_kr: string | null;
  distillery_name: string;
  distillery_name_kr: string | null;
  country: WhiskyCountry;
};

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Reviewer = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number;
  public_note_count: number;
  total_likes_received: number;
  avg_score: number | null;
};

type PopularDistillery = {
  id: string;
  name: string;
  name_kr: string | null;
  country: WhiskyCountry;
  region: string | null;
  note_count: number;
  avg_score: number | null;
};

type PopularBottling = {
  id: string;
  name: string;
  name_kr: string | null;
  age_years: number | null;
  abv: number | null;
  distillery_name: string;
  distillery_name_kr: string | null;
  country: WhiskyCountry;
  region: string | null;
  avg_score: number | null;
  tasting_count: number;
};

const SEGMENT_LIMIT = 3;
const SEGMENT_MIN_NOTES = 2;
const HIGH_AGE = 16;
const VALUE_MIN = 4;

type Segment = {
  key: string;
  title: string;
  hint: string;
  items: PopularBottling[];
};

export default function RankingScreen() {
  const router = useRouter();
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [tBottlings, setTBottlings] = useState<Map<string, Bottling>>(new Map());
  const [tProfiles, setTProfiles] = useState<Map<string, Profile>>(new Map());
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [popular, setPopular] = useState<PopularBottling[]>([]);
  const [distilleries, setDistilleries] = useState<PopularDistillery[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const segmentCols = "id, name, name_kr, age_years, abv, distillery_name, distillery_name_kr, country, region, avg_score, tasting_count";
      const [
        trRes, rvRes, popRes, dRes,
        sherryRes, bourbonRes, highAgeRes, valueRes,
      ] = await Promise.all([
        supabase
          .from("trending_tastings")
          .select("id, bottling_id, user_id, score, tasted_at, like_count, comment_count, recent_likes, notes, visibility")
          .order("recent_likes", { ascending: false })
          .order("like_count", { ascending: false })
          .order("tasted_at", { ascending: false })
          .limit(8),
        supabase
          .from("top_reviewers")
          .select("id, username, display_name, avatar_url, follower_count, public_note_count, total_likes_received, avg_score")
          .gt("public_note_count", 0)
          .order("total_likes_received", { ascending: false })
          .order("public_note_count", { ascending: false })
          .limit(10),
        supabase
          .from("bottling_card_stats")
          .select("id, name, name_kr, age_years, abv, distillery_name, distillery_name_kr, country, region, avg_score, tasting_count")
          .gt("tasting_count", 0)
          .order("avg_score", { ascending: false, nullsFirst: false })
          .order("tasting_count", { ascending: false })
          .limit(8),
        supabase
          .from("popular_distilleries")
          .select("id, name, name_kr, country, region, note_count, avg_score")
          .gt("note_count", 0)
          .order("note_count", { ascending: false })
          .order("avg_score", { ascending: false, nullsFirst: false })
          .limit(12),
        supabase
          .from("bottling_card_stats")
          .select(segmentCols)
          .eq("cask_type", "sherry")
          .gte("tasting_count", SEGMENT_MIN_NOTES)
          .not("avg_score", "is", null)
          .order("avg_score", { ascending: false, nullsFirst: false })
          .order("tasting_count", { ascending: false })
          .limit(SEGMENT_LIMIT),
        supabase
          .from("bottling_card_stats")
          .select(segmentCols)
          .eq("cask_type", "bourbon")
          .gte("tasting_count", SEGMENT_MIN_NOTES)
          .not("avg_score", "is", null)
          .order("avg_score", { ascending: false, nullsFirst: false })
          .order("tasting_count", { ascending: false })
          .limit(SEGMENT_LIMIT),
        supabase
          .from("bottling_card_stats")
          .select(segmentCols)
          .gte("age_years", HIGH_AGE)
          .gte("tasting_count", SEGMENT_MIN_NOTES)
          .not("avg_score", "is", null)
          .order("avg_score", { ascending: false, nullsFirst: false })
          .order("tasting_count", { ascending: false })
          .limit(SEGMENT_LIMIT),
        supabase
          .from("bottling_card_stats")
          .select(segmentCols + ", avg_value_for_money")
          .gte("avg_value_for_money", VALUE_MIN)
          .gte("tasting_count", SEGMENT_MIN_NOTES)
          .order("avg_value_for_money", { ascending: false, nullsFirst: false })
          .order("avg_score", { ascending: false, nullsFirst: false })
          .limit(SEGMENT_LIMIT),
      ]);

      const tr = (trRes.data ?? []) as TrendingItem[];
      setTrending(tr);

      const bottlingIds = Array.from(new Set(tr.map((t) => t.bottling_id)));
      const userIds = Array.from(new Set(tr.map((t) => t.user_id)));
      if (bottlingIds.length > 0) {
        const { data } = await supabase
          .from("bottling_card_stats")
          .select("id, name, name_kr, distillery_name, distillery_name_kr, country")
          .in("id", bottlingIds);
        const m = new Map<string, Bottling>();
        for (const b of (data ?? []) as Bottling[]) m.set(b.id, b);
        setTBottlings(m);
      }
      if (userIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", userIds);
        const m = new Map<string, Profile>();
        for (const p of (data ?? []) as Profile[]) m.set(p.id, p);
        setTProfiles(m);
      }

      setReviewers((rvRes.data ?? []) as Reviewer[]);
      setPopular((popRes.data ?? []) as PopularBottling[]);
      setDistilleries((dRes.data ?? []) as PopularDistillery[]);

      const segs: Segment[] = [
        { key: "sherry",   title: "🍷 셰리캐스크 top", hint: "셰리 오크",           items: (sherryRes.data ?? []) as PopularBottling[] },
        { key: "bourbon",  title: "🌾 버번캐스크 top", hint: "버번 배럴",           items: (bourbonRes.data ?? []) as PopularBottling[] },
        { key: "high_age", title: "🕰️ 고숙성 top",    hint: `${HIGH_AGE}년+`,       items: (highAgeRes.data ?? []) as PopularBottling[] },
        { key: "value",    title: "💸 가성비 top",    hint: `가성비 ${VALUE_MIN}점 이상`, items: (valueRes.data ?? []) as PopularBottling[] },
      ].filter((s) => s.items.length > 0);
      setSegments(segs);

      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "랭킹" }} />
        <View style={styles.center}><ActivityIndicator color="#fbbf24" /></View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "랭킹" }} />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.header}>
          <Text style={styles.h1}>랭킹</Text>
          <Text style={styles.lead}>커뮤니티가 만든 흐름 · 평균은 공개 노트 기준</Text>
        </View>

        {/* 트렌딩 노트 */}
        <Section title="🔥 트렌딩 노트" hint="최근 7일 좋아요 가중">
          {trending.length === 0 ? (
            <Empty>아직 좋아요가 쌓인 노트가 없어요.</Empty>
          ) : (
            <View style={{ gap: 10 }}>
              {trending.map((t) => {
                const b = tBottlings.get(t.bottling_id);
                const p = tProfiles.get(t.user_id);
                const name = p?.display_name ?? p?.username ?? "익명";
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => router.push(`/whiskies/${t.bottling_id}`)}
                    style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
                  >
                    {b && (
                      <Text style={styles.cardDist} numberOfLines={1}>
                        {COUNTRY_FLAG[b.country]} {b.distillery_name_kr ?? b.distillery_name}
                      </Text>
                    )}
                    {b && (
                      <Text style={styles.cardName} numberOfLines={1}>
                        {b.name_kr ?? b.name}
                      </Text>
                    )}
                    {t.notes && (
                      <Text style={styles.cardNotes} numberOfLines={2}>{t.notes}</Text>
                    )}
                    <View style={styles.cardFooter}>
                      <View style={styles.author}>
                        <Avatar name={name} url={p?.avatar_url ?? null} size={18} />
                        <Text style={styles.authorName} numberOfLines={1}>{name}</Text>
                      </View>
                      {t.score !== null && (
                        <Text style={styles.score}>{t.score}</Text>
                      )}
                    </View>
                    <View style={styles.cardStats}>
                      <Text style={styles.faint}>♡ {t.like_count} · 💬 {t.comment_count}</Text>
                      {t.recent_likes > 0 && (
                        <Text style={styles.hot}>7일 ♡ {t.recent_likes}</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Section>

        {/* 탑 리뷰어 */}
        <Section title="👑 탑 리뷰어" hint="받은 좋아요 기준">
          {reviewers.length === 0 ? (
            <Empty>아직 충분한 노트를 작성한 사용자가 없어요.</Empty>
          ) : (
            <View style={{ gap: 8 }}>
              {reviewers.map((r, i) => {
                const name = r.display_name ?? r.username;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => router.push(`/profile/${r.username}`)}
                    style={({ pressed }) => [styles.rowCard, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.rank}>{i + 1}</Text>
                    <Avatar name={name} url={r.avatar_url} size={36} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        노트 {r.public_note_count}
                        {r.avg_score !== null && ` · 평균 ${r.avg_score}`}
                        {" · "}♡ {r.total_likes_received}
                      </Text>
                    </View>
                    {r.follower_count > 0 && (
                      <Text style={styles.rowSub}>팔로워 {r.follower_count}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </Section>

        {/* 인기 보틀링 */}
        <Section title="인기 보틀링" hint="평균 점수 + 노트 수">
          {popular.length === 0 ? (
            <Empty>아직 평가된 보틀링이 없어요.</Empty>
          ) : (
            <View style={{ gap: 10 }}>
              {popular.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => router.push(`/whiskies/${b.id}`)}
                  style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.cardDist} numberOfLines={1}>
                      {COUNTRY_FLAG[b.country]} {b.distillery_name_kr ?? b.distillery_name}
                      {b.region ? ` · ${b.region}` : ""}
                    </Text>
                    {b.avg_score !== null && (
                      <View style={styles.scoreBadge}>
                        <Text style={styles.scoreText}>{b.avg_score}</Text>
                        <Text style={styles.scoreCount}>({b.tasting_count})</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardName} numberOfLines={2}>{b.name_kr ?? b.name}</Text>
                  <Text style={styles.cardMeta}>
                    {formatAge(b.age_years)} · {formatAbv(b.abv)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Section>

        {/* 취향별 랭킹 */}
        {segments.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>취향별 랭킹</Text>
              <Text style={styles.sectionHint}>세그먼트 · 최소 {SEGMENT_MIN_NOTES}개 노트</Text>
            </View>
            {segments.map((seg) => (
              <View key={seg.key} style={{ marginBottom: 18 }}>
                <View style={styles.segHead}>
                  <Text style={styles.segTitle}>{seg.title}</Text>
                  <Text style={styles.segHint}>{seg.hint}</Text>
                </View>
                <View style={{ gap: 10 }}>
                  {seg.items.map((b) => (
                    <Pressable
                      key={b.id}
                      onPress={() => router.push(`/whiskies/${b.id}`)}
                      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
                    >
                      <View style={styles.cardTop}>
                        <Text style={styles.cardDist} numberOfLines={1}>
                          {COUNTRY_FLAG[b.country]} {b.distillery_name_kr ?? b.distillery_name}
                          {b.region ? ` · ${b.region}` : ""}
                        </Text>
                        {b.avg_score !== null && (
                          <View style={styles.scoreBadge}>
                            <Text style={styles.scoreText}>{b.avg_score}</Text>
                            <Text style={styles.scoreCount}>({b.tasting_count})</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.cardName} numberOfLines={2}>{b.name_kr ?? b.name}</Text>
                      <Text style={styles.cardMeta}>
                        {formatAge(b.age_years)} · {formatAbv(b.abv)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 인기 증류소 */}
        <Section title="🏭 인기 증류소" hint="노트 수 기준">
          {distilleries.length === 0 ? (
            <Empty>아직 노트가 쌓인 증류소가 없어요.</Empty>
          ) : (
            <View style={{ gap: 6 }}>
              {distilleries.map((d, i) => (
                <Pressable
                  key={d.id}
                  onPress={() => router.push(`/distilleries/${d.id}`)}
                  style={({ pressed }) => [styles.rowCard, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.rank}>{i + 1}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {COUNTRY_FLAG[d.country]} {d.name_kr ?? d.name}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {d.region ?? "—"} · 노트 {d.note_count}
                      {d.avg_score !== null && ` · 평균 ${d.avg_score}`}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </Section>
      </ScrollView>
    </>
  );
}

function Section({
  title, hint, children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint && <Text style={styles.sectionHint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyText}>{children}</Text>
    </View>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a" },

  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  h1: { color: "#fafafa", fontSize: 26, fontWeight: "700", letterSpacing: -0.3 },
  lead: { color: "#a3a3a3", fontSize: 13, marginTop: 6 },

  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 10 },
  sectionTitle: { color: "#fafafa", fontSize: 17, fontWeight: "600" },
  sectionHint: { color: "#737373", fontSize: 11 },
  segHead: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 8 },
  segTitle: { color: "#e5e5e5", fontSize: 14, fontWeight: "500" },
  segHint: { color: "#737373", fontSize: 10 },

  emptyBox: {
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 10,
    padding: 24,
  },
  emptyText: { color: "#737373", textAlign: "center", fontSize: 13 },

  card: {
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 10,
    padding: 14,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
  cardDist: { color: "#a3a3a3", fontSize: 12, flex: 1 },
  cardName: { color: "#fafafa", fontSize: 15, fontWeight: "500", marginTop: 4 },
  cardMeta: { color: "#a3a3a3", fontSize: 12, marginTop: 4 },
  cardNotes: { color: "#d4d4d4", fontSize: 12, marginTop: 6, lineHeight: 17 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  cardStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#262626",
  },
  author: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 },
  authorName: { color: "#a3a3a3", fontSize: 12, flex: 1 },
  score: { color: "#fbbf24", fontSize: 15, fontWeight: "700" },
  faint: { color: "#525252", fontSize: 10 },
  hot: {
    color: "#fde68a",
    fontSize: 10,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },

  scoreBadge: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  scoreText: { color: "#fbbf24", fontSize: 16, fontWeight: "700" },
  scoreCount: { color: "#737373", fontSize: 11 },

  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 10,
  },
  rank: {
    width: 20,
    textAlign: "center",
    color: "#737373",
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  rowName: { color: "#fafafa", fontSize: 14, fontWeight: "500" },
  rowMeta: { color: "#737373", fontSize: 11, marginTop: 2 },
  rowSub: { color: "#a3a3a3", fontSize: 11 },
});
