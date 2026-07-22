import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Pagination } from "@/components/pagination";
import { TastingTile, type TastingTileData } from "@/components/social/tasting-tile";
import { COUNTRY_LABEL } from "@/lib/format";
import type { WhiskyCountry, TastingVisibility } from "@/types/database";
import { FilterBar } from "@/app/tastings/_filter-bar";
import {
  FLAVOR_COLUMN,
  FLAVOR_THRESHOLD,
  parseFlavors,
  type FlavorTag,
} from "@/lib/tastings/flavor-filters";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "내 테이스팅 노트 · my-whisky",
};

const PAGE_SIZE = 20;
const SORTS = ["recent", "score", "likes"] as const;
type Sort = (typeof SORTS)[number];
const MIN_SCORES = new Set(["80", "85", "90"]);
const COUNTRY_KEYS = new Set(Object.keys(COUNTRY_LABEL));
const VISIBILITIES = new Set<TastingVisibility>(["public", "followers", "private"]);

type SearchParams = Promise<{
  sort?: string;
  page?: string;
  country?: string;
  min_score?: string;
  buyback?: string;
  flavors?: string;
  visibility?: string;
}>;

export default async function MyTastingsPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const sort: Sort = SORTS.includes(sp.sort as Sort) ? (sp.sort as Sort) : "recent";
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const country: WhiskyCountry | null = COUNTRY_KEYS.has(sp.country ?? "")
    ? (sp.country as WhiskyCountry)
    : null;
  const minScore: string | null = MIN_SCORES.has(sp.min_score ?? "")
    ? (sp.min_score as string)
    : null;
  const buyback = sp.buyback === "1";
  const flavors: FlavorTag[] = parseFlavors(sp.flavors);
  const visibility: TastingVisibility | null = VISIBILITIES.has(sp.visibility as TastingVisibility)
    ? (sp.visibility as TastingVisibility)
    : null;

  let bottlingIdFilter: string[] | null = null;
  if (country) {
    const { data: idsRaw } = await supabase
      .from("bottling_card_stats")
      .select("id")
      .eq("country", country);
    bottlingIdFilter = (idsRaw ?? [])
      .map((r) => r.id)
      .filter((v): v is string => !!v);
  }
  const noResults = bottlingIdFilter !== null && bottlingIdFilter.length === 0;

  let tastingsRaw: Array<Record<string, unknown>> = [];
  let count = 0;

  if (!noResults) {
    let query = supabase
      .from("tastings")
      .select(
        "id, tasted_at, score, notes, photos, visibility, user_id, bottling_id, like_count, comment_count, would_buy_again, value_for_money, created_at, sweetness, smokiness, fruitiness, spiciness, smoothness, complexity, finish_length",
        { count: "exact" },
      )
      .eq("user_id", user.id);

    if (bottlingIdFilter) query = query.in("bottling_id", bottlingIdFilter);
    if (minScore !== null) query = query.gte("score", Number(minScore));
    if (buyback) query = query.eq("would_buy_again", true);
    if (visibility) query = query.eq("visibility", visibility);
    for (const f of flavors) {
      query = query.gte(FLAVOR_COLUMN[f], FLAVOR_THRESHOLD);
    }

    switch (sort) {
      case "score": query = query.order("score", { ascending: false, nullsFirst: false }); break;
      case "likes": query = query.order("like_count", { ascending: false }); break;
      case "recent":
      default:      query = query.order("created_at", { ascending: false }); break;
    }

    const res = await query.range(offset, offset + PAGE_SIZE - 1);
    tastingsRaw = (res.data ?? []) as Array<Record<string, unknown>>;
    count = res.count ?? 0;
  }

  const bottlingIds = Array.from(new Set(tastingsRaw.map((t) => String(t.bottling_id))));

  const bottlingsById = new Map<
    string,
    {
      id: string;
      name: string;
      name_kr: string | null;
      distillery_name: string;
      distillery_name_kr: string | null;
      country: WhiskyCountry;
      label_image_url: string | null;
    }
  >();
  if (bottlingIds.length > 0) {
    const { data } = await supabase
      .from("bottling_card_stats")
      .select("id, name, name_kr, distillery_name, distillery_name_kr, country, label_image_url")
      .in("id", bottlingIds);
    for (const b of data ?? []) bottlingsById.set(b.id!, b as never);
  }

  const myLikedIds = new Set<string>();
  if (tastingsRaw.length > 0) {
    const { data } = await supabase
      .from("tasting_likes")
      .select("tasting_id")
      .eq("user_id", user.id)
      .in("tasting_id", tastingsRaw.map((t) => String(t.id)));
    for (const l of data ?? []) myLikedIds.add(l.tasting_id);
  }

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const tastings: TastingTileData[] = tastingsRaw.map((t) => ({
    ...(t as unknown as TastingTileData),
    profile: myProfile ?? null,
    bottling: bottlingsById.get(String(t.bottling_id)) ?? null,
    liked: myLikedIds.has(String(t.id)),
  }));

  const total = count;
  const loginHref = "/login?next=/me/tastings";

  const paginationParams = new URLSearchParams();
  if (sort !== "recent") paginationParams.set("sort", sort);
  if (country) paginationParams.set("country", country);
  if (minScore) paginationParams.set("min_score", minScore);
  if (buyback) paginationParams.set("buyback", "1");
  if (flavors.length > 0) paginationParams.set("flavors", flavors.join(","));
  if (visibility) paginationParams.set("visibility", visibility);

  const hasFilters =
    country !== null || minScore !== null || buyback ||
    flavors.length > 0 || visibility !== null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <Link href="/me" className="text-sm text-muted-foreground hover:text-foreground">
        ← 내 페이지
      </Link>
      <header className="mt-3 mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">내 테이스팅 노트</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            총 {total.toLocaleString()}개{hasFilters && " (필터됨)"}
          </p>
        </div>
        <Link
          href="/tastings/new"
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-medium text-neutral-950 transition-colors hover:bg-amber-300"
        >
          <Plus className="size-3.5" />
          노트
        </Link>
      </header>

      <FilterBar
        sort={sort}
        country={country}
        minScore={minScore}
        buyback={buyback}
        flavors={flavors}
        visibility={visibility}
        showVisibility
      />

      {tastings.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/40 p-12 text-center text-sm text-muted-foreground">
          {hasFilters ? (
            <>조건에 맞는 노트가 없어요. 필터를 조정해보세요.</>
          ) : (
            <>
              아직 테이스팅 노트가 없어요.{" "}
              <Link href="/whiskies" className="text-primary hover:underline">
                위스키
              </Link>
              를 골라보세요.
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {tastings.map((t) => (
            <TastingTile
              key={t.id}
              tasting={t}
              currentUserId={user.id}
              loginHref={loginHref}
            />
          ))}
        </div>
      )}

      <Pagination
        basePath="/me/tastings"
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        currentSearchParams={paginationParams}
      />
    </main>
  );
}
