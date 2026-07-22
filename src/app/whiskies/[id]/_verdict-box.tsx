import { Check, Star, Wallet, Users } from "lucide-react";
import type { ReviewSummary, ReviewSummaryTone } from "@/lib/tastings/review-summary";

type RecommendedCounts = {
  beginner: number;
  intermediate: number;
  expert: number;
  gift: number;
} | null;

export type VerdictData = {
  total_reviews: number;
  buy_again_responses: number;
  buy_again_yes: number;
  avg_value_for_money: number | null;
  recommended_for_counts: RecommendedCounts;
  median_price_krw: number | null;
  price_data_count: number;
  avg_score: number | null;
};

const SUMMARY_TONE: Record<ReviewSummaryTone, string> = {
  amber:   "text-amber-300",
  emerald: "text-emerald-300",
  rose:    "text-rose-300",
  muted:   "text-muted-foreground",
};

const RECOMMENDED_LABEL: Record<keyof NonNullable<RecommendedCounts>, string> = {
  beginner: "초보자",
  intermediate: "중급",
  expert: "전문가",
  gift: "선물용",
};

const STRONG_SIGNAL_THRESHOLD = 5;

export function VerdictBox({
  data,
  summary,
}: {
  data: VerdictData;
  summary?: ReviewSummary;
}) {
  const weakSignal = data.total_reviews < STRONG_SIGNAL_THRESHOLD;

  const buyAgainPct =
    data.buy_again_responses > 0
      ? Math.round((100 * data.buy_again_yes) / data.buy_again_responses)
      : null;

  // 추천 대상 — 응답자의 25% 이상이 선택한 카테고리만 노출 (최소 1명)
  const topRecommended = (() => {
    if (!data.recommended_for_counts) return [];
    const totalVoters = Math.max(
      data.recommended_for_counts.beginner,
      data.recommended_for_counts.intermediate,
      data.recommended_for_counts.expert,
      data.recommended_for_counts.gift,
    );
    if (totalVoters === 0) return [];
    const threshold = Math.max(1, totalVoters * 0.25);
    return (Object.entries(data.recommended_for_counts) as [
      keyof NonNullable<RecommendedCounts>, number,
    ][])
      .filter(([, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => RECOMMENDED_LABEL[k]);
  })();

  return (
    <section className="mt-10 rounded-2xl border border-amber-700/30 bg-gradient-to-br from-amber-900/10 via-card/40 to-card/40 p-6 sm:p-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-serif text-2xl tracking-tight">살까? 말까?</h2>
          {weakSignal && (
            <span className="rounded-full border border-amber-700/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300/90">
              초기 신호
            </span>
          )}
        </div>
        {summary && summary.total > 0 ? (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            후기{" "}
            <span className="tabular-nums text-foreground/90">{summary.total}</span>개
            {summary.scoreLine && (
              <>
                {" · "}평균{" "}
                <span className="tabular-nums font-medium text-foreground">
                  {summary.scoreLine.avg}
                </span>
                <span className={`ml-1 ${SUMMARY_TONE[summary.scoreLine.tone]}`}>
                  ({summary.scoreLine.label})
                </span>
              </>
            )}
            {summary.buybackLine && (
              <>
                {" · "}
                <span className={SUMMARY_TONE[summary.buybackLine.tone]}>
                  {summary.buybackLine.pct}%
                </span>
                {summary.buybackLine.label}
              </>
            )}
            {summary.flavorLabels.length > 0 && (
              <>
                {" · "}
                <span className="text-amber-300">
                  {summary.flavorLabels.join(" · ")}
                </span>
                가 두드러짐
              </>
            )}
            {summary.valueLine && (
              <>
                {" · "}가성비{" "}
                <span className="tabular-nums text-foreground/90">
                  {summary.valueLine.avg}
                </span>
                /{summary.valueLine.max}
              </>
            )}
            {weakSignal && (
              <span className="text-muted-foreground/70">
                {" · "}후기가 더 모이면 정확해져요
              </span>
            )}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            후기 {data.total_reviews}개 기반 판정
            {weakSignal && " · 후기가 더 모이면 정확해져요"}
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {/* 다시 살래요 % */}
        <Tile>
          <TileLabel icon={<Check className="size-3.5" />}>다시 살래요</TileLabel>
          {buyAgainPct !== null ? (
            <>
              <TileBigValue>{buyAgainPct}%</TileBigValue>
              <TileFootnote>
                {data.buy_again_yes} / {data.buy_again_responses}명
              </TileFootnote>
            </>
          ) : (
            <TileMute>응답 부족</TileMute>
          )}
        </Tile>

        {/* 가성비 */}
        <Tile>
          <TileLabel icon={<Wallet className="size-3.5" />}>가성비</TileLabel>
          {data.avg_value_for_money !== null ? (
            <>
              <TileBigValue>
                {data.avg_value_for_money.toFixed(1)}
                <span className="text-base font-normal text-muted-foreground"> / 5</span>
              </TileBigValue>
              <TileFootnote>
                <Stars value={data.avg_value_for_money} />
              </TileFootnote>
            </>
          ) : (
            <TileMute>응답 부족</TileMute>
          )}
        </Tile>

        {/* 시세 */}
        <Tile>
          <TileLabel icon={<Star className="size-3.5" />}>시세 (KRW)</TileLabel>
          {data.median_price_krw !== null ? (
            <>
              <TileBigValue>
                ₩{data.median_price_krw.toLocaleString()}
              </TileBigValue>
              <TileFootnote>
                {data.price_data_count}개 보고 · median
              </TileFootnote>
            </>
          ) : (
            <TileMute>가격 정보 없음</TileMute>
          )}
        </Tile>
      </div>

      {/* 추천 대상 */}
      <div className="mt-6 border-t border-border/60 pt-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Users className="size-3.5" /> 이런 분께 추천
        </div>
        {topRecommended.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {topRecommended.map((label) => (
              <span
                key={label}
                className="rounded-full border border-amber-700/40 bg-amber-400/10 px-3 py-1 text-sm text-amber-200"
              >
                {label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">아직 명확한 추천 대상이 모이지 않았어요.</p>
        )}
      </div>
    </section>
  );
}

// ── 작은 부속 ────────────────────────────────────────────────────────

function Tile({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-4">
      {children}
    </div>
  );
}

function TileLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {icon}
      {children}
    </div>
  );
}

function TileBigValue({ children }: { children: React.ReactNode }) {
  return <div className="font-serif text-3xl tracking-tight text-foreground">{children}</div>;
}

function TileFootnote({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-xs text-muted-foreground">{children}</div>;
}

function TileMute({ children }: { children: React.ReactNode }) {
  return <div className="text-base text-muted-foreground">{children}</div>;
}

function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex gap-0.5 text-amber-400">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={n <= full ? "size-3 fill-current" : "size-3 text-muted-foreground/40"}
        />
      ))}
    </span>
  );
}

// for usage where verdict data is missing entirely (no reviews)
export function VerdictEmpty() {
  return (
    <section className="mt-10 rounded-2xl border border-border bg-card/40 p-8 text-center">
      <h2 className="font-serif text-xl tracking-tight">아직 후기가 없어요</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        첫 후기를 남기면 다른 사람들의 구매 결정에 도움이 됩니다.
      </p>
    </section>
  );
}

