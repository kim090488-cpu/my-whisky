import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Lock, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  COUNTRY_FLAG, COUNTRY_LABEL, CASK_LABEL, BOTTLER_LABEL,
  formatAge, formatAbv, formatScore,
} from "@/lib/format";
import { AddCollectionForm } from "./_add-collection";
import { BottlingGallery } from "@/components/bottle/bottling-gallery";
import { BottlingImageUploader } from "@/components/upload/image-uploader";
import { tastingPhotoUrl } from "@/lib/uploads/storage";
import { LikeButton } from "@/components/social/like-button";
import { CommentsThread } from "@/components/social/comments-thread";
import { ReportButton } from "@/components/social/report-button";
import { Flag } from "lucide-react";
import { PriceSection } from "./_price-section";
import { WhiskyEditionCard } from "./_whisky-edition-card";
import { VerdictBox, VerdictEmpty, type VerdictData } from "./_verdict-box";
import { buildReviewSummary } from "@/lib/tastings/review-summary";
import { FlavorProfile } from "./_flavor-profile";
import { ScoreDistribution } from "./_score-distribution";
import { FlavorHighlights } from "./_flavor-highlights";
import { NotesFilterBar } from "@/components/social/notes-filter-bar";
import {
  loadSimilarTastersForBottling,
  type SimilarTaster,
} from "@/lib/social/similar-tasters";
import { SimilarTastersSection } from "@/components/social/similar-tasters-section";
import { loadBottlingFans, type BottlingFan } from "@/lib/social/bottling-fans";
import { BottlingFansSection } from "@/components/social/bottling-fans-section";
import {
  FLAVOR_COLUMN,
  FLAVOR_THRESHOLD,
  parseFlavors,
  type FlavorTag,
} from "@/lib/tastings/flavor-filters";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  notes_sort?: string;
  notes_page?: string;
  notes_min_score?: string;
  notes_buyback?: string;
  notes_flavors?: string;
}>;

const NOTES_MIN_SCORES = new Set(["80", "85", "90"]);

const NOTES_PER_PAGE = 20;
const NOTES_SORTS = [
  { value: "recent", label: "최근" },
  { value: "score",  label: "점수" },
  { value: "likes",  label: "좋아요" },
] as const;
type NotesSort = (typeof NOTES_SORTS)[number]["value"];

function computeMedianKrw(
  rows: { purchase_price: number | string | null; purchase_currency: string | null }[],
  rates: Map<string, { krw_per_unit: number; fetched_at: string }>,
): { median: number | null; count: number } {
  const values: number[] = [];
  for (const r of rows) {
    if (r.purchase_price == null) continue;
    const price = Number(r.purchase_price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const currency = r.purchase_currency ?? "KRW";
    if (currency === "KRW") {
      values.push(price);
      continue;
    }
    const rate = rates.get(currency);
    if (rate?.krw_per_unit) values.push(price * rate.krw_per_unit);
  }
  if (values.length === 0) return { median: null, count: 0 };
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  const median =
    values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
  return { median: Math.round(median), count: values.length };
}

export default async function BottlingDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const notesSort: NotesSort = NOTES_SORTS.some((s) => s.value === sp.notes_sort)
    ? (sp.notes_sort as NotesSort)
    : "recent";
  const notesPage = Math.max(1, Number(sp.notes_page) || 1);
  const notesOffset = (notesPage - 1) * NOTES_PER_PAGE;
  const notesMinScore: string | null = NOTES_MIN_SCORES.has(sp.notes_min_score ?? "")
    ? (sp.notes_min_score as string)
    : null;
  const notesBuyback = sp.notes_buyback === "1";
  const notesFlavors: FlavorTag[] = parseFlavors(sp.notes_flavors);
  const supabase = await createClient();

  const { data: b } = await supabase
    .from("bottlings")
    .select(`
      id, name, name_kr, age_years, abv, vintage_year, bottling_year,
      cask_type, bottler, bottler_name, bottle_size_ml, total_bottles, notes,
      created_by,
      distillery:distilleries(id, name, name_kr, country, region, status, founded_year)
    `)
    .eq("id", id)
    .maybeSingle();

  if (!b) notFound();

  const d = Array.isArray(b.distillery) ? b.distillery[0] : b.distillery;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 유사 취향 테이스터 (viewer 있을 때만) — 별도 병렬 fetch
  const similarTastersPromise: Promise<SimilarTaster[]> = user
    ? loadSimilarTastersForBottling(supabase, id, user.id)
    : Promise.resolve<SimilarTaster[]>([]);
  const bottlingFansPromise: Promise<BottlingFan[]> = loadBottlingFans(supabase, id, {
    excludeUserId: user?.id ?? null,
  });

  let tastingsQuery = supabase
    .from("tastings")
    .select(
      "id, tasted_at, score, notes, photos, visibility, user_id, like_count, comment_count, would_buy_again, value_for_money, recommended_for, purchase_price, purchase_currency, sweetness, smokiness, fruitiness, spiciness, smoothness, complexity, finish_length",
      { count: "exact" },
    )
    .eq("bottling_id", id);
  if (notesMinScore !== null) tastingsQuery = tastingsQuery.gte("score", Number(notesMinScore));
  if (notesBuyback) tastingsQuery = tastingsQuery.eq("would_buy_again", true);
  for (const f of notesFlavors) {
    tastingsQuery = tastingsQuery.gte(FLAVOR_COLUMN[f], FLAVOR_THRESHOLD);
  }
  switch (notesSort) {
    case "score":
      tastingsQuery = tastingsQuery.order("score", { ascending: false, nullsFirst: false });
      break;
    case "likes":
      tastingsQuery = tastingsQuery.order("like_count", { ascending: false });
      break;
    case "recent":
    default:
      tastingsQuery = tastingsQuery.order("tasted_at", { ascending: false });
      break;
  }
  const tastingsQueryPaged = tastingsQuery.range(notesOffset, notesOffset + NOTES_PER_PAGE - 1);

  const [
    { data: tastingsRaw, count: tastingsCount },
    { data: images },
    { data: pricesRaw },
    { data: extReview },
    { data: ratesRaw },
    { data: verdictRaw },
    { data: verdictPriceRowsRaw },
  ] = await Promise.all([
    tastingsQueryPaged,
    supabase
      .from("bottling_images")
      .select("id, storage_path, caption, uploaded_by")
      .eq("bottling_id", id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("price_records")
      .select("id, price, currency, source, source_url, place, recorded_at, user_id")
      .eq("bottling_id", id)
      .order("recorded_at", { ascending: false })
      .limit(10),
    supabase
      .from("bottling_external_reviews")
      .select(
        "source_url, reviewer_a_name, reviewer_a_score, reviewer_b_name, reviewer_b_score, " +
          "nose, palate, finish, conclusion_a, conclusion_b, " +
          "price_per_liter, price_currency, flavour, image_url",
      )
      .eq("bottling_id", id)
      .eq("source", "whisky_edition")
      .maybeSingle(),
    supabase.from("currency_rates").select("code, krw_per_unit, fetched_at"),
    supabase
      .from("bottling_verdict_stats")
      .select("*")
      .eq("bottling_id", id)
      .maybeSingle(),
    supabase
      .from("tastings")
      .select("purchase_price, purchase_currency")
      .eq("bottling_id", id)
      .eq("visibility", "public")
      .not("purchase_price", "is", null),
  ]);

  const { data: ratingRowsRaw } = await supabase
    .from("tastings")
    .select("score, value_for_money")
    .eq("bottling_id", id)
    .eq("visibility", "public");
  const ratingRows = (ratingRowsRaw ?? []) as Array<{
    score: number | null;
    value_for_money: number | null;
  }>;
  const scores: number[] = ratingRows
    .map((r) => r.score)
    .filter((v): v is number => typeof v === "number");
  const valueForMoney: number[] = ratingRows
    .map((r) => r.value_for_money)
    .filter((v): v is number => typeof v === "number");

  const rates = new Map(
    (ratesRaw ?? []).map((r) => [
      r.code,
      { krw_per_unit: Number(r.krw_per_unit), fetched_at: r.fetched_at },
    ]),
  );

  const { median: medianKrwAll, count: medianKrwCount } = computeMedianKrw(
    verdictPriceRowsRaw ?? [],
    rates,
  );

  const verdictBase = verdictRaw as VerdictData & {
    avg_sweetness: number | null;
    avg_smokiness: number | null;
    avg_fruitiness: number | null;
    avg_spiciness: number | null;
    avg_smoothness: number | null;
    avg_complexity: number | null;
    avg_finish_length: number | null;
  } | null;

  const verdict = verdictBase
    ? {
        ...verdictBase,
        median_price_krw: medianKrwAll,
        price_data_count: medianKrwCount,
      }
    : null;

  const priceUserIds = Array.from(
    new Set((pricesRaw ?? []).map((p) => p.user_id).filter((v): v is string => !!v)),
  );
  const priceProfilesById = new Map<string, { username: string; display_name: string | null }>();
  if (priceUserIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", priceUserIds);
    for (const p of profs ?? []) {
      priceProfilesById.set(p.id, { username: p.username, display_name: p.display_name });
    }
  }
  const prices = (pricesRaw ?? []).map((r) => ({
    ...r,
    profile: r.user_id ? priceProfilesById.get(r.user_id) ?? null : null,
  }));

  const userIds = Array.from(new Set((tastingsRaw ?? []).map((t) => t.user_id)));
  const profilesById = new Map<string, { username: string; display_name: string | null }>();
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", userIds);
    for (const p of profs ?? []) {
      profilesById.set(p.id, { username: p.username, display_name: p.display_name });
    }
  }
  const myLikedIds = new Set<string>();
  if (user && tastingsRaw && tastingsRaw.length > 0) {
    const { data: myLikes } = await supabase
      .from("tasting_likes")
      .select("tasting_id")
      .eq("user_id", user.id)
      .in("tasting_id", tastingsRaw.map((t) => t.id));
    for (const l of myLikes ?? []) myLikedIds.add(l.tasting_id);
  }

  const tastings = (tastingsRaw ?? []).map((t) => ({
    ...t,
    profile: profilesById.get(t.user_id) ?? null,
    liked: myLikedIds.has(t.id),
  }));

  const avgScore = verdict?.avg_score ?? null;
  const totalReviews = verdict?.total_reviews ?? 0;

  const [similarTasters, bottlingFans] = await Promise.all([
    similarTastersPromise,
    bottlingFansPromise,
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      <Link
        href="/whiskies"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        카탈로그
      </Link>

      <div className="mt-6 grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ─── 왼쪽: 갤러리 ─── */}
        <div>
          <BottlingGallery images={images ?? []} currentUserId={user?.id ?? null} />
          {user && (
            <div className="mt-3">
              <BottlingImageUploader bottlingId={b.id} />
            </div>
          )}
        </div>

        {/* ─── 오른쪽: 정보 ─── */}
        <div>
          <div className="flex items-baseline gap-2 text-sm text-muted-foreground">
            {d && (
              <>
                <span>{COUNTRY_FLAG[d.country]}</span>
                <Link href={`/distilleries/${d.id}`} className="transition-colors hover:text-foreground">
                  {d.name_kr ?? d.name}
                  {d.name_kr && d.name_kr !== d.name && (
                    <span className="ml-1 text-muted-foreground/60">· {d.name}</span>
                  )}
                </Link>
                <span className="text-border">·</span>
                <span>{d.region ?? COUNTRY_LABEL[d.country]}</span>
              </>
            )}
          </div>

          <div className="mt-2 flex items-start justify-between gap-3">
            <h1 className="font-serif text-4xl leading-tight tracking-tight">{b.name_kr ?? b.name}</h1>
            <div className="flex shrink-0 items-center gap-2 self-start">
              <Link
                href={`/whiskies/${b.id}/history`}
                className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                title="이 보틀링의 수정 이력"
              >
                이력
              </Link>
              {user && (
                <Link
                  href={`/whiskies/${b.id}/edit`}
                  className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                  title="잘못된 정보 수정"
                >
                  정보 수정
                </Link>
              )}
              <ReportButton
                targetTable="bottling"
                targetId={b.id}
                ownerId={null}
                currentUserId={user?.id ?? null}
                loginHref={`/login?next=/whiskies/${b.id}`}
                label={
                  <span className="inline-flex items-center gap-1">
                    <Flag className="size-3" />
                    신고
                  </span>
                }
                className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-red-700/50 hover:text-red-300"
              />
            </div>
          </div>
          {b.name_kr && b.name_kr !== b.name && (
            <p className="mt-1 text-sm text-muted-foreground/70">{b.name}</p>
          )}

          {avgScore !== null && (
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-serif text-4xl text-primary">{avgScore}</span>
              <span className="text-xs text-muted-foreground">
                / 100 · {totalReviews}개 노트
              </span>
            </div>
          )}

          {verdict && (
            <FlavorHighlights
              data={{
                avg_sweetness: verdict.avg_sweetness,
                avg_smokiness: verdict.avg_smokiness,
                avg_fruitiness: verdict.avg_fruitiness,
                avg_spiciness: verdict.avg_spiciness,
                avg_smoothness: verdict.avg_smoothness,
                avg_complexity: verdict.avg_complexity,
                avg_finish_length: verdict.avg_finish_length,
              }}
            />
          )}

          <dl className="mt-7 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
            <Stat label="숙성" value={formatAge(b.age_years)} />
            <Stat label="ABV" value={formatAbv(b.abv)} />
            <Stat label="캐스크" value={b.cask_type ? CASK_LABEL[b.cask_type] : "—"} />
            <Stat
              label="병입자"
              value={BOTTLER_LABEL[b.bottler] + (b.bottler_name ? ` · ${b.bottler_name}` : "")}
            />
            {b.vintage_year && <Stat label="빈티지" value={String(b.vintage_year)} />}
            {b.bottling_year && <Stat label="병입연도" value={String(b.bottling_year)} />}
            {b.bottle_size_ml && <Stat label="용량" value={`${b.bottle_size_ml}ml`} />}
            {b.total_bottles && <Stat label="총 병수" value={`${b.total_bottles}병`} />}
          </dl>

          {b.notes && (
            <p className="mt-7 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{b.notes}</p>
          )}

          <div className="mt-8 border-t border-border pt-6">
            <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              내 컬렉션
            </h2>
            {user ? (
              <AddCollectionForm bottlingId={b.id} />
            ) : (
              <p className="text-sm text-muted-foreground">
                <Link href="/login" className="text-primary hover:underline">로그인</Link>{" "}
                후 컬렉션·위시리스트에 담을 수 있어요.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ─── "살까? 말까?" verdict ─── */}
      {verdict && verdict.total_reviews > 0 ? (
        <VerdictBox
          data={verdict}
          summary={buildReviewSummary({
            total_reviews: verdict.total_reviews,
            avg_score: verdict.avg_score,
            buy_again_yes: verdict.buy_again_yes,
            buy_again_responses: verdict.buy_again_responses,
            avg_value_for_money: verdict.avg_value_for_money,
            avg_sweetness: verdict.avg_sweetness,
            avg_smokiness: verdict.avg_smokiness,
            avg_fruitiness: verdict.avg_fruitiness,
            avg_spiciness: verdict.avg_spiciness,
            avg_smoothness: verdict.avg_smoothness,
            avg_complexity: verdict.avg_complexity,
            avg_finish_length: verdict.avg_finish_length,
          })}
        />
      ) : (
        <VerdictEmpty />
      )}
      <FlavorProfile
        data={
          verdict ?? {
            avg_sweetness: null,
            avg_smokiness: null,
            avg_fruitiness: null,
            avg_spiciness: null,
            avg_smoothness: null,
            avg_complexity: null,
            avg_finish_length: null,
          }
        }
      />

      <ScoreDistribution scores={scores} valueForMoney={valueForMoney} />

      {extReview && <WhiskyEditionCard review={extReview} rates={rates} />}

      <PriceSection
        bottlingId={b.id}
        records={prices}
        currentUserId={user?.id ?? null}
      />

      {bottlingFans.length > 0 && (
        <div className="mt-10">
          <BottlingFansSection fans={bottlingFans} />
        </div>
      )}

      {similarTasters.length > 0 && (
        <div className="mt-10">
          <SimilarTastersSection tasters={similarTasters} />
        </div>
      )}

      {/* ─── 테이스팅 노트 ─── */}
      <section id="tasting-notes" className="mt-14 border-t border-border pt-8 scroll-mt-4">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-2xl tracking-tight">
            테이스팅 노트
            {tastingsCount ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                · {tastingsCount.toLocaleString()}
              </span>
            ) : null}
          </h2>
          {user ? (
            <Link
              href={`/whiskies/${b.id}/tastings/new`}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              + 노트 작성
            </Link>
          ) : (
            <Link
              href={`/login?next=/whiskies/${b.id}/tastings/new`}
              className="text-sm text-primary hover:underline"
            >
              로그인하고 작성
            </Link>
          )}
        </div>

        <NotesFilterBar
          sort={notesSort}
          minScore={notesMinScore}
          buyback={notesBuyback}
          flavors={notesFlavors}
        />

        <ul className="space-y-4">
          {tastings.map((t) => {
            const p = t.profile;
            return (
              <li key={t.id} className="rounded-xl border border-border bg-card/50 p-5 transition-colors hover:bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="flex flex-wrap items-center gap-2">
                    {p?.username ? (
                      <Link href={`/profile/${p.username}`} className="font-medium text-foreground/85 transition-colors hover:text-foreground">
                        {p.display_name ?? p.username}
                      </Link>
                    ) : (
                      <span className="text-foreground/60">익명</span>
                    )}
                    <span className="text-border">·</span>
                    <Link
                      href={`/tastings/${t.id}`}
                      className="tabular-nums transition-colors hover:text-foreground"
                      title="이 노트 단독 페이지로"
                    >
                      {t.tasted_at}
                    </Link>
                    {t.user_id === user?.id && (
                      <>
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                          내 노트
                        </span>
                        <Link
                          href={`/tastings/${t.id}/edit`}
                          className="text-[10px] text-muted-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
                        >
                          수정
                        </Link>
                      </>
                    )}
                    {t.visibility !== "public" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                        {t.visibility === "private" ? <Lock className="size-2.5" /> : <Users className="size-2.5" />}
                        {t.visibility === "private" ? "비공개" : "팔로워만"}
                      </span>
                    )}
                  </span>
                  <span className="font-serif text-base text-primary">{formatScore(t.score)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {t.would_buy_again === true && (
                    <span className="rounded-full border border-emerald-700/40 bg-emerald-400/10 px-2 py-0.5 text-emerald-300">
                      ✓ 다시 살래요
                    </span>
                  )}
                  {t.would_buy_again === false && (
                    <span className="rounded-full border border-rose-700/40 bg-rose-400/10 px-2 py-0.5 text-rose-300">
                      ✗ 다시 안 살래요
                    </span>
                  )}
                  {t.value_for_money !== null && (
                    <span className="rounded-full border border-border bg-secondary/30 px-2 py-0.5 text-muted-foreground">
                      가성비 {t.value_for_money}/5
                    </span>
                  )}
                  {t.purchase_price !== null && (
                    <span className="rounded-full border border-border bg-secondary/30 px-2 py-0.5 text-muted-foreground">
                      구매가 {t.purchase_currency ?? "KRW"}{" "}
                      {Number(t.purchase_price).toLocaleString()}
                    </span>
                  )}
                  {pickTastingFlavorLabels(t).map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-amber-300"
                    >
                      {label}
                    </span>
                  ))}
                </div>
                {t.notes && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{t.notes}</p>
                )}
                {t.photos && t.photos.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {t.photos.map((path) => {
                      const url = tastingPhotoUrl(path);
                      return url ? (
                        <a
                          key={path}
                          href={url}
                          target="_blank"
                          rel="noopener"
                          className="h-20 w-20 overflow-hidden rounded-md border border-border transition-colors hover:border-foreground/30"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </a>
                      ) : null;
                    })}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-end gap-3 border-t border-border pt-3">
                  <ReportButton
                    targetTable="tasting"
                    targetId={t.id}
                    ownerId={t.user_id}
                    currentUserId={user?.id ?? null}
                    loginHref={`/login?next=/whiskies/${b.id}`}
                  />
                  <CommentsThread
                    tastingId={t.id}
                    initialCount={t.comment_count}
                    currentUserId={user?.id ?? null}
                    loginHref={`/login?next=/whiskies/${b.id}`}
                  />
                  <LikeButton
                    tastingId={t.id}
                    initialLiked={t.liked}
                    initialCount={t.like_count}
                    currentUserId={user?.id ?? null}
                    loginHref={`/login?next=/whiskies/${b.id}`}
                  />
                </div>
              </li>
            );
          })}
          {tastings.length === 0 && (
            <li className="rounded-xl border border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
              {notesPage > 1
                ? "이 페이지에는 노트가 없습니다."
                : "아직 공개 테이스팅 노트가 없습니다."}
            </li>
          )}
        </ul>

        <NotesPagination
          bottlingId={b.id}
          page={notesPage}
          total={tastingsCount ?? 0}
          sort={notesSort}
          minScore={notesMinScore}
          buyback={notesBuyback}
          flavors={notesFlavors}
        />
      </section>
    </main>
  );
}

const CARD_FLAVOR_TAGS = [
  { key: "sweetness",     label: "달콤" },
  { key: "smokiness",     label: "스모키" },
  { key: "fruitiness",    label: "과일" },
  { key: "spiciness",     label: "스파이시" },
  { key: "smoothness",    label: "부드러운" },
  { key: "complexity",    label: "복잡한" },
  { key: "finish_length", label: "긴 여운" },
] as const;
const CARD_FLAVOR_THRESHOLD = 7;
const CARD_FLAVOR_MAX = 3;

function pickTastingFlavorLabels(
  t: Record<string, unknown>,
): string[] {
  const scored: { label: string; value: number }[] = [];
  for (const tag of CARD_FLAVOR_TAGS) {
    const v = t[tag.key];
    if (typeof v === "number" && v >= CARD_FLAVOR_THRESHOLD) {
      scored.push({ label: tag.label, value: v });
    }
  }
  scored.sort((a, b) => b.value - a.value);
  return scored.slice(0, CARD_FLAVOR_MAX).map((s) => s.label);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-foreground">{value}</dd>
    </div>
  );
}

function NotesPagination({
  bottlingId,
  page,
  total,
  sort,
  minScore,
  buyback,
  flavors,
}: {
  bottlingId: string;
  page: number;
  total: number;
  sort: NotesSort;
  minScore: string | null;
  buyback: boolean;
  flavors: FlavorTag[];
}) {
  const totalPages = Math.max(1, Math.ceil(total / NOTES_PER_PAGE));
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (sort !== "recent") params.set("notes_sort", sort);
    if (minScore) params.set("notes_min_score", minScore);
    if (buyback) params.set("notes_buyback", "1");
    if (flavors.length > 0) params.set("notes_flavors", flavors.join(","));
    if (p > 1) params.set("notes_page", String(p));
    const qs = params.toString();
    return `/whiskies/${bottlingId}${qs ? `?${qs}` : ""}#tasting-notes`;
  };

  const btn =
    "inline-flex items-center gap-1 rounded-md border border-border bg-card/40 px-3 py-1.5 text-sm transition-colors hover:border-foreground/30 hover:bg-card";
  const disabled = "pointer-events-none opacity-40";
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav className="mt-8 flex items-center justify-center gap-3 text-sm">
      <Link
        href={hrefFor(Math.max(1, page - 1))}
        aria-disabled={prevDisabled}
        scroll={false}
        className={btn + (prevDisabled ? " " + disabled : "")}
      >
        <ChevronLeft className="size-3.5" /> 이전
      </Link>
      <span className="text-muted-foreground tabular-nums">
        {page} / {totalPages}
      </span>
      <Link
        href={hrefFor(Math.min(totalPages, page + 1))}
        aria-disabled={nextDisabled}
        scroll={false}
        className={btn + (nextDisabled ? " " + disabled : "")}
      >
        다음 <ChevronRight className="size-3.5" />
      </Link>
    </nav>
  );
}
