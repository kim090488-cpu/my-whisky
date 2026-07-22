import Link from "next/link";
import { GlassWater, NotebookPen, TrendingUp, Sparkles, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import { BottleCard } from "@/components/bottle/bottle-card";
import { TastingTile, type TastingTileData } from "@/components/social/tasting-tile";
import {
  enrichTastings,
  loadTastingTilesByIds,
  TASTING_TILE_COLUMNS,
  type TastingBaseRow,
} from "@/lib/tastings/load-tasting-tiles";
import {
  loadFollowRecommendations,
  type FollowRecommendation,
} from "@/lib/social/follow-recommendations";
import { FollowRecommendationCard } from "@/components/social/follow-recommendation-card";
import {
  loadPersonalizedBottlings,
  BUDGET_RANGES,
  BUDGET_LABEL,
  type BudgetRange,
  type PersonalizedBottlingsResult,
} from "@/lib/social/personalized-bottlings";
import { loadTasteProfile } from "@/lib/tastings/taste-profile";
import { PersonalizedBottlingCard } from "@/components/social/personalized-bottling-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WhiskyCountry, CaskType } from "@/types/database";

export const dynamic = "force-dynamic";

const RECOMMEND_COUNT = 4;
const CANDIDATE_POOL_SIZE = 12;
const RECENT_NOTES_COUNT = 4;

function getKstToday() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return {
    seed: y * 10000 + m * 100 + day,
    label: `${m}/${day}`,
  };
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

type HomeSearchParams = Promise<{ budget?: string }>;

export default async function HomePage({
  searchParams,
}: {
  searchParams: HomeSearchParams;
}) {
  const sp = await searchParams;
  const budget: BudgetRange = BUDGET_RANGES.includes(sp.budget as BudgetRange)
    ? (sp.budget as BudgetRange)
    : "all";

  const supabase = await createClient();
  const [poolRes, recentTastingsRes, userRes] = await Promise.all([
    supabase
      .from("bottling_card_stats")
      .select("*")
      .gt("tasting_count", 0)
      .not("avg_score", "is", null)
      .order("avg_score", { ascending: false, nullsFirst: false })
      .order("tasting_count", { ascending: false })
      .limit(CANDIDATE_POOL_SIZE),
    supabase
      .from("tastings")
      .select(TASTING_TILE_COLUMNS)
      .eq("visibility", "public")
      .order("tasted_at", { ascending: false })
      .limit(RECENT_NOTES_COUNT),
    supabase.auth.getUser(),
  ]);

  const today = getKstToday();
  const poolList = poolRes.data ?? [];
  const bottles = pickWithSeed(poolList, RECOMMEND_COUNT, today.seed);
  const tomorrowPreview = pickWithSeed(poolList, RECOMMEND_COUNT, today.seed + 1);

  const user = userRes.data.user;
  const recentRows = (recentTastingsRes.data ?? []) as TastingBaseRow[];
  const recentTiles = await enrichTastings(supabase, recentRows, user?.id ?? null);

  let myRecentTiles: TastingTileData[] = [];
  let followTiles: TastingTileData[] = [];
  let likedTiles: TastingTileData[] = [];
  let monthStats: MonthStats | null = null;
  let followCount = 0;
  let recommendations: FollowRecommendation[] = [];
  let personalizedResult: PersonalizedBottlingsResult = {
    hasProfile: false,
    items: [],
  };
  if (user) {
    const monthStart = getKstMonthStart();
    const [myRecentRes, followsRes, monthlyRes, recsResult, personalizedResult2] =
      await Promise.all([
        supabase
          .from("tastings")
          .select(TASTING_TILE_COLUMNS)
          .eq("user_id", user.id)
          .order("tasted_at", { ascending: false })
          .limit(RECENT_NOTES_COUNT),
        supabase
          .from("follows")
          .select("followee_id")
          .eq("follower_id", user.id),
        supabase
          .from("tastings")
          .select("id, score, would_buy_again, bottling_id")
          .eq("user_id", user.id)
          .gte("tasted_at", monthStart.iso),
        loadFollowRecommendations(supabase, user.id, { viewerId: user.id }),
        loadTasteProfile(supabase, user.id, { publicOnly: false }).then((profile) =>
          loadPersonalizedBottlings(supabase, user.id, profile, { budget }),
        ),
      ]);
    recommendations = recsResult;
    personalizedResult = personalizedResult2;
    myRecentTiles = await enrichTastings(
      supabase,
      (myRecentRes.data ?? []) as TastingBaseRow[],
      user.id,
    );
    const followIds = ((followsRes.data ?? []) as { followee_id: string }[]).map(
      (f) => f.followee_id,
    );
    followCount = followIds.length;
    const monthlyRows = (monthlyRes.data ?? []) as Array<{
      id: string;
      score: number | null;
      would_buy_again: boolean | null;
      bottling_id: string;
    }>;
    if (monthlyRows.length > 0) {
      const scores = monthlyRows
        .map((r) => r.score)
        .filter((v): v is number => typeof v === "number");
      const avgScore =
        scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : null;
      const buybackAnswered = monthlyRows.filter(
        (r) => typeof r.would_buy_again === "boolean",
      );
      const buybackYes = buybackAnswered.filter((r) => r.would_buy_again === true).length;
      const buybackPct =
        buybackAnswered.length > 0
          ? Math.round((buybackYes / buybackAnswered.length) * 100)
          : null;

      const monthBottlingIds = Array.from(new Set(monthlyRows.map((r) => r.bottling_id)));
      const topScored = monthlyRows
        .filter((r): r is typeof r & { score: number } => typeof r.score === "number")
        .sort((a, b) => b.score - a.score)[0];

      const [priorRes, topBottlingRes] = await Promise.all([
        supabase
          .from("tastings")
          .select("bottling_id")
          .eq("user_id", user.id)
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

      monthStats = {
        count: monthlyRows.length,
        avgScore,
        buybackPct,
        newBottlingCount,
        monthLabel: monthStart.monthLabel,
        topPick,
      };
    }
    if (followIds.length > 0) {
      const followTastingsRes = await supabase
        .from("tastings")
        .select(TASTING_TILE_COLUMNS)
        .in("user_id", followIds)
        .order("tasted_at", { ascending: false })
        .limit(RECENT_NOTES_COUNT);
      followTiles = await enrichTastings(
        supabase,
        (followTastingsRes.data ?? []) as TastingBaseRow[],
        user.id,
      );
    } else {
      const likesRes = await supabase
        .from("tasting_likes")
        .select("tasting_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(RECENT_NOTES_COUNT);
      const likedIds = ((likesRes.data ?? []) as { tasting_id: string }[]).map(
        (l) => l.tasting_id,
      );
      if (likedIds.length > 0) {
        likedTiles = await loadTastingTilesByIds(supabase, likedIds, user.id);
      }
    }
  }

  return (
    <main>
      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-6 pt-24 pb-20 sm:pt-32 sm:pb-28">
          <p className="mb-5 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <span className="inline-block size-1 rounded-full bg-primary/80" />
            한국 위스키 커뮤니티
          </p>

          <h1 className="font-serif text-5xl leading-[1.05] tracking-tight text-foreground sm:text-7xl">
            한 잔에서
            <br />
            기억으로<span className="text-primary">.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
            보틀링을 찾고, 향과 맛을 기록하고, 다른 사람의 노트와 시세를 함께 봅니다.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/whiskies"
              className={cn(buttonVariants({ size: "lg" }), "px-6 py-5 text-base")}
            >
              위스키 둘러보기
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/ranking"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "px-6 py-5 text-base",
              )}
            >
              랭킹 보기
            </Link>
          </div>
        </div>
      </section>

      {/* 카테고리 4 카드 */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            href="/whiskies"
            icon={<GlassWater className="size-5" />}
            title="보틀링 카탈로그"
            body="국가·증류소·캐스크·향미로 위스키를 찾아보세요."
          />
          <FeatureCard
            href="/tastings"
            icon={<NotebookPen className="size-5" />}
            title="테이스팅 노트"
            body="다른 사람들의 진짜 후기, 점수·가성비·다시 살래요까지."
          />
          <FeatureCard
            href="/ranking"
            icon={<TrendingUp className="size-5" />}
            title="랭킹 · 시세"
            body="트렌딩 노트, 탑 리뷰어, 인기 보틀링을 한눈에."
          />
          <FeatureCard
            href="/picks"
            icon={<Sparkles className="size-5" />}
            title="맞춤 추천"
            body="다시 사고 싶은 · 처음이라면 · 선물용 · 가성비 갑."
          />
        </div>
      </section>

      {/* 이번 달 통계 · 노트 없으면 CTA (로그인) */}
      {user && !monthStats && (
        <section className="mx-auto max-w-6xl px-6 pb-10">
          <Link
            href="/whiskies"
            className="group flex items-center justify-between gap-4 rounded-xl border border-dashed border-border bg-card/30 p-5 transition-colors hover:border-amber-400/40 hover:bg-amber-400/5 sm:p-6"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                이번 달 · {getKstMonthStart().monthLabel}
              </p>
              <p className="mt-1 font-serif text-lg tracking-tight text-foreground sm:text-xl">
                아직 이번 달 노트가 없어요
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                첫 잔을 기록하면 통계와 하이라이트가 여기에 뜹니다
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-amber-300">
              위스키 찾기 <ArrowRight className="size-3.5" />
            </span>
          </Link>
        </section>
      )}

      {/* 이번 달 내 통계 (로그인 · 이번 달 노트 있음) */}
      {user && monthStats && (
        <section className="mx-auto max-w-6xl px-6 pb-10">
          <div className="rounded-xl border border-border bg-card/40 p-5 sm:p-6">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  이번 달 · {monthStats.monthLabel}
                </p>
                <h2 className="mt-1 font-serif text-xl tracking-tight sm:text-2xl">
                  내가 마신 위스키
                </h2>
              </div>
              <Link
                href="/me"
                className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                내 프로필 →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-6">
              <Stat label="노트" value={`${monthStats.count}`} suffix="잔" />
              <Stat
                label="평균 점수"
                value={monthStats.avgScore !== null ? monthStats.avgScore.toFixed(1) : "—"}
              />
              <Stat
                label="재구매"
                value={monthStats.buybackPct !== null ? `${monthStats.buybackPct}` : "—"}
                suffix={monthStats.buybackPct !== null ? "%" : undefined}
              />
              <Stat
                label="새로 만남"
                value={`${monthStats.newBottlingCount}`}
                suffix={monthStats.newBottlingCount > 0 ? "종" : undefined}
              />
            </div>
            {monthStats.topPick && (
              <Link
                href={`/tastings/${monthStats.topPick.tastingId}`}
                className="mt-5 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs text-amber-200 transition-colors hover:border-amber-400/60 hover:bg-amber-400/10"
              >
                <span className="text-sm">✨</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-amber-300/80">
                  이달의 픽
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {monthStats.topPick.bottlingName}
                </span>
                <span className="shrink-0 font-serif text-sm font-semibold tabular-nums text-amber-300">
                  {monthStats.topPick.score}
                </span>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* 내 최근 노트 (로그인) */}
      {user && myRecentTiles.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-serif text-3xl tracking-tight">내 최근 노트</h2>
            <Link
              href="/me/tastings"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              내 노트 모두 →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
            {myRecentTiles.map((t) => (
              <TastingTile
                key={t.id}
                tasting={t}
                currentUserId={user.id}
                loginHref="/login?next=/"
              />
            ))}
          </div>
        </section>
      )}

      {/* 팔로우 활동 (로그인 · 팔로우 있음) */}
      {user && followTiles.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="font-serif text-3xl tracking-tight">팔로우 최근 노트</h2>
              {followCount > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {followCount}명 팔로우 중
                </p>
              )}
            </div>
            <Link
              href="/me/feed"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              피드 전체 →
            </Link>
          </div>
          {(() => {
            const seen = new Set<string>();
            const activeAuthors = followTiles.reduce<
              Array<{ username: string; display_name: string | null; avatar_url: string | null }>
            >((acc, t) => {
              if (!t.profile) return acc;
              if (seen.has(t.profile.username)) return acc;
              seen.add(t.profile.username);
              acc.push(t.profile);
              return acc;
            }, []);
            if (activeAuthors.length === 0) return null;
            return (
              <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="shrink-0">최근 활동</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {activeAuthors.map((p) => (
                    <Link
                      key={p.username}
                      href={`/profile/${p.username}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/40 py-0.5 pl-0.5 pr-2 transition-colors hover:border-foreground/30 hover:text-foreground"
                    >
                      <Avatar
                        name={p.display_name ?? p.username}
                        avatarUrl={p.avatar_url}
                        size={20}
                      />
                      <span className="truncate max-w-[8rem]">
                        {p.display_name ?? p.username}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
            {followTiles.map((t) => (
              <TastingTile
                key={t.id}
                tasting={t}
                currentUserId={user.id}
                loginHref="/login?next=/"
              />
            ))}
          </div>
        </section>
      )}

      {/* 최근 좋아요한 노트 (로그인 · 팔로우 없음, 좋아요 있음) */}
      {user && followTiles.length === 0 && likedTiles.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="font-serif text-3xl tracking-tight">최근 좋아요한 노트</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                작성자를 팔로우하면 새 노트가 홈에 자동으로 떠요
              </p>
            </div>
            <Link
              href="/tastings"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              더 둘러보기 →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
            {likedTiles.map((t) => (
              <TastingTile
                key={t.id}
                tasting={t}
                currentUserId={user.id}
                loginHref="/login?next=/"
              />
            ))}
          </div>
        </section>
      )}

      {/* 팔로우 추천 (로그인 · 취향 겹침 있음) */}
      {user && recommendations.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="font-serif text-3xl tracking-tight">취향이 비슷한 사람</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                공통 태그 기준 · 팔로우하면 새 노트가 홈에 뜹니다
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
            {recommendations.map((r) => (
              <FollowRecommendationCard key={r.id} rec={r} />
            ))}
          </div>
        </section>
      )}

      {/* 내 취향 맞춤 보틀링 추천 (로그인 · 취향 태그 있음) */}
      {user && personalizedResult.hasProfile && (
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="font-serif text-3xl tracking-tight">내 취향 맞춤</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                내 취향 태그와 겹치는 고평점 보틀링 · 아직 안 마셔본 것만
              </p>
            </div>
            <Link
              href="/whiskies"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              카탈로그 전체 →
            </Link>
          </div>

          <nav className="mb-5 flex flex-wrap items-center gap-1 text-xs">
            <span className="mr-1 text-muted-foreground">예산</span>
            {BUDGET_RANGES.map((r) => {
              const active = r === budget;
              const href = r === "all" ? "/" : `/?budget=${r}`;
              return (
                <Link
                  key={r}
                  href={href}
                  className={
                    "shrink-0 rounded-full px-2.5 py-1 transition-colors " +
                    (active
                      ? "bg-foreground text-background"
                      : "border border-border bg-card/40 text-foreground/70 hover:border-foreground/30 hover:bg-card")
                  }
                >
                  {BUDGET_LABEL[r]}
                </Link>
              );
            })}
          </nav>

          {personalizedResult.items.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
              {personalizedResult.items.map((b) => (
                <PersonalizedBottlingCard key={b.id} bottling={b} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
              {budget === "all"
                ? "매칭되는 보틀링이 없어요. 노트를 더 쌓으면 추천이 더 좋아져요."
                : "이 예산대엔 매칭이 없어요. 다른 예산으로 바꿔보세요."}
            </div>
          )}
        </section>
      )}

      {/* 커뮤니티 최근 노트 */}
      {recentTiles.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-serif text-3xl tracking-tight">지금 커뮤니티</h2>
            <Link
              href="/tastings"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              모든 노트 →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
            {recentTiles.map((t) => (
              <TastingTile
                key={t.id}
                tasting={t}
                currentUserId={user?.id ?? null}
                loginHref="/login?next=/"
              />
            ))}
          </div>
        </section>
      )}

      {/* 오늘의 추천 */}
      {bottles.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="mb-2 flex items-end justify-between">
            <h2 className="font-serif text-3xl tracking-tight">
              오늘의 추천
            </h2>
            <Link
              href="/ranking"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              모두 보기 →
            </Link>
          </div>
          <p className="mb-6 text-xs text-muted-foreground">
            평점 상위 {poolList.length}개에서 매일 바뀌어요 · KST {today.label} 기준
          </p>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {bottles.map((b) => (
              <BottleCard
                key={b.id!}
                id={b.id!}
                name={b.name!}
                name_kr={b.name_kr}
                age_years={b.age_years}
                abv={b.abv}
                cask_type={b.cask_type as CaskType | null}
                distillery_name={b.distillery_name!}
                distillery_name_kr={b.distillery_name_kr}
                country={b.country as WhiskyCountry}
                region={b.region}
                label_image_url={b.label_image_url}
                avg_score={b.avg_score}
                tasting_count={b.tasting_count ?? 0}
                avg_value_for_money={b.avg_value_for_money}
                buy_again_pct={b.buy_again_pct}
              />
            ))}
          </div>

          {tomorrowPreview.length > 0 && (
            <div className="mt-8 border-t border-border/40 pt-5">
              <p className="mb-3 text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
                내일의 추천 미리보기
              </p>
              <div className="flex flex-wrap gap-2">
                {tomorrowPreview.map((b) => (
                  <Link
                    key={b.id!}
                    href={`/whiskies/${b.id}`}
                    className="rounded-full border border-border/60 bg-card/30 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                  >
                    {b.name_kr ?? b.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground">
          <span className="font-serif text-base text-foreground/80">my·whisky</span>
          <span>© {new Date().getFullYear()} · 위스키를 마시고 기록하는 곳</span>
        </div>
      </footer>
    </main>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-0.5 sm:gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex items-baseline gap-1 font-serif text-2xl tracking-tight text-foreground sm:text-3xl">
        <span className="tabular-nums">{value}</span>
        {suffix && (
          <span className="text-xs font-normal text-muted-foreground sm:text-sm">
            {suffix}
          </span>
        )}
      </span>
    </div>
  );
}

function FeatureCard({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-xl border border-border bg-card/40 p-6 transition-all hover:-translate-y-0.5 hover:border-border hover:bg-card"
    >
      <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-secondary text-foreground/80">
        {icon}
      </div>
      <h3 className="font-serif text-xl tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-foreground/65">{body}</p>
      <ArrowRight className="absolute right-5 top-5 size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 group-hover:text-primary" />
    </Link>
  );
}
