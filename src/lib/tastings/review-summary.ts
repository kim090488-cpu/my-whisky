export type ReviewSummaryInput = {
  total_reviews: number;
  avg_score: number | null;
  buy_again_yes: number;
  buy_again_responses: number;
  avg_value_for_money: number | null;
  avg_sweetness: number | null;
  avg_smokiness: number | null;
  avg_fruitiness: number | null;
  avg_spiciness: number | null;
  avg_smoothness: number | null;
  avg_complexity: number | null;
  avg_finish_length: number | null;
};

export type ReviewSummaryTone = "amber" | "emerald" | "rose" | "muted";

export type ReviewSummary = {
  total: number;
  scoreLine: { avg: number; label: string; tone: ReviewSummaryTone } | null;
  buybackLine: { pct: number; label: string; tone: ReviewSummaryTone } | null;
  flavorLabels: string[];
  valueLine: { avg: number; max: 5 } | null;
};

const MIN_TOTAL = 3;
const FLAVOR_THRESH = 7;
const MAX_FLAVOR = 3;
const BUYBACK_MIN = 3;

type FlavorKey =
  | "avg_smokiness"
  | "avg_sweetness"
  | "avg_fruitiness"
  | "avg_spiciness"
  | "avg_smoothness"
  | "avg_complexity"
  | "avg_finish_length";

const FLAVOR_MAP: readonly { key: FlavorKey; label: string }[] = [
  { key: "avg_smokiness",     label: "스모키" },
  { key: "avg_sweetness",     label: "달콤" },
  { key: "avg_fruitiness",    label: "과일" },
  { key: "avg_spiciness",     label: "스파이시" },
  { key: "avg_smoothness",    label: "부드러움" },
  { key: "avg_complexity",    label: "복잡함" },
  { key: "avg_finish_length", label: "긴 여운" },
];

function scoreVerdict(avg: number): { label: string; tone: ReviewSummaryTone } {
  if (avg >= 92) return { label: "탁월", tone: "amber" };
  if (avg >= 88) return { label: "훌륭", tone: "amber" };
  if (avg >= 85) return { label: "준수", tone: "emerald" };
  if (avg >= 80) return { label: "무난", tone: "emerald" };
  if (avg >= 75) return { label: "아쉬움", tone: "rose" };
  return { label: "낮음", tone: "rose" };
}

function buybackVerdict(pct: number): { label: string; tone: ReviewSummaryTone } {
  if (pct >= 70) return { label: "가 다시 살래요", tone: "emerald" };
  if (pct >= 40) return { label: "가 다시 살래요", tone: "muted" };
  return { label: "만 다시 살래요", tone: "rose" };
}

export function buildReviewSummary(input: ReviewSummaryInput): ReviewSummary {
  const { total_reviews: total } = input;
  if (total < MIN_TOTAL) {
    return {
      total,
      scoreLine: null,
      buybackLine: null,
      flavorLabels: [],
      valueLine: null,
    };
  }

  const scoreLine =
    input.avg_score !== null
      ? {
          avg: Math.round(input.avg_score * 10) / 10,
          ...scoreVerdict(input.avg_score),
        }
      : null;

  let buybackLine: ReviewSummary["buybackLine"] = null;
  if (input.buy_again_responses >= BUYBACK_MIN) {
    const pct = Math.round(
      (100 * input.buy_again_yes) / input.buy_again_responses,
    );
    buybackLine = { pct, ...buybackVerdict(pct) };
  }

  const scored: { label: string; v: number }[] = [];
  for (const f of FLAVOR_MAP) {
    const v = input[f.key];
    if (typeof v === "number" && v >= FLAVOR_THRESH) {
      scored.push({ label: f.label, v });
    }
  }
  scored.sort((a, b) => b.v - a.v);
  const flavorLabels = scored.slice(0, MAX_FLAVOR).map((s) => s.label);

  const valueLine =
    input.avg_value_for_money !== null
      ? {
          avg: Math.round(input.avg_value_for_money * 10) / 10,
          max: 5 as const,
        }
      : null;

  return { total, scoreLine, buybackLine, flavorLabels, valueLine };
}
