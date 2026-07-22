import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BottleCard } from "@/components/bottle/bottle-card";
import type { WhiskyCountry, CaskType } from "@/types/database";
import {
  FLAVOR_COLUMN,
  FLAVOR_THRESHOLD,
  FLAVOR_TAGS,
  parseFlavors,
  type FlavorTag,
} from "@/lib/tastings/flavor-filters";

export const dynamic = "force-dynamic";

const MIN_REBUY_RESPONSES = 3;
const MIN_VALUE_RESPONSES = 3;
const SECTION_LIMIT = 8;

const PICK_COUNTRIES: readonly { value: WhiskyCountry; label: string }[] = [
  { value: "scotland",    label: "스카치" },
  { value: "japan",       label: "재패니즈" },
  { value: "usa",         label: "아메리칸" },
  { value: "ireland",     label: "아이리시" },
  { value: "taiwan",      label: "타이완" },
  { value: "south_korea", label: "국산" },
];
const PICK_COUNTRY_SET = new Set<string>(PICK_COUNTRIES.map((c) => c.value));

type SearchParams = Promise<{
  country?: string;
  flavors?: string;
}>;

export default async function PicksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const country: WhiskyCountry | null =
    sp.country && PICK_COUNTRY_SET.has(sp.country)
      ? (sp.country as WhiskyCountry)
      : null;
  const flavors: FlavorTag[] = parseFlavors(sp.flavors);
  const hasFilters = country !== null || flavors.length > 0;

  const supabase = await createClient();

  let rebuyQ = supabase
    .from("bottling_card_stats")
    .select("*")
    .gte("tasting_count", MIN_REBUY_RESPONSES)
    .not("buy_again_pct", "is", null);
  if (country) rebuyQ = rebuyQ.eq("country", country);
  for (const f of flavors) rebuyQ = rebuyQ.gte(`avg_${FLAVOR_COLUMN[f]}`, FLAVOR_THRESHOLD);

  let beginnerQ = supabase
    .from("bottling_card_stats")
    .select("*")
    .gte("beginner_count", 1);
  if (country) beginnerQ = beginnerQ.eq("country", country);
  for (const f of flavors) beginnerQ = beginnerQ.gte(`avg_${FLAVOR_COLUMN[f]}`, FLAVOR_THRESHOLD);

  let intermediateQ = supabase
    .from("bottling_card_stats")
    .select("*")
    .gte("intermediate_count", 1);
  if (country) intermediateQ = intermediateQ.eq("country", country);
  for (const f of flavors) intermediateQ = intermediateQ.gte(`avg_${FLAVOR_COLUMN[f]}`, FLAVOR_THRESHOLD);

  let expertQ = supabase
    .from("bottling_card_stats")
    .select("*")
    .gte("expert_count", 1);
  if (country) expertQ = expertQ.eq("country", country);
  for (const f of flavors) expertQ = expertQ.gte(`avg_${FLAVOR_COLUMN[f]}`, FLAVOR_THRESHOLD);

  let giftQ = supabase
    .from("bottling_card_stats")
    .select("*")
    .gte("gift_count", 1);
  if (country) giftQ = giftQ.eq("country", country);
  for (const f of flavors) giftQ = giftQ.gte(`avg_${FLAVOR_COLUMN[f]}`, FLAVOR_THRESHOLD);

  let valueQ = supabase
    .from("bottling_card_stats")
    .select("*")
    .gte("tasting_count", MIN_VALUE_RESPONSES)
    .gte("avg_value_for_money", 4);
  if (country) valueQ = valueQ.eq("country", country);
  for (const f of flavors) valueQ = valueQ.gte(`avg_${FLAVOR_COLUMN[f]}`, FLAVOR_THRESHOLD);

  const [
    { data: rebuy },
    { data: beginner },
    { data: intermediate },
    { data: expert },
    { data: gift },
    { data: value },
  ] = await Promise.all([
    rebuyQ
      .order("buy_again_pct", { ascending: false, nullsFirst: false })
      .order("tasting_count", { ascending: false })
      .limit(SECTION_LIMIT),
    beginnerQ
      .order("beginner_count", { ascending: false })
      .order("avg_score", { ascending: false, nullsFirst: false })
      .limit(SECTION_LIMIT),
    intermediateQ
      .order("intermediate_count", { ascending: false })
      .order("avg_score", { ascending: false, nullsFirst: false })
      .limit(SECTION_LIMIT),
    expertQ
      .order("expert_count", { ascending: false })
      .order("avg_score", { ascending: false, nullsFirst: false })
      .limit(SECTION_LIMIT),
    giftQ
      .order("gift_count", { ascending: false })
      .order("avg_score", { ascending: false, nullsFirst: false })
      .limit(SECTION_LIMIT),
    valueQ
      .order("avg_value_for_money", { ascending: false, nullsFirst: false })
      .order("tasting_count", { ascending: false })
      .limit(SECTION_LIMIT),
  ]);

  const hrefForCountry = (target: WhiskyCountry | null): string => {
    const params = new URLSearchParams();
    if (target) params.set("country", target);
    if (flavors.length > 0) params.set("flavors", flavors.join(","));
    const qs = params.toString();
    return `/picks${qs ? `?${qs}` : ""}`;
  };
  const hrefForFlavor = (target: FlavorTag): string => {
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    const next = flavors.includes(target)
      ? flavors.filter((f) => f !== target)
      : [...flavors, target];
    if (next.length > 0) params.set("flavors", next.join(","));
    const qs = params.toString();
    return `/picks${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        홈
      </Link>

      <header className="mt-6 mb-8">
        <h1 className="font-serif text-4xl tracking-tight">맞춤 추천</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          시나리오별로 골라봤어요. 후기가 모일수록 정확해집니다.
        </p>
      </header>

      <FilterBar
        country={country}
        flavors={flavors}
        hrefForCountry={hrefForCountry}
        hrefForFlavor={hrefForFlavor}
        hasFilters={hasFilters}
      />

      <PicksSection
        title="다시 사고 싶은 위스키"
        subtitle={`재구매율이 높다는 건 후회 없는 선택 · 후기 ${MIN_REBUY_RESPONSES}개 이상`}
        bottles={rebuy ?? []}
        hasFilters={hasFilters}
      />
      <PicksSection
        title="처음이라면"
        subtitle="입문자에게 추천한다는 후기가 가장 많이 모인 보틀링"
        bottles={beginner ?? []}
        hasFilters={hasFilters}
      />
      <PicksSection
        title="중급자에게"
        subtitle="위스키에 익숙한 사람들이 중급자용으로 추천한 보틀링"
        bottles={intermediate ?? []}
        hasFilters={hasFilters}
      />
      <PicksSection
        title="전문가에게"
        subtitle="전문가급이 꼽은 깊이 있는 보틀링"
        bottles={expert ?? []}
        hasFilters={hasFilters}
      />
      <PicksSection
        title="선물하기 좋은"
        subtitle="선물용으로 추천받은 보틀링"
        bottles={gift ?? []}
        hasFilters={hasFilters}
      />
      <PicksSection
        title="가성비 갑"
        subtitle={`가격 대비 만족도 4점 이상 · 후기 ${MIN_VALUE_RESPONSES}개 이상`}
        bottles={value ?? []}
        hasFilters={hasFilters}
      />
    </main>
  );
}

function FilterBar({
  country,
  flavors,
  hrefForCountry,
  hrefForFlavor,
  hasFilters,
}: {
  country: WhiskyCountry | null;
  flavors: FlavorTag[];
  hrefForCountry: (target: WhiskyCountry | null) => string;
  hrefForFlavor: (target: FlavorTag) => string;
  hasFilters: boolean;
}) {
  return (
    <div className="mb-10 space-y-3 rounded-xl border border-border bg-card/40 p-4">
      <FilterRow label="지역">
        <FilterChip href={hrefForCountry(null)} active={country === null}>
          전체
        </FilterChip>
        {PICK_COUNTRIES.map((c) => (
          <FilterChip
            key={c.value}
            href={hrefForCountry(c.value)}
            active={country === c.value}
          >
            {c.label}
          </FilterChip>
        ))}
      </FilterRow>
      <FilterRow label="향미">
        {FLAVOR_TAGS.map((f) => (
          <FilterChip
            key={f.value}
            href={hrefForFlavor(f.value)}
            active={flavors.includes(f.value)}
          >
            {f.label}
          </FilterChip>
        ))}
      </FilterRow>
      {hasFilters && (
        <div className="pt-1">
          <Link
            href="/picks"
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            필터 초기화
          </Link>
        </div>
      )}
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={
        "inline-flex items-center rounded-full border px-3 py-0.5 text-xs transition-colors " +
        (active
          ? "border-amber-400 bg-amber-400/10 text-amber-300"
          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground")
      }
    >
      {children}
    </Link>
  );
}

type BottleRow = {
  id: string | null;
  name: string | null;
  name_kr: string | null;
  age_years: number | null;
  abv: number | null;
  cask_type: string | null;
  distillery_name: string | null;
  distillery_name_kr: string | null;
  country: string | null;
  region: string | null;
  label_image_url: string | null;
  avg_score: number | null;
  tasting_count: number | null;
  avg_value_for_money: number | null;
  buy_again_pct: number | null;
};

function PicksSection({
  title,
  subtitle,
  bottles,
  hasFilters,
}: {
  title: string;
  subtitle: string;
  bottles: BottleRow[];
  hasFilters: boolean;
}) {
  return (
    <section className="mt-12">
      <div className="mb-5">
        <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {bottles.length === 0 ? (
        <p className="rounded-xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
          {hasFilters
            ? "선택한 필터에 맞는 보틀링이 없어요. 필터를 조정해보세요."
            : "아직 신호가 모이지 않았어요."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
      )}
    </section>
  );
}
