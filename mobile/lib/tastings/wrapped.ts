import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaskType, Database, WhiskyCountry } from "@/types/database";

export type WrappedTopNote = {
  tastingId: string;
  bottlingId: string;
  bottlingName: string;
  bottlingNameKr: string | null;
  distilleryName: string;
  distilleryNameKr: string | null;
  score: number;
};

export type WrappedDistCount = {
  key: string;
  label: string;
  count: number;
};

export type WrappedFlavor = {
  key: string;
  label: string;
  avg: number;
};

export type WrappedMonth = {
  month: string;
  monthLabel: string;
  hasData: boolean;
  count: number;
  scoredCount: number;
  avgScore: number | null;
  maxScore: number | null;
  buybackYes: number;
  buybackAnswered: number;
  buybackPct: number | null;
  newBottlingCount: number;
  topPick: WrappedTopNote | null;
  mostLiked: (WrappedTopNote & { likeCount: number }) | null;
  totalLikes: number;
  totalComments: number;
  topCasks: WrappedDistCount[];
  topCountries: WrappedDistCount[];
  flavorTop: WrappedFlavor[];
};

const CASK_LABEL_KO: Partial<Record<CaskType, string>> = {
  bourbon:    "버번",
  sherry:     "셰리",
  port:       "포트",
  wine:       "와인",
  rum:        "럼",
  virgin_oak: "버진오크",
  refill:     "리필",
  mixed:      "믹스드",
};

const COUNTRY_LABEL_KO: Partial<Record<WhiskyCountry, string>> = {
  scotland:    "스코틀랜드",
  ireland:     "아일랜드",
  usa:         "미국",
  canada:      "캐나다",
  japan:       "일본",
  india:       "인도",
  taiwan:      "대만",
  australia:   "호주",
  france:      "프랑스",
  sweden:      "스웨덴",
  germany:     "독일",
  south_korea: "한국",
};

const FLAVOR_LABELS: Record<string, string> = {
  smokiness:     "스모키",
  sweetness:     "달콤",
  fruitiness:    "과일",
  spiciness:     "스파이시",
  smoothness:    "부드러움",
  complexity:    "복잡함",
  finish_length: "긴 여운",
};

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function parseMonth(input: string): { month: string; startIso: string; nextIso: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(input);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const start = `${y}-${String(mo).padStart(2, "0")}-01`;
  const nextY = mo === 12 ? y + 1 : y;
  const nextMo = mo === 12 ? 1 : mo + 1;
  const next = `${nextY}-${String(nextMo).padStart(2, "0")}-01`;
  return { month: `${y}-${String(mo).padStart(2, "0")}`, startIso: start, nextIso: next };
}

export function currentKstMonth(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function adjacentMonths(month: string): { prev: string; next: string } {
  const parsed = parseMonth(month);
  if (!parsed) return { prev: month, next: month };
  const [y, m] = month.split("-").map(Number);
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return {
    prev: `${prevY}-${String(prevM).padStart(2, "0")}`,
    next: `${nextY}-${String(nextM).padStart(2, "0")}`,
  };
}

export async function loadWrappedMonth(
  supabase: SupabaseClient<Database>,
  userId: string,
  month: string,
): Promise<WrappedMonth> {
  const parsed = parseMonth(month);
  const monthLabel = parsed ? `${Number(parsed.month.split("-")[1])}월` : month;
  const empty: WrappedMonth = {
    month,
    monthLabel,
    hasData: false,
    count: 0,
    scoredCount: 0,
    avgScore: null,
    maxScore: null,
    buybackYes: 0,
    buybackAnswered: 0,
    buybackPct: null,
    newBottlingCount: 0,
    topPick: null,
    mostLiked: null,
    totalLikes: 0,
    totalComments: 0,
    topCasks: [],
    topCountries: [],
    flavorTop: [],
  };
  if (!parsed) return empty;

  const { data: rowsRaw } = await supabase
    .from("tastings")
    .select(
      "id, bottling_id, score, would_buy_again, like_count, comment_count, sweetness, smokiness, fruitiness, spiciness, smoothness, complexity, finish_length, tasted_at",
    )
    .eq("user_id", userId)
    .gte("tasted_at", parsed.startIso)
    .lt("tasted_at", parsed.nextIso);
  const rows = (rowsRaw ?? []) as Array<{
    id: string;
    bottling_id: string;
    score: number | null;
    would_buy_again: boolean | null;
    like_count: number | null;
    comment_count: number | null;
    sweetness: number | null;
    smokiness: number | null;
    fruitiness: number | null;
    spiciness: number | null;
    smoothness: number | null;
    complexity: number | null;
    finish_length: number | null;
    tasted_at: string;
  }>;

  if (rows.length === 0) return empty;

  const scoredRows = rows.filter(
    (r): r is typeof r & { score: number } => typeof r.score === "number",
  );
  const scores = scoredRows.map((r) => r.score);
  const avgScoreRaw = mean(scores);
  const avgScore = avgScoreRaw === null ? null : Math.round(avgScoreRaw * 10) / 10;
  const maxScore = scores.length > 0 ? Math.max(...scores) : null;

  const buybackVals = rows.filter(
    (r): r is typeof r & { would_buy_again: boolean } => typeof r.would_buy_again === "boolean",
  );
  const buybackYes = buybackVals.filter((r) => r.would_buy_again).length;
  const buybackPct =
    buybackVals.length > 0 ? Math.round((buybackYes / buybackVals.length) * 100) : null;

  const totalLikes = rows.reduce((s, r) => s + (r.like_count ?? 0), 0);
  const totalComments = rows.reduce((s, r) => s + (r.comment_count ?? 0), 0);

  const flavorKeys = [
    "smokiness", "sweetness", "fruitiness", "spiciness",
    "smoothness", "complexity", "finish_length",
  ] as const;
  const flavorStats = flavorKeys
    .map((k) => {
      const vals = rows.map((r) => r[k]).filter((v): v is number => typeof v === "number");
      return { key: k, avg: mean(vals), count: vals.length };
    })
    .filter(
      (r): r is { key: (typeof flavorKeys)[number]; avg: number; count: number } =>
        r.avg !== null && r.count >= 3 && r.avg >= 6,
    )
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3);
  const flavorTop: WrappedFlavor[] = flavorStats.map((f) => ({
    key: f.key,
    label: FLAVOR_LABELS[f.key] ?? f.key,
    avg: Math.round(f.avg * 10) / 10,
  }));

  const monthBottlingIds = Array.from(new Set(rows.map((r) => r.bottling_id)));

  const bottlingMeta = new Map<
    string,
    {
      name: string;
      name_kr: string | null;
      distillery_name: string;
      distillery_name_kr: string | null;
      country: WhiskyCountry;
      cask_type: CaskType | null;
    }
  >();
  const { data: bs } = await supabase
    .from("bottling_card_stats")
    .select("id, name, name_kr, distillery_name, distillery_name_kr, country, cask_type")
    .in("id", monthBottlingIds);
  for (const b of (bs ?? []) as Array<{
    id: string | null;
    name: string;
    name_kr: string | null;
    distillery_name: string;
    distillery_name_kr: string | null;
    country: WhiskyCountry;
    cask_type: CaskType | null;
  }>) {
    if (b.id) {
      bottlingMeta.set(b.id, {
        name: b.name,
        name_kr: b.name_kr,
        distillery_name: b.distillery_name,
        distillery_name_kr: b.distillery_name_kr,
        country: b.country,
        cask_type: b.cask_type,
      });
    }
  }

  const topScored = scoredRows
    .slice()
    .sort((a, b) => b.score - a.score)[0];
  let topPick: WrappedTopNote | null = null;
  if (topScored) {
    const meta = bottlingMeta.get(topScored.bottling_id);
    if (meta) {
      topPick = {
        tastingId: topScored.id,
        bottlingId: topScored.bottling_id,
        bottlingName: meta.name,
        bottlingNameKr: meta.name_kr,
        distilleryName: meta.distillery_name,
        distilleryNameKr: meta.distillery_name_kr,
        score: topScored.score,
      };
    }
  }

  let mostLiked: (WrappedTopNote & { likeCount: number }) | null = null;
  const likedTop = rows
    .filter((r) => (r.like_count ?? 0) > 0)
    .slice()
    .sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0))[0];
  if (likedTop) {
    const meta = bottlingMeta.get(likedTop.bottling_id);
    if (meta) {
      mostLiked = {
        tastingId: likedTop.id,
        bottlingId: likedTop.bottling_id,
        bottlingName: meta.name,
        bottlingNameKr: meta.name_kr,
        distilleryName: meta.distillery_name,
        distilleryNameKr: meta.distillery_name_kr,
        score: likedTop.score ?? 0,
        likeCount: likedTop.like_count ?? 0,
      };
    }
  }

  const caskCount = new Map<CaskType, number>();
  const countryCount = new Map<WhiskyCountry, number>();
  for (const r of rows) {
    const meta = bottlingMeta.get(r.bottling_id);
    if (!meta) continue;
    if (meta.cask_type && meta.cask_type !== "unknown" && meta.cask_type !== "other") {
      caskCount.set(meta.cask_type, (caskCount.get(meta.cask_type) ?? 0) + 1);
    }
    if (meta.country) {
      countryCount.set(meta.country, (countryCount.get(meta.country) ?? 0) + 1);
    }
  }
  const topCasks: WrappedDistCount[] = Array.from(caskCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, n]) => ({ key: `cask:${k}`, label: CASK_LABEL_KO[k] ?? k, count: n }));
  const topCountries: WrappedDistCount[] = Array.from(countryCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, n]) => ({ key: `country:${k}`, label: COUNTRY_LABEL_KO[k] ?? k, count: n }));

  let newBottlingCount = 0;
  if (monthBottlingIds.length > 0) {
    const { data: priorRes } = await supabase
      .from("tastings")
      .select("bottling_id")
      .eq("user_id", userId)
      .lt("tasted_at", parsed.startIso)
      .in("bottling_id", monthBottlingIds);
    const priorIds = new Set(
      ((priorRes ?? []) as { bottling_id: string }[]).map((r) => r.bottling_id),
    );
    newBottlingCount = monthBottlingIds.filter((id) => !priorIds.has(id)).length;
  }

  return {
    month,
    monthLabel,
    hasData: true,
    count: rows.length,
    scoredCount: scoredRows.length,
    avgScore,
    maxScore,
    buybackYes,
    buybackAnswered: buybackVals.length,
    buybackPct,
    newBottlingCount,
    topPick,
    mostLiked,
    totalLikes,
    totalComments,
    topCasks,
    topCountries,
    flavorTop,
  };
}
