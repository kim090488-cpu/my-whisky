import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { TasteProfile } from "@/lib/tastings/taste-profile";

const CANDIDATE_LIMIT = 80;
const AVG_SCORE_THRESHOLD = 82;
const MIN_REVIEWS = 3;
const FLAVOR_MATCH_THRESHOLD = 7;
const MAX_RESULTS = 6;

export const BUDGET_RANGES = ["all", "under5", "5to10", "10to20", "over20"] as const;
export type BudgetRange = (typeof BUDGET_RANGES)[number];
export const BUDGET_LABEL: Record<BudgetRange, string> = {
  all:     "전체",
  under5:  "5만 이하",
  "5to10": "5-10만",
  "10to20":"10-20만",
  over20:  "20만+",
};

// 원 단위. inclusive 하한, exclusive 상한.
const BUDGET_BOUNDS: Record<Exclude<BudgetRange, "all">, { min: number; max: number | null }> = {
  under5:  { min: 0,       max: 50_000 },
  "5to10": { min: 50_000,  max: 100_000 },
  "10to20":{ min: 100_000, max: 200_000 },
  over20:  { min: 200_000, max: null },
};

type FlavorField =
  | "sweetness"
  | "smokiness"
  | "fruitiness"
  | "spiciness"
  | "smoothness"
  | "complexity"
  | "finish_length";

const FLAVOR_LABEL: Record<FlavorField, string> = {
  sweetness:     "달콤",
  smokiness:     "스모키",
  fruitiness:    "과일향",
  spiciness:     "스파이시",
  smoothness:    "부드러움",
  complexity:    "복잡함",
  finish_length: "긴 여운",
};

export type PersonalizedBottling = {
  id: string;
  name: string;
  nameKr: string | null;
  distilleryName: string;
  distilleryNameKr: string | null;
  labelImageUrl: string | null;
  avgScore: number;
  matchScore: number;
  matchedFlavors: { key: FlavorField; label: string }[];
  medianPriceKrw: number | null;
};

export type PersonalizedBottlingsResult = {
  hasProfile: boolean;
  items: PersonalizedBottling[];
};

export async function loadPersonalizedBottlings(
  supabase: SupabaseClient<Database>,
  userId: string,
  tasteProfile: TasteProfile,
  opts: { budget?: BudgetRange } = {},
): Promise<PersonalizedBottlingsResult> {
  const flavorPrefs = tasteProfile.tags
    .map((t) => t.key)
    .filter((k) => k.startsWith("flavor:"))
    .map((k) => k.slice("flavor:".length))
    .filter((k): k is FlavorField => k in FLAVOR_LABEL);
  if (flavorPrefs.length === 0) return { hasProfile: false, items: [] };

  const myTastingsRes = await supabase
    .from("tastings")
    .select("bottling_id")
    .eq("user_id", userId);
  const tastedIds = new Set<string>();
  for (const r of (myTastingsRes.data ?? []) as { bottling_id: string | null }[]) {
    if (r.bottling_id) tastedIds.add(r.bottling_id);
  }

  // 예산 필터는 DB 아닌 JS에서 적용 — median_price_krw가 null인 보틀링에도
  // 원시 tastings.purchase_price(다국적 통화 포함)로 폴백 계산하려면 후처리 필요
  const candidatesRes = await supabase
    .from("bottling_verdict_stats")
    .select(
      "bottling_id, avg_score, total_reviews, avg_sweetness, avg_smokiness, avg_fruitiness, avg_spiciness, avg_smoothness, avg_complexity, avg_finish_length, median_price_krw",
    )
    .gte("avg_score", AVG_SCORE_THRESHOLD)
    .gte("total_reviews", MIN_REVIEWS)
    .order("avg_score", { ascending: false, nullsFirst: false })
    .limit(CANDIDATE_LIMIT);

  type CandidateRow = {
    bottling_id: string;
    avg_score: number | null;
    total_reviews: number;
    avg_sweetness: number | null;
    avg_smokiness: number | null;
    avg_fruitiness: number | null;
    avg_spiciness: number | null;
    avg_smoothness: number | null;
    avg_complexity: number | null;
    avg_finish_length: number | null;
    median_price_krw: number | null;
  };
  const candidates = (candidatesRes.data ?? []) as unknown as CandidateRow[];

  type Scored = {
    bottlingId: string;
    avgScore: number;
    matchScore: number;
    matchedFlavors: { key: FlavorField; label: string }[];
    medianPriceKrw: number | null;
  };
  const scored: Scored[] = [];
  for (const c of candidates) {
    if (!c.bottling_id || tastedIds.has(c.bottling_id)) continue;
    if (c.avg_score === null) continue;
    const matched: { key: FlavorField; label: string }[] = [];
    for (const f of flavorPrefs) {
      const v = c[`avg_${f}` as const];
      if (v !== null && v >= FLAVOR_MATCH_THRESHOLD) {
        matched.push({ key: f, label: FLAVOR_LABEL[f] });
      }
    }
    if (matched.length === 0) continue;
    scored.push({
      bottlingId: c.bottling_id,
      avgScore: c.avg_score,
      matchScore: matched.length,
      matchedFlavors: matched,
      medianPriceKrw: c.median_price_krw,
    });
  }

  if (scored.length === 0) return { hasProfile: true, items: [] };

  // median 폴백: DB view는 KRW/NULL currency만 집계 → USD/EUR 등이 있는 보틀링은 median_price_krw=null
  // 스코어드 후보 중 null인 것들에 대해 원시 price + currency_rates로 다시 계산
  const nullMedianIds = scored
    .filter((s) => s.medianPriceKrw === null)
    .map((s) => s.bottlingId);
  if (nullMedianIds.length > 0) {
    const [pricesRes, ratesRes] = await Promise.all([
      supabase
        .from("tastings")
        .select("bottling_id, purchase_price, purchase_currency")
        .in("bottling_id", nullMedianIds)
        .eq("visibility", "public")
        .not("purchase_price", "is", null),
      supabase.from("currency_rates").select("code, krw_per_unit"),
    ]);
    const rates = new Map<string, number>();
    for (const r of ((ratesRes.data ?? []) as Array<{
      code: string;
      krw_per_unit: number | string;
    }>)) {
      const v = Number(r.krw_per_unit);
      if (Number.isFinite(v) && v > 0) rates.set(r.code, v);
    }
    const priceRows = (pricesRes.data ?? []) as Array<{
      bottling_id: string;
      purchase_price: number | string;
      purchase_currency: string | null;
    }>;
    const krwByBottling = new Map<string, number[]>();
    for (const r of priceRows) {
      const price = Number(r.purchase_price);
      if (!Number.isFinite(price) || price <= 0) continue;
      const cur = r.purchase_currency ?? "KRW";
      let krw: number | null = null;
      if (cur === "KRW") krw = price;
      else {
        const rate = rates.get(cur);
        if (rate) krw = price * rate;
      }
      if (krw === null) continue;
      let arr = krwByBottling.get(r.bottling_id);
      if (!arr) {
        arr = [];
        krwByBottling.set(r.bottling_id, arr);
      }
      arr.push(krw);
    }
    for (const s of scored) {
      if (s.medianPriceKrw !== null) continue;
      const arr = krwByBottling.get(s.bottlingId);
      if (!arr || arr.length === 0) continue;
      arr.sort((a, b) => a - b);
      const mid = Math.floor(arr.length / 2);
      const median =
        arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
      s.medianPriceKrw = Math.round(median);
    }
  }

  // JS 예산 필터
  const filtered =
    opts.budget && opts.budget !== "all"
      ? scored.filter((s) => {
          if (s.medianPriceKrw === null) return false;
          const bounds = BUDGET_BOUNDS[opts.budget as Exclude<BudgetRange, "all">];
          if (s.medianPriceKrw < bounds.min) return false;
          if (bounds.max !== null && s.medianPriceKrw >= bounds.max) return false;
          return true;
        })
      : scored;

  filtered.sort(
    (a, b) => b.matchScore - a.matchScore || b.avgScore - a.avgScore,
  );
  const top = filtered.slice(0, MAX_RESULTS);
  if (top.length === 0) return { hasProfile: true, items: [] };

  const cardsRes = await supabase
    .from("bottling_card_stats")
    .select("id, name, name_kr, distillery_name, distillery_name_kr, label_image_url")
    .in(
      "id",
      top.map((s) => s.bottlingId),
    );
  const cardById = new Map<
    string,
    {
      name: string;
      name_kr: string | null;
      distillery_name: string;
      distillery_name_kr: string | null;
      label_image_url: string | null;
    }
  >();
  for (const c of (cardsRes.data ?? []) as Array<{
    id: string | null;
    name: string;
    name_kr: string | null;
    distillery_name: string;
    distillery_name_kr: string | null;
    label_image_url: string | null;
  }>) {
    if (c.id) cardById.set(c.id, c);
  }

  const items: PersonalizedBottling[] = [];
  for (const s of top) {
    const c = cardById.get(s.bottlingId);
    if (!c) continue;
    items.push({
      id: s.bottlingId,
      name: c.name,
      nameKr: c.name_kr,
      distilleryName: c.distillery_name,
      distilleryNameKr: c.distillery_name_kr,
      labelImageUrl: c.label_image_url,
      avgScore: s.avgScore,
      matchScore: s.matchScore,
      matchedFlavors: s.matchedFlavors,
      medianPriceKrw: s.medianPriceKrw,
    });
  }
  return { hasProfile: true, items };
}
