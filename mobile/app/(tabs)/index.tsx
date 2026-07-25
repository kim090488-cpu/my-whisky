import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { COUNTRY_FLAG, formatAge, formatAbv } from "@/lib/format";
import type { WhiskyCountry } from "@/types/database";
import {
  loadFollowRecommendations,
  type FollowRecommendation,
} from "@/lib/social/follow-recommendations";
import type { TasteTagTone } from "@/lib/tastings/taste-profile";
import { currentKstMonth } from "@/lib/tastings/wrapped";

type Stats = { distilleries: number; bottlings: number; tastings: number };

type Bottle = {
  id: string;
  name: string;
  name_kr: string | null;
  age_years: number | null;
  abv: number | null;
  distillery_name: string;
  distillery_name_kr: string | null;
  country: WhiskyCountry;
  avg_score: number | null;
  tasting_count: number;
};

type MonthStats = {
  count: number;
  avgScore: number | null;
  buybackPct: number | null;
  newBottlingCount: number;
  monthLabel: string;
  topPick: {
    tastingId: string;
    bottlingName: string;
    score: number;
  } | null;
};

type MyRecentNote = {
  id: string;
  tasted_at: string;
  score: number | null;
  bottling: {
    id: string;
    name: string;
    name_kr: string | null;
    distillery_name: string;
    distillery_name_kr: string | null;
    country: WhiskyCountry;
  } | null;
};

type FollowNote = MyRecentNote & {
  author: { username: string; display_name: string | null } | null;
};

const RECOMMEND_COUNT = 4;
const POOL = 12;
const MY_RECENT_COUNT = 4;

const TAG_TONE_STYLES: Record<
  TasteTagTone,
  { border: string; bg: string; text: string }
> = {
  amber:   { border: "rgba(251,191,36,0.4)",  bg: "rgba(251,191,36,0.1)",  text: "#fcd34d" },
  emerald: { border: "rgba(52,211,153,0.4)",  bg: "rgba(52,211,153,0.1)",  text: "#6ee7b7" },
  rose:    { border: "rgba(251,113,133,0.4)", bg: "rgba(251,113,133,0.1)", text: "#fda4af" },
  sky:     { border: "rgba(56,189,248,0.4)",  bg: "rgba(56,189,248,0.1)",  text: "#7dd3fc" },
};

function getKstToday() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return { seed: y * 10000 + m * 100 + day, label: `${m}/${day}` };
}

function getKstMonthStart() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return {
    iso: `${y}-${String(m).padStart(2, "0")}-01`,
    monthLabel: `${m}월`,
  };
}

function mulberry32(seed: number) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWithSeed<T>(items: T[], n: number, seed: number): T[] {
  if (items.length <= n) return items;
  const pool = [...items];
  const rng = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [myRecent, setMyRecent] = useState<MyRecentNote[]>([]);
  const [followNotes, setFollowNotes] = useState<FollowNote[]>([]);
  const [likedNotes, setLikedNotes] = useState<FollowNote[]>([]);
  const [communityPosts, setCommunityPosts] = useState<Array<{
    id: string;
    category: "question" | "recommendation" | "tip" | "free";
    title: string;
    like_count: number;
    comment_count: number;
    created_at: string;
    author: { username: string; display_name: string | null } | null;
  }>>([]);
  const [recommendedReviewers, setRecommendedReviewers] = useState<FollowRecommendation[]>([]);
  const [monthStats, setMonthStats] = useState<MonthStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const today = getKstToday();

  async function load() {
    const [d, b, t, picksRes] = await Promise.all([
      supabase.from("distilleries").select("*", { count: "exact", head: true }),
      supabase.from("bottlings").select("*", { count: "exact", head: true }),
      supabase.from("tastings").select("*", { count: "exact", head: true }),
      supabase
        .from("bottling_card_stats")
        .select("id, name, name_kr, age_years, abv, distillery_name, distillery_name_kr, country, avg_score, tasting_count")
        .gt("tasting_count", 0)
        .not("avg_score", "is", null)
        .order("avg_score", { ascending: false, nullsFirst: false })
        .order("tasting_count", { ascending: false })
        .limit(POOL),
    ]);
    setStats({
      distilleries: d.count ?? 0,
      bottlings: b.count ?? 0,
      tastings: t.count ?? 0,
    });
    const pool = ((picksRes.data ?? []) as Bottle[]);
    setBottles(pickWithSeed(pool, RECOMMEND_COUNT, today.seed));

    if (session) {
      const { data: rawNotes } = await supabase
        .from("tastings")
        .select("id, tasted_at, score, bottling_id")
        .eq("user_id", session.user.id)
        .order("tasted_at", { ascending: false })
        .limit(MY_RECENT_COUNT);
      const notes = (rawNotes ?? []) as Array<{
        id: string;
        tasted_at: string;
        score: number | null;
        bottling_id: string;
      }>;
      const bottlingIds = Array.from(new Set(notes.map((n) => n.bottling_id)));
      const bottlingsById = new Map<string, MyRecentNote["bottling"]>();
      if (bottlingIds.length > 0) {
        const { data } = await supabase
          .from("bottling_card_stats")
          .select("id, name, name_kr, distillery_name, distillery_name_kr, country")
          .in("id", bottlingIds);
        for (const row of (data ?? []) as Array<{
          id: string | null;
          name: string;
          name_kr: string | null;
          distillery_name: string;
          distillery_name_kr: string | null;
          country: WhiskyCountry;
        }>) {
          if (row.id) {
            bottlingsById.set(row.id, {
              id: row.id,
              name: row.name,
              name_kr: row.name_kr,
              distillery_name: row.distillery_name,
              distillery_name_kr: row.distillery_name_kr,
              country: row.country,
            });
          }
        }
      }
      setMyRecent(
        notes.map((n) => ({
          id: n.id,
          tasted_at: n.tasted_at,
          score: n.score,
          bottling: bottlingsById.get(n.bottling_id) ?? null,
        })),
      );
      // 이번 달 통계
      const monthStart = getKstMonthStart();
      const { data: monthlyRows } = await supabase
        .from("tastings")
        .select("id, score, would_buy_again, bottling_id")
        .eq("user_id", session.user.id)
        .gte("tasted_at", monthStart.iso);
      const rows = (monthlyRows ?? []) as Array<{
        id: string;
        score: number | null;
        would_buy_again: boolean | null;
        bottling_id: string;
      }>;
      if (rows.length === 0) {
        setMonthStats(null);
      } else {
        const scores = rows
          .map((r) => r.score)
          .filter((v): v is number => typeof v === "number");
        const avgScore =
          scores.length > 0
            ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
            : null;
        const buybackAnswered = rows.filter(
          (r) => typeof r.would_buy_again === "boolean",
        );
        const buybackYes = buybackAnswered.filter((r) => r.would_buy_again === true).length;
        const buybackPct =
          buybackAnswered.length > 0
            ? Math.round((buybackYes / buybackAnswered.length) * 100)
            : null;

        const monthBottlingIds = Array.from(new Set(rows.map((r) => r.bottling_id)));
        const topScored = rows
          .filter((r): r is typeof r & { score: number } => typeof r.score === "number")
          .sort((a, b) => b.score - a.score)[0];

        const [priorRes, topBottlingRes] = await Promise.all([
          supabase
            .from("tastings")
            .select("bottling_id")
            .eq("user_id", session.user.id)
            .lt("tasted_at", monthStart.iso)
            .in("bottling_id", monthBottlingIds),
          topScored
            ? supabase
                .from("bottling_card_stats")
                .select("id, name, name_kr")
                .eq("id", topScored.bottling_id)
                .maybeSingle()
            : Promise.resolve({ data: null } as const),
        ]);
        const priorBottlingIds = new Set(
          ((priorRes.data ?? []) as { bottling_id: string }[]).map((r) => r.bottling_id),
        );
        const newBottlingCount = monthBottlingIds.filter((id) => !priorBottlingIds.has(id)).length;

        let topPick: MonthStats["topPick"] = null;
        if (topScored && topBottlingRes.data) {
          const b = topBottlingRes.data as {
            id: string | null;
            name: string | null;
            name_kr: string | null;
          };
          if (b.id && b.name) {
            topPick = {
              tastingId: topScored.id,
              bottlingName: b.name_kr ?? b.name,
              score: topScored.score,
            };
          }
        }

        setMonthStats({
          count: rows.length,
          avgScore,
          buybackPct,
          newBottlingCount,
          monthLabel: monthStart.monthLabel,
          topPick,
        });
      }
      // 팔로우 최근 노트 (4개)
      const { data: followsRes } = await supabase
        .from("follows")
        .select("followee_id")
        .eq("follower_id", session.user.id);
      const followeeIds = ((followsRes ?? []) as { followee_id: string }[]).map(
        (f) => f.followee_id,
      );
      if (followeeIds.length === 0) {
        setFollowNotes([]);
      } else {
        const { data: rawFollowTs } = await supabase
          .from("tastings")
          .select("id, tasted_at, score, user_id, bottling_id")
          .in("user_id", followeeIds)
          .eq("visibility", "public")
          .order("tasted_at", { ascending: false })
          .limit(MY_RECENT_COUNT);
        const ftRows = (rawFollowTs ?? []) as Array<{
          id: string;
          tasted_at: string;
          score: number | null;
          user_id: string;
          bottling_id: string;
        }>;
        if (ftRows.length === 0) {
          setFollowNotes([]);
        } else {
          const userIds = Array.from(new Set(ftRows.map((r) => r.user_id)));
          const bottlingIds2 = Array.from(new Set(ftRows.map((r) => r.bottling_id)));
          const [profsRes, btsRes] = await Promise.all([
            supabase
              .from("profiles")
              .select("id, username, display_name")
              .in("id", userIds),
            supabase
              .from("bottling_card_stats")
              .select("id, name, name_kr, distillery_name, distillery_name_kr, country")
              .in("id", bottlingIds2),
          ]);
          const profilesById = new Map(
            ((profsRes.data ?? []) as Array<{
              id: string;
              username: string;
              display_name: string | null;
            }>).map((p) => [p.id, p]),
          );
          const followBottlingsById = new Map<string, FollowNote["bottling"]>();
          for (const row of (btsRes.data ?? []) as Array<{
            id: string | null;
            name: string;
            name_kr: string | null;
            distillery_name: string;
            distillery_name_kr: string | null;
            country: WhiskyCountry;
          }>) {
            if (row.id) {
              followBottlingsById.set(row.id, {
                id: row.id,
                name: row.name,
                name_kr: row.name_kr,
                distillery_name: row.distillery_name,
                distillery_name_kr: row.distillery_name_kr,
                country: row.country,
              });
            }
          }
          setFollowNotes(
            ftRows.map((r) => ({
              id: r.id,
              tasted_at: r.tasted_at,
              score: r.score,
              bottling: followBottlingsById.get(r.bottling_id) ?? null,
              author: profilesById.get(r.user_id) ?? null,
            })),
          );
        }
      }
    } else {
      setMyRecent([]);
      setMonthStats(null);
      setFollowNotes([]);
      setLikedNotes([]);
    }

    // 커뮤니티 게시판 최신글
    const { data: rawCommPosts } = await supabase
      .from("community_posts")
      .select("id, category, title, like_count, comment_count, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(5);
    const cpRows = (rawCommPosts ?? []) as Array<{
      id: string; category: "question" | "recommendation" | "tip" | "free";
      title: string; like_count: number; comment_count: number; created_at: string; user_id: string;
    }>;
    if (cpRows.length === 0) {
      setCommunityPosts([]);
    } else {
      const uIds = Array.from(new Set(cpRows.map((r) => r.user_id)));
      const { data: pRes } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", uIds);
      const pById = new Map(
        ((pRes ?? []) as Array<{ id: string; username: string; display_name: string | null }>).map((p) => [p.id, p]),
      );
      setCommunityPosts(cpRows.map((r) => ({
        id: r.id, category: r.category, title: r.title,
        like_count: r.like_count, comment_count: r.comment_count, created_at: r.created_at,
        author: pById.get(r.user_id) ?? null,
      })));
    }

    // 최근 좋아요한 노트 (로그인 시)
    if (session) {
      const { data: rawLikes } = await supabase
        .from("tasting_likes")
        .select("tasting_id, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(MY_RECENT_COUNT);
      const likes = (rawLikes ?? []) as Array<{ tasting_id: string; created_at: string }>;
      if (likes.length === 0) {
        setLikedNotes([]);
      } else {
        const tastingIds = likes.map((l) => l.tasting_id);
        const { data: rawLikedRows } = await supabase
          .from("tastings")
          .select("id, tasted_at, score, user_id, bottling_id")
          .in("id", tastingIds);
        const likedRows = (rawLikedRows ?? []) as Array<{
          id: string;
          tasted_at: string;
          score: number | null;
          user_id: string;
          bottling_id: string;
        }>;
        const rowById = new Map(likedRows.map((r) => [r.id, r]));
        // like created_at 순서 유지
        const orderedRows = tastingIds
          .map((id) => rowById.get(id))
          .filter((r): r is (typeof likedRows)[number] => !!r);

        const uIds = Array.from(new Set(orderedRows.map((r) => r.user_id)));
        const bIds = Array.from(new Set(orderedRows.map((r) => r.bottling_id)));
        const [pRes, bRes] = await Promise.all([
          supabase.from("profiles").select("id, username, display_name").in("id", uIds),
          supabase
            .from("bottling_card_stats")
            .select("id, name, name_kr, distillery_name, distillery_name_kr, country")
            .in("id", bIds),
        ]);
        const pById = new Map(
          ((pRes.data ?? []) as Array<{ id: string; username: string; display_name: string | null }>).map(
            (p) => [p.id, p],
          ),
        );
        const bById = new Map<string, FollowNote["bottling"]>();
        for (const row of (bRes.data ?? []) as Array<{
          id: string | null;
          name: string;
          name_kr: string | null;
          distillery_name: string;
          distillery_name_kr: string | null;
          country: WhiskyCountry;
        }>) {
          if (row.id) {
            bById.set(row.id, {
              id: row.id, name: row.name, name_kr: row.name_kr,
              distillery_name: row.distillery_name, distillery_name_kr: row.distillery_name_kr,
              country: row.country,
            });
          }
        }
        setLikedNotes(
          orderedRows.map((r) => ({
            id: r.id,
            tasted_at: r.tasted_at,
            score: r.score,
            bottling: bById.get(r.bottling_id) ?? null,
            author: pById.get(r.user_id) ?? null,
          })),
        );
      }
    }

    // 추천 리뷰어 (로그인 · taste-profile 기반 유사도)
    if (session) {
      const recs = await loadFollowRecommendations(supabase, session.user.id, {
        viewerId: session.user.id,
      });
      setRecommendedReviewers(recs);
    } else {
      setRecommendedReviewers([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
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
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.tag}>· 한국 위스키 커뮤니티</Text>
        <Text style={styles.heroTitle}>
          한 잔에서{"\n"}기억으로<Text style={styles.accentDot}>.</Text>
        </Text>
        <Text style={styles.heroLead}>
          보틀링을 찾고, 향과 맛을 기록하고, 다른 사람의 노트를 함께 봅니다.
        </Text>
      </View>

      {/* 탐색 카드 4개 */}
      <View style={styles.discoverGrid}>
        <DiscoverCard
          icon="trophy-outline"
          title="랭킹"
          desc="트렌딩 · 탑 리뷰어"
          onPress={() => router.push("/ranking")}
        />
        <DiscoverCard
          icon="sparkles-outline"
          title="맞춤 추천"
          desc="가성비 · 입문 · 선물"
          onPress={() => router.push("/picks")}
        />
        <DiscoverCard
          icon="business-outline"
          title="증류소"
          desc="국가별 카탈로그"
          onPress={() => router.push("/distilleries")}
        />
        <DiscoverCard
          icon="document-text-outline"
          title="테이스팅 노트"
          desc="공개된 후기 둘러보기"
          onPress={() => router.push("/tastings")}
        />
      </View>

      {/* 통계 */}
      {stats && (
        <View style={styles.statsRow}>
          <Stat label="증류소" value={stats.distilleries} />
          <Stat label="보틀링" value={stats.bottlings} />
          <Stat label="노트" value={stats.tastings} />
        </View>
      )}

      {/* 이번 달 통계 (로그인 + 이번 달 노트 있음) */}
      {session && monthStats && (
        <Pressable
          onPress={() => router.push(`/wrapped/${currentKstMonth()}` as never)}
          style={({ pressed }) => [styles.monthCard, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.monthHead}>
            <View style={styles.monthHeadRow}>
              <Text style={styles.monthTag}>이번 달 · {monthStats.monthLabel}</Text>
              <Text style={styles.monthMore}>회고 →</Text>
            </View>
            <Text style={styles.monthTitle}>내가 마신 위스키</Text>
          </View>
          <View style={styles.monthStatsRow}>
            <MonthStatBox label="노트" value={String(monthStats.count)} suffix="잔" />
            <MonthStatBox
              label="평균 점수"
              value={monthStats.avgScore !== null ? monthStats.avgScore.toFixed(1) : "—"}
            />
            <MonthStatBox
              label="재구매"
              value={monthStats.buybackPct !== null ? String(monthStats.buybackPct) : "—"}
              suffix={monthStats.buybackPct !== null ? "%" : undefined}
            />
            <MonthStatBox
              label="새로 만남"
              value={String(monthStats.newBottlingCount)}
              suffix={monthStats.newBottlingCount > 0 ? "종" : undefined}
            />
          </View>
          {monthStats.topPick && (
            <View style={styles.topPickPill}>
              <Text style={styles.topPickTag}>이달의 픽</Text>
              <Text style={styles.topPickName} numberOfLines={1}>
                {monthStats.topPick.bottlingName}
              </Text>
              <Text style={styles.topPickScore}>{monthStats.topPick.score}</Text>
            </View>
          )}
        </Pressable>
      )}

      {/* 내 최근 노트 (로그인) */}
      {session && myRecent.length > 0 && (
        <View style={styles.recommend}>
          <View style={styles.recommendHead}>
            <Text style={styles.recommendTitle}>내 최근 노트</Text>
            <Pressable onPress={() => router.push("/tastings")} hitSlop={6}>
              <Text style={styles.recommendMore}>모두 보기 →</Text>
            </Pressable>
          </View>
          <View style={styles.bottleGrid}>
            {myRecent.map((n) =>
              n.bottling ? (
                <Pressable
                  key={n.id}
                  onPress={() => router.push(`/tastings/${n.id}`)}
                  style={({ pressed }) => [styles.bottleCard, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.bottleDist} numberOfLines={1}>
                    {COUNTRY_FLAG[n.bottling.country]}{" "}
                    {n.bottling.distillery_name_kr ?? n.bottling.distillery_name}
                  </Text>
                  <Text style={styles.bottleName} numberOfLines={2}>
                    {n.bottling.name_kr ?? n.bottling.name}
                  </Text>
                  <Text style={styles.bottleMeta}>{n.tasted_at}</Text>
                  {n.score !== null && (
                    <View style={styles.bottleScore}>
                      <Text style={styles.bottleScoreText}>{n.score}</Text>
                      <Text style={styles.bottleScoreCount}>내 점수</Text>
                    </View>
                  )}
                </Pressable>
              ) : null,
            )}
          </View>
        </View>
      )}

      {/* 팔로우 최근 노트 (로그인 + 팔로우 활동 있음) */}
      {session && followNotes.length > 0 && (
        <View style={styles.recommend}>
          <View style={styles.recommendHead}>
            <Text style={styles.recommendTitle}>팔로우 최근 노트</Text>
            <Pressable onPress={() => router.push("/feed")} hitSlop={6}>
              <Text style={styles.recommendMore}>피드 전체 →</Text>
            </Pressable>
          </View>
          <View style={styles.bottleGrid}>
            {followNotes.map((n) =>
              n.bottling ? (
                <Pressable
                  key={n.id}
                  onPress={() => router.push(`/tastings/${n.id}`)}
                  style={({ pressed }) => [styles.bottleCard, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.followAuthor} numberOfLines={1}>
                    {n.author?.display_name ?? n.author?.username ?? "익명"}
                  </Text>
                  <Text style={styles.bottleName} numberOfLines={2}>
                    {n.bottling.name_kr ?? n.bottling.name}
                  </Text>
                  <Text style={styles.bottleDist} numberOfLines={1}>
                    {COUNTRY_FLAG[n.bottling.country]}{" "}
                    {n.bottling.distillery_name_kr ?? n.bottling.distillery_name}
                  </Text>
                  {n.score !== null && (
                    <View style={styles.bottleScore}>
                      <Text style={styles.bottleScoreText}>{n.score}</Text>
                      <Text style={styles.bottleScoreCount}>{n.tasted_at}</Text>
                    </View>
                  )}
                </Pressable>
              ) : null,
            )}
          </View>
        </View>
      )}

      {/* 최근 좋아요한 노트 (로그인 · 팔로우 없음 · 좋아요 있음) */}
      {session && followNotes.length === 0 && likedNotes.length > 0 && (
        <View style={styles.recommend}>
          <View style={styles.recommendHead}>
            <Text style={styles.recommendTitle}>최근 좋아요한 노트</Text>
          </View>
          <View style={styles.bottleGrid}>
            {likedNotes.map((n) =>
              n.bottling ? (
                <Pressable
                  key={n.id}
                  onPress={() => router.push(`/tastings/${n.id}`)}
                  style={({ pressed }) => [styles.bottleCard, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.followAuthor} numberOfLines={1}>
                    {n.author?.display_name ?? n.author?.username ?? "익명"}
                  </Text>
                  <Text style={styles.bottleName} numberOfLines={2}>
                    {n.bottling.name_kr ?? n.bottling.name}
                  </Text>
                  <Text style={styles.bottleDist} numberOfLines={1}>
                    {COUNTRY_FLAG[n.bottling.country]}{" "}
                    {n.bottling.distillery_name_kr ?? n.bottling.distillery_name}
                  </Text>
                  {n.score !== null && (
                    <View style={styles.bottleScore}>
                      <Text style={styles.bottleScoreText}>{n.score}</Text>
                      <Text style={styles.bottleScoreCount}>{n.tasted_at}</Text>
                    </View>
                  )}
                </Pressable>
              ) : null,
            )}
          </View>
        </View>
      )}

      {/* 커뮤니티 게시판 최신글 */}
      <View style={styles.recommend}>
        <View style={styles.recommendHead}>
          <Text style={styles.recommendTitle}>커뮤니티 게시판</Text>
          <Pressable onPress={() => router.push("/community" as never)} hitSlop={6}>
            <Text style={styles.recommendMore}>모두 보기 →</Text>
          </Pressable>
        </View>
        {communityPosts.length === 0 ? (
          <View style={styles.communityEmpty}>
            <Text style={styles.communityEmptyText}>아직 게시글이 없어요.</Text>
            {session && (
              <Pressable onPress={() => router.push("/community/new" as never)}>
                <Text style={styles.recommendMore}>+ 첫 게시글 작성</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {communityPosts.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/community/${p.id}` as never)}
                style={({ pressed }) => [styles.communityRow, pressed && { opacity: 0.7 }]}
              >
                <View style={styles.communityRowHead}>
                  <View style={[
                    styles.communityCatBadge,
                    p.category === "question" && { backgroundColor: "rgba(59, 130, 246, 0.15)" },
                    p.category === "recommendation" && { backgroundColor: "rgba(251, 191, 36, 0.15)" },
                    p.category === "tip" && { backgroundColor: "rgba(16, 185, 129, 0.15)" },
                    p.category === "free" && { backgroundColor: "rgba(163, 163, 163, 0.15)" },
                  ]}>
                    <Text style={[
                      styles.communityCatText,
                      p.category === "question" && { color: "#93c5fd" },
                      p.category === "recommendation" && { color: "#fde68a" },
                      p.category === "tip" && { color: "#6ee7b7" },
                      p.category === "free" && { color: "#d4d4d4" },
                    ]}>
                      {p.category === "question" ? "질문" : p.category === "recommendation" ? "추천" : p.category === "tip" ? "팁" : "잡담"}
                    </Text>
                  </View>
                  <Text style={styles.communityAuthor} numberOfLines={1}>
                    {p.author?.display_name ?? p.author?.username ?? "익명"}
                  </Text>
                  <Text style={styles.communityMetric}>♡ {p.like_count} · 💬 {p.comment_count}</Text>
                </View>
                <Text style={styles.communityTitle} numberOfLines={1}>{p.title}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* 추천 리뷰어 (로그인 · taste-profile 유사도 기반) */}
      {session && recommendedReviewers.length > 0 && (
        <View style={styles.recommend}>
          <View style={styles.recommendHead}>
            <Text style={styles.recommendTitle}>취향이 비슷한 리뷰어</Text>
          </View>
          <View style={styles.reviewerGrid}>
            {recommendedReviewers.map((r) => {
              const name = r.display_name ?? r.username;
              const initial = name.trim().charAt(0).toUpperCase();
              const visibleTags = r.sharedTags.slice(0, 3);
              const extraTagCount = r.sharedTags.length - visibleTags.length;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => router.push(`/profile/${r.username}`)}
                  style={({ pressed }) => [styles.reviewerCard, pressed && { opacity: 0.7 }]}
                >
                  <View style={styles.reviewerHeader}>
                    <View style={styles.reviewerAvatar}>
                      <Text style={styles.reviewerAvatarText}>{initial}</Text>
                    </View>
                    <View style={styles.reviewerHeaderText}>
                      <Text style={styles.reviewerName} numberOfLines={1}>{name}</Text>
                      <Text style={styles.reviewerHandle} numberOfLines={1}>
                        @{r.username} · 노트 {r.publicNoteCount}
                      </Text>
                    </View>
                    {r.matchScore > 0 && (
                      <View style={styles.matchBadge}>
                        <Text style={styles.matchBadgeLabel}>매치</Text>
                        <Text style={styles.matchBadgeValue}>{r.matchScore}%</Text>
                      </View>
                    )}
                  </View>
                  {visibleTags.length > 0 && (
                    <View style={styles.tagRow}>
                      {visibleTags.map((tag) => {
                        const tone = TAG_TONE_STYLES[tag.tone];
                        return (
                          <View
                            key={tag.key}
                            style={[
                              styles.tagPill,
                              { borderColor: tone.border, backgroundColor: tone.bg },
                            ]}
                          >
                            <Text style={[styles.tagPillText, { color: tone.text }]}>
                              {tag.label}
                            </Text>
                          </View>
                        );
                      })}
                      {extraTagCount > 0 && (
                        <View style={[styles.tagPill, styles.tagPillNeutral]}>
                          <Text style={styles.tagPillTextNeutral}>+{extraTagCount}</Text>
                        </View>
                      )}
                    </View>
                  )}
                  {r.commonBottlings.length > 0 && (
                    <View style={styles.commonRow}>
                      <Text style={styles.commonLabel}>함께 좋아함</Text>
                      {r.commonBottlings.map((b) => (
                        <View key={b.id} style={styles.commonPill}>
                          <Text style={styles.commonPillText} numberOfLines={1}>
                            {b.nameKr ?? b.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {r.topNote && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push(`/tastings/${r.topNote!.tastingId}`);
                      }}
                      style={styles.reviewerTopNote}
                    >
                      <Text style={styles.reviewerTopNoteLabel}>대표 노트</Text>
                      <View style={styles.reviewerTopNoteRow}>
                        <Text style={styles.reviewerTopNoteName} numberOfLines={2}>
                          {r.topNote.bottlingNameKr ?? r.topNote.bottlingName}
                        </Text>
                        {r.topNote.score !== null && (
                          <Text style={styles.reviewerTopNoteScore}>★ {r.topNote.score}</Text>
                        )}
                      </View>
                    </Pressable>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* 오늘의 추천 */}
      {bottles.length > 0 && (
        <View style={styles.recommend}>
          <View style={styles.recommendHead}>
            <Text style={styles.recommendTitle}>오늘의 추천</Text>
            <Pressable onPress={() => router.push("/ranking")} hitSlop={6}>
              <Text style={styles.recommendMore}>모두 보기 →</Text>
            </Pressable>
          </View>
          <Text style={styles.recommendSub}>
            평점 상위에서 매일 바뀌어요 · KST {today.label} 기준
          </Text>
          <View style={styles.bottleGrid}>
            {bottles.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => router.push(`/whiskies/${b.id}`)}
                style={({ pressed }) => [styles.bottleCard, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.bottleDist} numberOfLines={1}>
                  {COUNTRY_FLAG[b.country]} {b.distillery_name_kr ?? b.distillery_name}
                </Text>
                <Text style={styles.bottleName} numberOfLines={2}>
                  {b.name_kr ?? b.name}
                </Text>
                <Text style={styles.bottleMeta}>
                  {formatAge(b.age_years)} · {formatAbv(b.abv)}
                </Text>
                {b.avg_score !== null && (
                  <View style={styles.bottleScore}>
                    <Text style={styles.bottleScoreText}>{b.avg_score}</Text>
                    <Text style={styles.bottleScoreCount}>({b.tasting_count})</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
    </View>
  );
}

function MonthStatBox({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <View style={styles.monthStatBox}>
      <Text style={styles.monthStatLabel}>{label}</Text>
      <View style={styles.monthStatValueRow}>
        <Text style={styles.monthStatValue}>{value}</Text>
        {suffix && <Text style={styles.monthStatSuffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

function DiscoverCard({
  icon, title, desc, onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.discoverCard, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.discoverIcon}>
        <Ionicons name={icon} size={20} color="#fde68a" />
      </View>
      <Text style={styles.discoverTitle}>{title}</Text>
      <Text style={styles.discoverDesc}>{desc}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { paddingBottom: 32 },

  hero: { paddingHorizontal: 20, paddingTop: 36, paddingBottom: 24 },
  tag: { color: "#737373", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  heroTitle: {
    color: "#fafafa",
    fontSize: 38,
    fontWeight: "700",
    letterSpacing: -1,
    lineHeight: 42,
    marginTop: 14,
  },
  accentDot: { color: "#fbbf24" },
  heroLead: { color: "#a3a3a3", fontSize: 14, lineHeight: 21, marginTop: 14 },

  discoverGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 16,
  },
  discoverCard: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 12,
    padding: 14,
  },
  discoverIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#262626",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  discoverTitle: { color: "#fafafa", fontSize: 15, fontWeight: "600" },
  discoverDesc: { color: "#737373", fontSize: 11, marginTop: 4 },

  statsRow: { marginTop: 20, marginHorizontal: 16, flexDirection: "row", gap: 10 },
  statBox: {
    flex: 1,
    padding: 14,
    backgroundColor: "#171717",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#262626",
  },
  statLabel: { fontSize: 10, color: "#737373", textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { marginTop: 4, fontSize: 20, fontWeight: "700", color: "#fafafa" },

  monthCard: {
    marginTop: 20,
    marginHorizontal: 16,
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 12,
    padding: 16,
  },
  monthHead: { marginBottom: 14 },
  monthHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  monthTag: { color: "#737373", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" },
  monthMore: { color: "#a3a3a3", fontSize: 11 },
  monthTitle: { color: "#fafafa", fontSize: 18, fontWeight: "700", marginTop: 4 },
  monthStatsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  monthStatBox: { flexBasis: "47%", flexGrow: 1 },
  monthStatLabel: {
    color: "#737373",
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  monthStatValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    marginTop: 4,
  },
  monthStatValue: { color: "#fafafa", fontSize: 20, fontWeight: "700" },
  monthStatSuffix: { color: "#a3a3a3", fontSize: 12 },
  topPickPill: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
    backgroundColor: "rgba(251,191,36,0.06)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  topPickTag: {
    color: "#fbbf24",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  topPickName: { color: "#fafafa", fontSize: 12, flex: 1 },
  topPickScore: { color: "#fbbf24", fontSize: 14, fontWeight: "700" },

  recommend: { marginTop: 28, paddingHorizontal: 16 },
  recommendHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  recommendTitle: { color: "#fafafa", fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  recommendMore: { color: "#737373", fontSize: 12 },
  communityEmpty: { padding: 20, alignItems: "center", gap: 8, backgroundColor: "#111", borderRadius: 10, borderWidth: 1, borderColor: "#262626" },
  communityEmptyText: { color: "#737373", fontSize: 12 },
  communityRow: { padding: 12, backgroundColor: "#111", borderWidth: 1, borderColor: "#262626", borderRadius: 10, gap: 6 },
  communityRowHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  communityCatBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  communityCatText: { fontSize: 10, fontWeight: "700" },
  communityAuthor: { color: "#a3a3a3", fontSize: 11, flex: 1 },
  communityMetric: { color: "#737373", fontSize: 10 },
  communityTitle: { color: "#fafafa", fontSize: 13, fontWeight: "500" },
  recommendSub: { color: "#525252", fontSize: 11, marginTop: 4 },

  bottleGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  reviewerGrid: {
    marginTop: 12,
    gap: 10,
  },
  reviewerCard: {
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 10,
    padding: 12, gap: 10,
  },
  reviewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reviewerHeaderText: { flex: 1, minWidth: 0 },
  reviewerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(180, 83, 9, 0.3)",
    alignItems: "center", justifyContent: "center",
  },
  reviewerAvatarText: { color: "#fde68a", fontSize: 16, fontWeight: "600" },
  reviewerName: { color: "#fafafa", fontSize: 14, fontWeight: "600" },
  reviewerHandle: { color: "#737373", fontSize: 11, marginTop: 2 },
  matchBadge: {
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
    backgroundColor: "rgba(251,191,36,0.1)",
    borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    alignItems: "center",
  },
  matchBadgeLabel: {
    color: "rgba(252,211,77,0.8)", fontSize: 9,
    fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5,
  },
  matchBadgeValue: {
    color: "#fcd34d", fontSize: 13, fontWeight: "700",
    lineHeight: 15,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  tagPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tagPillText: { fontSize: 10, fontWeight: "500" },
  tagPillNeutral: {
    borderColor: "#404040",
    backgroundColor: "transparent",
  },
  tagPillTextNeutral: { color: "#a3a3a3", fontSize: 10 },
  commonRow: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4,
  },
  commonLabel: { color: "#737373", fontSize: 10 },
  commonPill: {
    maxWidth: 140,
    borderWidth: 1, borderColor: "rgba(52,211,153,0.4)",
    backgroundColor: "rgba(52,211,153,0.1)",
    borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  commonPillText: { color: "#6ee7b7", fontSize: 10 },
  reviewerTopNote: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1, borderTopColor: "#262626",
    gap: 4,
  },
  reviewerTopNoteLabel: {
    color: "#525252", fontSize: 9, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  reviewerTopNoteRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  reviewerTopNoteName: {
    color: "#d4d4d4", fontSize: 12, flex: 1, lineHeight: 15,
  },
  reviewerTopNoteScore: {
    color: "#fbbf24", fontSize: 12, fontWeight: "700",
  },
  bottleCard: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 10,
    padding: 12,
    minHeight: 110,
  },
  bottleDist: { color: "#a3a3a3", fontSize: 11 },
  followAuthor: { color: "#fde68a", fontSize: 11, fontWeight: "600" },
  bottleName: { color: "#fafafa", fontSize: 13, fontWeight: "500", marginTop: 4 },
  bottleMeta: { color: "#737373", fontSize: 11, marginTop: 4 },
  bottleScore: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  bottleScoreText: { color: "#fbbf24", fontSize: 15, fontWeight: "700" },
  bottleScoreCount: { color: "#525252", fontSize: 10 },
});
