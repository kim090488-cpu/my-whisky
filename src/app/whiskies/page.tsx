import { Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { WhiskyFilters } from "@/components/filters/whisky-filters";
import { SortSelect } from "@/components/filters/sort-select";
import { PageSizeSelect } from "@/components/filters/page-size-select";
import { Pagination } from "@/components/pagination";
import { BottleCard } from "@/components/bottle/bottle-card";
import { parseSearchParams } from "@/lib/whiskies/filters";
import type { WhiskyCountry } from "@/types/database";
import { FLAVOR_COLUMN, FLAVOR_THRESHOLD, FLAVOR_TAGS } from "@/lib/tastings/flavor-filters";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function WhiskiesPage({ searchParams }: { searchParams: SearchParams }) {
  const spObj = await searchParams;
  const filters = parseSearchParams(spObj);

  const supabase = await createClient();

  const { data: distRegions } = await supabase
    .from("distilleries")
    .select("country, region");

  const regionsByCountry: Record<string, string[]> = {};
  for (const d of distRegions ?? []) {
    if (!d.region) continue;
    const key = d.country;
    if (!regionsByCountry[key]) regionsByCountry[key] = [];
    if (!regionsByCountry[key].includes(d.region)) regionsByCountry[key].push(d.region);
  }
  Object.values(regionsByCountry).forEach((arr) => arr.sort());

  const offset = (filters.page - 1) * filters.pageSize;
  let q = supabase.from("bottling_card_stats").select("*", { count: "exact" });

  if (filters.q)       q = q.ilike("name", `%${filters.q}%`);
  if (filters.country) q = q.eq("country", filters.country as WhiskyCountry);
  if (filters.region)  q = q.eq("region", filters.region);
  if (filters.cask)    q = q.eq("cask_type", filters.cask);
  if (filters.age_min !== null) q = q.gte("age_years", filters.age_min);
  if (filters.age_max !== null) q = q.lte("age_years", filters.age_max);
  if (filters.abv_min !== null) q = q.gte("abv", filters.abv_min);
  if (filters.abv_max !== null) q = q.lte("abv", filters.abv_max);
  for (const f of filters.flavors) {
    q = q.gte(`avg_${FLAVOR_COLUMN[f]}`, FLAVOR_THRESHOLD);
  }

  switch (filters.sort) {
    case "score":     q = q.order("avg_score",          { ascending: false, nullsFirst: false }); break;
    case "value":     q = q.order("avg_value_for_money", { ascending: false, nullsFirst: false }); break;
    case "buy_again": q = q.order("buy_again_pct",      { ascending: false, nullsFirst: false }); break;
    case "tastings":  q = q.order("tasting_count",      { ascending: false }); break;
    case "age_desc":  q = q.order("age_years",          { ascending: false, nullsFirst: false }); break;
    case "age_asc":   q = q.order("age_years",          { ascending: true,  nullsFirst: false }); break;
    case "abv_desc":  q = q.order("abv",                { ascending: false, nullsFirst: false }); break;
    case "name":      q = q.order("name",               { ascending: true }); break;
    case "recent":
    default:          q = q.order("created_at",         { ascending: false }); break;
  }

  q = q.range(offset, offset + filters.pageSize - 1);

  const { data: bottlings, count, error } = await q;

  const currentSP = new URLSearchParams();
  for (const [k, v] of Object.entries(spObj)) {
    if (typeof v === "string" && v) currentSP.set(k, v);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      {/* Header */}
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">위스키 카탈로그</h1>
          <div className="mt-2 flex items-baseline gap-3 text-sm text-muted-foreground">
            {count !== null && count !== undefined && (
              <span className="tabular-nums">{count.toLocaleString()}개의 보틀링</span>
            )}
            <span className="text-border">·</span>
            <Link
              href="/contribute/bottling/new"
              className="inline-flex items-center gap-1 text-primary transition-opacity hover:opacity-80"
            >
              <Plus className="size-3.5" />
              새 보틀링 추가
            </Link>
          </div>
        </div>

        {/* Search */}
        <form className="flex w-full max-w-md items-center gap-0">
          {Object.entries(spObj).map(([k, v]) =>
            typeof v === "string" && v && k !== "q" && k !== "page" ? (
              <input key={k} type="hidden" name={k} value={v} />
            ) : null,
          )}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="이름으로 검색"
              className="w-full rounded-l-md border border-border bg-card py-2.5 pl-9 pr-3 text-sm placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-r-md border border-l-0 border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            검색
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr]">
        {/* Filters */}
        <div>
          <details className="rounded-lg border border-border bg-card/40 p-4 lg:hidden">
            <summary className="cursor-pointer text-sm font-medium text-foreground/80">필터</summary>
            <div className="mt-4">
              <WhiskyFilters filters={filters} regionsByCountry={regionsByCountry} />
            </div>
          </details>
          <div className="hidden lg:block">
            <WhiskyFilters filters={filters} regionsByCountry={regionsByCountry} />
          </div>
        </div>

        {/* Results */}
        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <ActiveFilterChips
              filters={filters}
              regionsByCountry={regionsByCountry}
              currentSP={currentSP}
            />
            <div className="ml-auto flex items-center gap-2">
              <PageSizeSelect value={filters.pageSize} />
              <SortSelect value={filters.sort} />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error.message}
              <div className="mt-2 text-xs opacity-70">
                마이그레이션 `20260622120000_bottling_card_stats_view.sql`을 Supabase에 적용했는지 확인하세요.
              </div>
            </div>
          )}

          {bottlings && bottlings.length > 0 ? (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {bottlings.map((b) => (
                <li key={b.id}>
                  <BottleCard {...b} />
                </li>
              ))}
            </ul>
          ) : (
            !error && (
              <div className="rounded-xl border border-border bg-card/40 p-16 text-center">
                <p className="text-sm text-muted-foreground">
                  해당 조건의 보틀링이 없어요.
                </p>
              </div>
            )
          )}

          <Pagination
            basePath="/whiskies"
            page={filters.page}
            pageSize={filters.pageSize}
            total={count ?? 0}
            currentSearchParams={currentSP}
          />
        </div>
      </div>
    </main>
  );
}

import { COUNTRY_LABEL, CASK_LABEL } from "@/lib/format";
import type { CaskType } from "@/types/database";
import Link from "next/link";
import type { Filters } from "@/lib/whiskies/filters";

function ActiveFilterChips({
  filters, currentSP,
}: { filters: Filters; regionsByCountry: Record<string, string[]>; currentSP: URLSearchParams }) {
  type Chip = { label: string; key: keyof Filters; flavor?: string };
  const chips: Chip[] = [];
  if (filters.country) chips.push({ label: COUNTRY_LABEL[filters.country as WhiskyCountry], key: "country" });
  if (filters.region)  chips.push({ label: filters.region, key: "region" });
  if (filters.cask)    chips.push({ label: CASK_LABEL[filters.cask as CaskType], key: "cask" });
  if (filters.age_min !== null || filters.age_max !== null) {
    chips.push({
      label: `${filters.age_min ?? 0}–${filters.age_max ?? "∞"}년`,
      key: "age_min",
    });
  }
  if (filters.abv_min !== null || filters.abv_max !== null) {
    chips.push({
      label: `${filters.abv_min ?? 0}–${filters.abv_max ?? "∞"}%`,
      key: "abv_min",
    });
  }
  for (const tag of filters.flavors) {
    const spec = FLAVOR_TAGS.find((t) => t.value === tag);
    if (spec) chips.push({ label: spec.label, key: "flavors", flavor: tag });
  }

  if (chips.length === 0) return <div />;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c, i) => {
        const sp = new URLSearchParams(currentSP);
        if (c.key === "country") { sp.delete("country"); sp.delete("region"); }
        else if (c.key === "age_min") { sp.delete("age_min"); sp.delete("age_max"); }
        else if (c.key === "abv_min") { sp.delete("abv_min"); sp.delete("abv_max"); }
        else if (c.key === "flavors" && c.flavor) {
          const remaining = filters.flavors.filter((v) => v !== c.flavor);
          if (remaining.length === 0) sp.delete("flavors");
          else sp.set("flavors", remaining.join(","));
        }
        else sp.delete(c.key);
        sp.delete("page");
        const qs = sp.toString();
        return (
          <Link
            key={`${c.key}-${c.flavor ?? i}`}
            href={`/whiskies${qs ? `?${qs}` : ""}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-accent/40 px-3 py-1 text-xs text-foreground/80 transition-colors hover:border-foreground/40 hover:text-foreground"
          >
            {c.label} <span className="text-muted-foreground">×</span>
          </Link>
        );
      })}
    </div>
  );
}
