import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaskType, Database, WhiskyCountry } from "@/types/database";

export type TasteSample = {
  sweetness: number | null;
  smokiness: number | null;
  fruitiness: number | null;
  spiciness: number | null;
  smoothness: number | null;
  complexity: number | null;
  finish_length: number | null;
  score: number | null;
  value_for_money: number | null;
  would_buy_again: boolean | null;
  country: WhiskyCountry | null;
  region: string | null;
  cask_type: CaskType | null;
  age_years: number | null;
  abv: number | null;
  bottling_id: string;
};

export type TasteTagTone = "amber" | "emerald" | "rose" | "sky";

export type TasteTag = {
  key: string;
  label: string;
  hint: string;
  tone: TasteTagTone;
};

export type TasteProfile = {
  total: number;
  avgScore: number | null;
  tags: TasteTag[];
};

const MIN_SAMPLE = 5;
const FLAVOR_AVG_THRESHOLD = 7;
const FLAVOR_ANTI_THRESHOLD = 3.5;
const MAX_FLAVOR_TAGS = 3;
const MAX_ANTI_FLAVOR_TAGS = 2;
const VALUE_THRESHOLD = 4;
const VALUE_MAX = 5;
const BUYBACK_HIGH = 0.6;
const BUYBACK_LOW = 0.25;
const SCORE_MIN_SAMPLE = 10;
const SCORE_HIGH = 88;
const SCORE_LOW = 78;
const COUNTRY_RATIO = 0.35;
const COUNTRY_MIN_COUNT = 5;
const REGION_RATIO = 0.35;
const REGION_MIN_COUNT = 5;
const CASK_RATIO = 0.35;
const CASK_MIN_COUNT = 5;
const AGE_BAND_RATIO = 0.35;
const AGE_BAND_MIN_COUNT = 5;
const ABV_MIN_SAMPLE = 8;
const ABV_HIGH_MIN = 55;
const ABV_HIGH_RATIO = 0.35;
const ABV_STANDARD_MIN = 40;
const ABV_STANDARD_MAX = 46;
const ABV_STANDARD_RATIO = 0.6;
const EXPLORATION_MIN_SAMPLE = 10;
const EXPLORATION_HIGH = 0.85;
const EXPLORATION_LOW = 0.5;

type FlavorKey =
  | "smokiness"
  | "sweetness"
  | "fruitiness"
  | "spiciness"
  | "smoothness"
  | "complexity"
  | "finish_length";

const FLAVOR_FIELDS: readonly { key: FlavorKey; label: string; antiLabel: string }[] = [
  { key: "smokiness",     label: "스모키 애호",     antiLabel: "스모키 기피" },
  { key: "sweetness",     label: "달콤 애호",       antiLabel: "달콤함 기피" },
  { key: "fruitiness",    label: "과일향 애호",     antiLabel: "과일향 기피" },
  { key: "spiciness",     label: "스파이시 애호",   antiLabel: "스파이시 기피" },
  { key: "smoothness",    label: "부드러움 선호",   antiLabel: "부드러움 기피" },
  { key: "complexity",    label: "복잡함 선호",     antiLabel: "단순함 선호" },
  { key: "finish_length", label: "긴 여운 선호",    antiLabel: "짧은 여운 선호" },
];

const COUNTRY_LABEL: Partial<Record<WhiskyCountry, string>> = {
  scotland:    "스카치 러버",
  ireland:     "아이리시 러버",
  usa:         "아메리칸 러버",
  canada:      "캐나디안 러버",
  japan:       "재패니즈 러버",
  india:       "인디안 러버",
  taiwan:      "타이완 러버",
  australia:   "오지 러버",
  france:      "프렌치 러버",
  sweden:      "스웨디시 러버",
  germany:     "저먼 러버",
  south_korea: "국산 러버",
};

const CASK_LABEL: Partial<Record<CaskType, string>> = {
  bourbon:    "버번캐스크 러버",
  sherry:     "셰리캐스크 러버",
  port:       "포트캐스크 러버",
  wine:       "와인캐스크 러버",
  rum:        "럼캐스크 러버",
  virgin_oak: "버진오크 러버",
  refill:     "리필캐스크 선호",
  mixed:      "믹스드캐스크 애호",
};

type AgeBand = "young" | "mid" | "old" | "nas";
const AGE_BAND_LABEL: Record<AgeBand, string> = {
  young: "젊은 위스키 선호",
  mid:   "중간 숙성 선호",
  old:   "고숙성 러버",
  nas:   "NAS 애호",
};

function ageToBand(age: number | null): AgeBand {
  if (age === null) return "nas";
  if (age <= 7) return "young";
  if (age <= 15) return "mid";
  return "old";
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export type FlavorAverage = {
  key: FlavorKey;
  label: string;
  avg: number;
  count: number;
};

export type DistItem = {
  key: string;
  label: string;
  count: number;
  pct: number;
};

export type ScoreBucket = {
  label: string;
  min: number;
  count: number;
};

export type TasteDashboard = {
  total: number;
  avgScore: number | null;
  flavors: FlavorAverage[];
  topCountries: DistItem[];
  topCasks: DistItem[];
  topRegions: DistItem[];
  ageBands: DistItem[];
  scoreBuckets: ScoreBucket[];
  abvBuckets: DistItem[];
};

const DASHBOARD_MAX_COUNTRIES = 5;
const DASHBOARD_MAX_CASKS = 5;
const DASHBOARD_MAX_REGIONS = 3;

const AGE_BAND_ORDER: AgeBand[] = ["young", "mid", "old", "nas"];
const AGE_BAND_SHORT: Record<AgeBand, string> = {
  young: "≤7년",
  mid:   "8~15년",
  old:   "16년+",
  nas:   "NAS",
};

const ABV_BUCKETS: readonly { key: string; label: string; test: (v: number) => boolean }[] = [
  { key: "abv:<40",    label: "<40%",   test: (v) => v < 40 },
  { key: "abv:40-46",  label: "40~46%", test: (v) => v >= 40 && v <= 46 },
  { key: "abv:47-54",  label: "47~54%", test: (v) => v >= 47 && v <= 54 },
  { key: "abv:55+",    label: "55%+",   test: (v) => v >= 55 },
];

const SCORE_BUCKETS: readonly { label: string; min: number; max: number }[] = [
  { label: "<70",   min: 0,  max: 70 },
  { label: "70~79", min: 70, max: 80 },
  { label: "80~89", min: 80, max: 90 },
  { label: "90+",   min: 90, max: 101 },
];

export function buildTasteDashboard(samples: TasteSample[]): TasteDashboard {
  const total = samples.length;
  const scores = samples
    .map((s) => s.score)
    .filter((v): v is number => typeof v === "number");
  const avgScoreRaw = mean(scores);
  const avgScore = avgScoreRaw === null ? null : Math.round(avgScoreRaw * 10) / 10;

  const flavors: FlavorAverage[] = FLAVOR_FIELDS.map((f) => {
    const vals = samples
      .map((s) => s[f.key])
      .filter((v): v is number => typeof v === "number");
    const avg = mean(vals);
    return {
      key: f.key,
      label: f.label.replace(/\s?(애호|선호)$/, ""),
      avg: avg ?? 0,
      count: vals.length,
    };
  });

  const countryCount = new Map<WhiskyCountry, number>();
  for (const s of samples) {
    if (s.country) countryCount.set(s.country, (countryCount.get(s.country) ?? 0) + 1);
  }
  const topCountries: DistItem[] = Array.from(countryCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, DASHBOARD_MAX_COUNTRIES)
    .map(([c, n]) => ({
      key: `country:${c}`,
      label: COUNTRY_LABEL[c]?.replace(/\s?러버$/, "") ?? c,
      count: n,
      pct: total > 0 ? Math.round((n / total) * 100) : 0,
    }));

  const caskCount = new Map<CaskType, number>();
  for (const s of samples) {
    if (s.cask_type && s.cask_type !== "unknown" && s.cask_type !== "other") {
      caskCount.set(s.cask_type, (caskCount.get(s.cask_type) ?? 0) + 1);
    }
  }
  const topCasks: DistItem[] = Array.from(caskCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, DASHBOARD_MAX_CASKS)
    .map(([c, n]) => ({
      key: `cask:${c}`,
      label: CASK_LABEL[c]?.replace(/\s?(러버|선호|애호)$/, "") ?? c,
      count: n,
      pct: total > 0 ? Math.round((n / total) * 100) : 0,
    }));

  const regionCount = new Map<string, number>();
  for (const s of samples) {
    if (s.region) regionCount.set(s.region, (regionCount.get(s.region) ?? 0) + 1);
  }
  const topRegions: DistItem[] = Array.from(regionCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, DASHBOARD_MAX_REGIONS)
    .map(([r, n]) => ({
      key: `region:${r.toLowerCase()}`,
      label: r,
      count: n,
      pct: total > 0 ? Math.round((n / total) * 100) : 0,
    }));

  const ageBandCount = new Map<AgeBand, number>();
  for (const s of samples) {
    const band = ageToBand(s.age_years);
    ageBandCount.set(band, (ageBandCount.get(band) ?? 0) + 1);
  }
  const ageBands: DistItem[] = AGE_BAND_ORDER.filter((b) => (ageBandCount.get(b) ?? 0) > 0).map(
    (b) => {
      const n = ageBandCount.get(b) ?? 0;
      return {
        key: `age:${b}`,
        label: AGE_BAND_SHORT[b],
        count: n,
        pct: total > 0 ? Math.round((n / total) * 100) : 0,
      };
    },
  );

  const scoreBuckets: ScoreBucket[] = SCORE_BUCKETS.map((bucket) => ({
    label: bucket.label,
    min: bucket.min,
    count: scores.filter((v) => v >= bucket.min && v < bucket.max).length,
  }));

  const abvVals = samples
    .map((s) => s.abv)
    .filter((v): v is number => typeof v === "number");
  const abvTotal = abvVals.length;
  const abvBuckets: DistItem[] = ABV_BUCKETS.map((bucket) => {
    const count = abvVals.filter(bucket.test).length;
    return {
      key: bucket.key,
      label: bucket.label,
      count,
      pct: abvTotal > 0 ? Math.round((count / abvTotal) * 100) : 0,
    };
  }).filter((b) => b.count > 0);

  return {
    total,
    avgScore,
    flavors,
    topCountries,
    topCasks,
    topRegions,
    ageBands,
    scoreBuckets,
    abvBuckets,
  };
}

export function buildTasteProfile(samples: TasteSample[]): TasteProfile {
  const total = samples.length;

  const scores = samples
    .map((s) => s.score)
    .filter((v): v is number => typeof v === "number");
  const avgScoreRaw = mean(scores);
  const avgScore =
    avgScoreRaw === null ? null : Math.round(avgScoreRaw * 10) / 10;

  if (total < MIN_SAMPLE) {
    return { total, avgScore, tags: [] };
  }

  const tags: TasteTag[] = [];

  const flavorStats = FLAVOR_FIELDS.map((f) => {
    const vals = samples
      .map((s) => s[f.key])
      .filter((v): v is number => typeof v === "number");
    return { field: f, avg: mean(vals), count: vals.length };
  });

  const highFlavors = flavorStats
    .filter(
      (r): r is { field: (typeof FLAVOR_FIELDS)[number]; avg: number; count: number } =>
        r.avg !== null && r.avg >= FLAVOR_AVG_THRESHOLD && r.count >= MIN_SAMPLE,
    )
    .sort((a, b) => b.avg - a.avg)
    .slice(0, MAX_FLAVOR_TAGS);

  for (const r of highFlavors) {
    tags.push({
      key: `flavor:${r.field.key}`,
      label: r.field.label,
      hint: `평균 ${r.avg.toFixed(1)}/10 · ${r.count}개 노트`,
      tone: "amber",
    });
  }

  const lowFlavors = flavorStats
    .filter(
      (r): r is { field: (typeof FLAVOR_FIELDS)[number]; avg: number; count: number } =>
        r.avg !== null && r.avg <= FLAVOR_ANTI_THRESHOLD && r.count >= MIN_SAMPLE,
    )
    .sort((a, b) => a.avg - b.avg)
    .slice(0, MAX_ANTI_FLAVOR_TAGS);

  for (const r of lowFlavors) {
    tags.push({
      key: `anti-flavor:${r.field.key}`,
      label: r.field.antiLabel,
      hint: `평균 ${r.avg.toFixed(1)}/10 · ${r.count}개 노트`,
      tone: "rose",
    });
  }

  const valueVals = samples
    .map((s) => s.value_for_money)
    .filter((v): v is number => typeof v === "number");
  const valueAvg = mean(valueVals);
  if (
    valueVals.length >= MIN_SAMPLE &&
    valueAvg !== null &&
    valueAvg >= VALUE_THRESHOLD
  ) {
    tags.push({
      key: "value",
      label: "가성비 중시",
      hint: `가성비 평균 ${valueAvg.toFixed(1)}/${VALUE_MAX}`,
      tone: "emerald",
    });
  }

  const buybackVals = samples
    .map((s) => s.would_buy_again)
    .filter((v): v is boolean => typeof v === "boolean");
  if (buybackVals.length >= MIN_SAMPLE) {
    const yes = buybackVals.filter((v) => v).length;
    const ratio = yes / buybackVals.length;
    if (ratio >= BUYBACK_HIGH) {
      tags.push({
        key: "buyback:high",
        label: "재구매 관대",
        hint: `${Math.round(ratio * 100)}%가 다시 구매 의사`,
        tone: "emerald",
      });
    } else if (ratio <= BUYBACK_LOW) {
      tags.push({
        key: "buyback:low",
        label: "재구매 신중",
        hint: `${Math.round(ratio * 100)}%만 다시 구매 의사`,
        tone: "rose",
      });
    }
  }

  if (scores.length >= SCORE_MIN_SAMPLE && avgScoreRaw !== null) {
    if (avgScoreRaw >= SCORE_HIGH) {
      tags.push({
        key: "score:high",
        label: "고득점러",
        hint: `평균 점수 ${avgScoreRaw.toFixed(1)}`,
        tone: "amber",
      });
    } else if (avgScoreRaw <= SCORE_LOW) {
      tags.push({
        key: "score:low",
        label: "깐깐한 별점",
        hint: `평균 점수 ${avgScoreRaw.toFixed(1)}`,
        tone: "rose",
      });
    }
  }

  const countryCount = new Map<WhiskyCountry, number>();
  for (const s of samples) {
    if (s.country) {
      countryCount.set(s.country, (countryCount.get(s.country) ?? 0) + 1);
    }
  }
  let topCountry: { c: WhiskyCountry; n: number } | null = null;
  for (const [c, n] of countryCount) {
    if (!topCountry || n > topCountry.n) topCountry = { c, n };
  }
  if (
    topCountry &&
    topCountry.n >= COUNTRY_MIN_COUNT &&
    topCountry.n / total >= COUNTRY_RATIO
  ) {
    const label = COUNTRY_LABEL[topCountry.c];
    if (label) {
      tags.push({
        key: `country:${topCountry.c}`,
        label,
        hint: `노트의 ${Math.round((topCountry.n / total) * 100)}%가 이 지역`,
        tone: "sky",
      });
    }
  }

  const regionCount = new Map<string, number>();
  for (const s of samples) {
    if (s.region) {
      regionCount.set(s.region, (regionCount.get(s.region) ?? 0) + 1);
    }
  }
  let topRegion: { r: string; n: number } | null = null;
  for (const [r, n] of regionCount) {
    if (!topRegion || n > topRegion.n) topRegion = { r, n };
  }
  if (
    topRegion &&
    topRegion.n >= REGION_MIN_COUNT &&
    topRegion.n / total >= REGION_RATIO
  ) {
    tags.push({
      key: `region:${topRegion.r.toLowerCase()}`,
      label: `${topRegion.r} 러버`,
      hint: `노트의 ${Math.round((topRegion.n / total) * 100)}%가 이 서브지역`,
      tone: "sky",
    });
  }

  const caskCount = new Map<CaskType, number>();
  for (const s of samples) {
    if (s.cask_type && s.cask_type !== "unknown" && s.cask_type !== "other") {
      caskCount.set(s.cask_type, (caskCount.get(s.cask_type) ?? 0) + 1);
    }
  }
  let topCask: { c: CaskType; n: number } | null = null;
  for (const [c, n] of caskCount) {
    if (!topCask || n > topCask.n) topCask = { c, n };
  }
  if (
    topCask &&
    topCask.n >= CASK_MIN_COUNT &&
    topCask.n / total >= CASK_RATIO
  ) {
    const label = CASK_LABEL[topCask.c];
    if (label) {
      tags.push({
        key: `cask:${topCask.c}`,
        label,
        hint: `노트의 ${Math.round((topCask.n / total) * 100)}%가 이 캐스크`,
        tone: "emerald",
      });
    }
  }

  const ageBandCount = new Map<AgeBand, number>();
  for (const s of samples) {
    const band = ageToBand(s.age_years);
    ageBandCount.set(band, (ageBandCount.get(band) ?? 0) + 1);
  }
  let topBand: { b: AgeBand; n: number } | null = null;
  for (const [b, n] of ageBandCount) {
    if (!topBand || n > topBand.n) topBand = { b, n };
  }
  if (
    topBand &&
    topBand.n >= AGE_BAND_MIN_COUNT &&
    topBand.n / total >= AGE_BAND_RATIO
  ) {
    tags.push({
      key: `age:${topBand.b}`,
      label: AGE_BAND_LABEL[topBand.b],
      hint: `노트의 ${Math.round((topBand.n / total) * 100)}%가 이 숙성대`,
      tone: "amber",
    });
  }

  const abvVals = samples
    .map((s) => s.abv)
    .filter((v): v is number => typeof v === "number");
  if (abvVals.length >= ABV_MIN_SAMPLE) {
    const highN = abvVals.filter((v) => v >= ABV_HIGH_MIN).length;
    const stdN = abvVals.filter(
      (v) => v >= ABV_STANDARD_MIN && v <= ABV_STANDARD_MAX,
    ).length;
    const highRatio = highN / abvVals.length;
    const stdRatio = stdN / abvVals.length;
    if (highRatio >= ABV_HIGH_RATIO) {
      tags.push({
        key: "abv:high",
        label: "하이프루프 러버",
        hint: `${Math.round(highRatio * 100)}%가 ${ABV_HIGH_MIN}% 이상`,
        tone: "amber",
      });
    } else if (stdRatio >= ABV_STANDARD_RATIO) {
      tags.push({
        key: "abv:standard",
        label: "표준 도수 선호",
        hint: `${Math.round(stdRatio * 100)}%가 ${ABV_STANDARD_MIN}~${ABV_STANDARD_MAX}%`,
        tone: "amber",
      });
    }
  }

  if (total >= EXPLORATION_MIN_SAMPLE) {
    const uniqueCount = new Set(samples.map((s) => s.bottling_id)).size;
    const ratio = uniqueCount / total;
    if (ratio >= EXPLORATION_HIGH) {
      tags.push({
        key: "exploration:high",
        label: "탐험가",
        hint: `${uniqueCount}종 · 대부분 새로운 시음`,
        tone: "emerald",
      });
    } else if (ratio <= EXPLORATION_LOW) {
      tags.push({
        key: "exploration:low",
        label: "단골형",
        hint: `${uniqueCount}종을 ${total}회 시음 · 반복 성향`,
        tone: "emerald",
      });
    }
  }

  return { total, avgScore, tags };
}

async function loadTasteSamples(
  supabase: SupabaseClient<Database>,
  userId: string,
  opts: { publicOnly: boolean },
): Promise<TasteSample[]> {
  let q = supabase
    .from("tastings")
    .select(
      "score, value_for_money, would_buy_again, sweetness, smokiness, fruitiness, spiciness, smoothness, complexity, finish_length, bottling_id",
    )
    .eq("user_id", userId);
  if (opts.publicOnly) q = q.eq("visibility", "public");
  const { data: rowsRaw } = await q;
  const rows = (rowsRaw ?? []) as Array<{
    score: number | null;
    value_for_money: number | null;
    would_buy_again: boolean | null;
    sweetness: number | null;
    smokiness: number | null;
    fruitiness: number | null;
    spiciness: number | null;
    smoothness: number | null;
    complexity: number | null;
    finish_length: number | null;
    bottling_id: string;
  }>;

  const uniqueBottlingIds = Array.from(new Set(rows.map((r) => r.bottling_id)));
  const bottlingMeta = new Map<
    string,
    {
      country: WhiskyCountry | null;
      region: string | null;
      cask_type: CaskType | null;
      age_years: number | null;
      abv: number | null;
    }
  >();
  if (uniqueBottlingIds.length > 0) {
    const { data: bs } = await supabase
      .from("bottling_card_stats")
      .select("id, country, region, cask_type, age_years, abv")
      .in("id", uniqueBottlingIds);
    const bsTyped = (bs ?? []) as Array<{
      id: string | null;
      country: WhiskyCountry | null;
      region: string | null;
      cask_type: CaskType | null;
      age_years: number | null;
      abv: number | null;
    }>;
    for (const b of bsTyped) {
      if (b.id) {
        bottlingMeta.set(b.id, {
          country: b.country,
          region: b.region,
          cask_type: b.cask_type,
          age_years: b.age_years,
          abv: b.abv,
        });
      }
    }
  }

  return rows.map((r) => {
    const meta = bottlingMeta.get(r.bottling_id);
    return {
      score: r.score,
      value_for_money: r.value_for_money,
      would_buy_again: r.would_buy_again,
      sweetness: r.sweetness,
      smokiness: r.smokiness,
      fruitiness: r.fruitiness,
      spiciness: r.spiciness,
      smoothness: r.smoothness,
      complexity: r.complexity,
      finish_length: r.finish_length,
      country: meta?.country ?? null,
      region: meta?.region ?? null,
      cask_type: meta?.cask_type ?? null,
      age_years: meta?.age_years ?? null,
      abv: meta?.abv ?? null,
      bottling_id: r.bottling_id,
    };
  });
}

export async function loadTasteProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  opts: { publicOnly: boolean },
): Promise<TasteProfile> {
  const samples = await loadTasteSamples(supabase, userId, opts);
  return buildTasteProfile(samples);
}

export async function loadTasteDashboard(
  supabase: SupabaseClient<Database>,
  userId: string,
  opts: { publicOnly: boolean },
): Promise<TasteDashboard> {
  const samples = await loadTasteSamples(supabase, userId, opts);
  return buildTasteDashboard(samples);
}

/** 프로필 페이지처럼 둘 다 필요한 곳용 — samples fetch 1회. */
export async function loadTasteProfileAndDashboard(
  supabase: SupabaseClient<Database>,
  userId: string,
  opts: { publicOnly: boolean },
): Promise<{ profile: TasteProfile; dashboard: TasteDashboard }> {
  const samples = await loadTasteSamples(supabase, userId, opts);
  return {
    profile: buildTasteProfile(samples),
    dashboard: buildTasteDashboard(samples),
  };
}
