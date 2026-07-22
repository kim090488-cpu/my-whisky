import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import { BottleCard } from "@/components/bottle/bottle-card";
import { TastingTile } from "@/components/social/tasting-tile";
import { loadTastingTilesByIds } from "@/lib/tastings/load-tasting-tiles";
import { COUNTRY_FLAG } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "랭킹 · my-whisky",
  description: "트렌딩 테이스팅 노트, 탑 리뷰어, 인기 보틀링·증류소",
};

const TRENDING_LIMIT = 8;
const SEGMENT_LIMIT = 3;
const SEGMENT_MIN_NOTES = 2;
const HIGH_AGE = 16;
const VALUE_MIN = 4;

export default async function RankingPage() {
  const supabase = await createClient();

  const [
    trendingRes,
    reviewersRes,
    bottlingsRes,
    distilleriesRes,
    sherryRes,
    bourbonRes,
    highAgeRes,
    valueRes,
  ] = await Promise.all([
    supabase
      .from("trending_tastings")
      .select("id, bottling_id, user_id, recent_likes, like_count, tasted_at")
      .order("recent_likes", { ascending: false })
      .order("like_count", { ascending: false })
      .order("tasted_at", { ascending: false })
      .limit(TRENDING_LIMIT),
    supabase
      .from("top_reviewers")
      .select("*")
      .gt("public_note_count", 0)
      .order("total_likes_received", { ascending: false })
      .order("public_note_count", { ascending: false })
      .limit(10),
    supabase
      .from("bottling_card_stats")
      .select("*")
      .gt("tasting_count", 0)
      .order("avg_score", { ascending: false, nullsFirst: false })
      .order("tasting_count", { ascending: false })
      .limit(8),
    supabase
      .from("popular_distilleries")
      .select("*")
      .gt("note_count", 0)
      .order("note_count", { ascending: false })
      .order("avg_score", { ascending: false, nullsFirst: false })
      .limit(12),
    supabase
      .from("bottling_card_stats")
      .select("*")
      .eq("cask_type", "sherry")
      .gte("tasting_count", SEGMENT_MIN_NOTES)
      .not("avg_score", "is", null)
      .order("avg_score", { ascending: false, nullsFirst: false })
      .order("tasting_count", { ascending: false })
      .limit(SEGMENT_LIMIT),
    supabase
      .from("bottling_card_stats")
      .select("*")
      .eq("cask_type", "bourbon")
      .gte("tasting_count", SEGMENT_MIN_NOTES)
      .not("avg_score", "is", null)
      .order("avg_score", { ascending: false, nullsFirst: false })
      .order("tasting_count", { ascending: false })
      .limit(SEGMENT_LIMIT),
    supabase
      .from("bottling_card_stats")
      .select("*")
      .gte("age_years", HIGH_AGE)
      .gte("tasting_count", SEGMENT_MIN_NOTES)
      .not("avg_score", "is", null)
      .order("avg_score", { ascending: false, nullsFirst: false })
      .order("tasting_count", { ascending: false })
      .limit(SEGMENT_LIMIT),
    supabase
      .from("bottling_card_stats")
      .select("*")
      .gte("avg_value_for_money", VALUE_MIN)
      .gte("tasting_count", SEGMENT_MIN_NOTES)
      .order("avg_value_for_money", { ascending: false, nullsFirst: false })
      .order("avg_score", { ascending: false, nullsFirst: false })
      .limit(SEGMENT_LIMIT),
  ]);

  const trendingHeads = trendingRes.data ?? [];
  const reviewers = reviewersRes.data ?? [];
  const bottlings = bottlingsRes.data ?? [];
  const distilleries = distilleriesRes.data ?? [];
  const segments: { key: string; title: string; hint: string; items: typeof bottlings }[] = [
    { key: "sherry",  title: "🍷 셰리캐스크 top",  hint: "셰리 오크",              items: sherryRes.data ?? [] },
    { key: "bourbon", title: "🌾 버번캐스크 top",  hint: "버번 배럴",              items: bourbonRes.data ?? [] },
    { key: "high_age", title: "🕰️ 고숙성 top",     hint: `${HIGH_AGE}년+`,          items: highAgeRes.data ?? [] },
    { key: "value",   title: "💸 가성비 top",      hint: `가성비 ${VALUE_MIN}점 이상`, items: valueRes.data ?? [] },
  ].filter((s) => s.items.length > 0);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const trendingIds = trendingHeads.map((t) => t.id);
  const trendingTiles = await loadTastingTilesByIds(
    supabase,
    trendingIds,
    user?.id ?? null,
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      <h1 className="font-serif text-3xl tracking-tight">랭킹</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        커뮤니티가 만든 흐름 — 평균 점수는 공개 노트 기준
      </p>

      <Section title="🔥 트렌딩 노트" hint="최근 7일 좋아요 가중">
        {trendingTiles.length === 0 ? (
          <Empty>아직 좋아요가 쌓인 노트가 없어요.</Empty>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
            {trendingTiles.map((t) => (
              <li key={t.id}>
                <TastingTile
                  tasting={t}
                  currentUserId={user?.id ?? null}
                  loginHref="/login?next=/ranking"
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="👑 탑 리뷰어" hint="받은 좋아요 기준">
        {reviewers.length === 0 ? (
          <Empty>아직 충분한 노트를 작성한 사용자가 없어요.</Empty>
        ) : (
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {reviewers.map((r, i) => {
              const name = r.display_name ?? r.username;
              return (
                <li key={r.id}>
                  <Link
                    href={`/profile/${r.username}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-3 transition-colors hover:border-foreground/30 hover:bg-card"
                  >
                    <div className="w-6 text-center text-sm font-semibold tabular-nums text-muted-foreground">
                      {i + 1}
                    </div>
                    <Avatar name={name} avatarUrl={r.avatar_url} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{name}</div>
                      <div className="text-xs text-muted-foreground">
                        노트 {r.public_note_count}
                        {r.avg_score !== null && ` · 평균 ${r.avg_score}`}
                        {" · "}♡ {r.total_likes_received}
                      </div>
                    </div>
                    {r.follower_count > 0 && (
                      <div className="shrink-0 text-right text-xs text-muted-foreground">
                        팔로워{" "}
                        <span className="text-foreground/85 tabular-nums">
                          {r.follower_count}
                        </span>
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <Section title="인기 보틀링" hint="평균 점수 + 노트 수">
        {bottlings.length === 0 ? (
          <Empty>아직 평가된 보틀링이 없어요.</Empty>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {bottlings.map((b) => (
              <li key={b.id}>
                <BottleCard {...b} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {segments.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-baseline gap-3">
            <h2 className="font-serif text-xl tracking-tight">취향별 랭킹</h2>
            <span className="text-xs text-muted-foreground">세그먼트 · 최소 {SEGMENT_MIN_NOTES}개 노트</span>
          </div>
          <div className="flex flex-col gap-8">
            {segments.map((seg) => (
              <div key={seg.key}>
                <div className="mb-3 flex items-baseline gap-2">
                  <h3 className="text-base font-medium">{seg.title}</h3>
                  <span className="text-[11px] text-muted-foreground">{seg.hint}</span>
                </div>
                <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {seg.items.map((b) => (
                    <li key={b.id}>
                      <BottleCard {...b} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <Section title="🏭 인기 증류소" hint="노트 수 기준">
        {distilleries.length === 0 ? (
          <Empty>아직 노트가 쌓인 증류소가 없어요.</Empty>
        ) : (
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {distilleries.map((d, i) => (
              <li key={d.id}>
                <Link
                  href={`/distilleries/${d.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-3 text-sm transition-colors hover:border-foreground/30 hover:bg-card"
                >
                  <div className="w-5 text-center text-xs tabular-nums text-muted-foreground">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span>{COUNTRY_FLAG[d.country]}</span>
                      <span className="truncate font-medium">
                        {d.name_kr ?? d.name}
                        {d.name_kr && d.name_kr !== d.name && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            {d.name}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.region ?? "—"} · 노트 {d.note_count}
                      {d.avg_score !== null && ` · 평균 ${d.avg_score}`}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </main>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="font-serif text-xl tracking-tight">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
