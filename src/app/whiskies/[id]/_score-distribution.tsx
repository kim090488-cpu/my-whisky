const SCORE_BINS = [
  { label: "~59",   min: 0,  max: 59 },
  { label: "60-64", min: 60, max: 64 },
  { label: "65-69", min: 65, max: 69 },
  { label: "70-74", min: 70, max: 74 },
  { label: "75-79", min: 75, max: 79 },
  { label: "80-84", min: 80, max: 84 },
  { label: "85-89", min: 85, max: 89 },
  { label: "90-94", min: 90, max: 94 },
  { label: "95+",   min: 95, max: 100 },
] as const;

const VALUE_BINS = [
  { label: "1", min: 1, max: 1 },
  { label: "2", min: 2, max: 2 },
  { label: "3", min: 3, max: 3 },
  { label: "4", min: 4, max: 4 },
  { label: "5", min: 5, max: 5 },
] as const;

type Bin = { label: string; min: number; max: number };

function summarize(values: number[]) {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[(sorted.length - 1) / 2];
  return {
    count: values.length,
    mean,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

function Histogram({
  bins,
  values,
  emptyLabel,
  cols,
}: {
  bins: readonly Bin[];
  values: number[];
  emptyLabel: string;
  cols: 5 | 9;
}) {
  if (values.length === 0) {
    return (
      <div className="grid aspect-[3/1] place-items-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }
  const counts = bins.map((bin) =>
    values.reduce((n, v) => (v >= bin.min && v <= bin.max ? n + 1 : n), 0),
  );
  const maxCount = Math.max(1, ...counts);
  const total = values.length;
  const gridClass = cols === 5 ? "grid-cols-5" : "grid-cols-9";
  return (
    <div className={`grid ${gridClass} gap-1 sm:gap-2`}>
      {bins.map((bin, i) => {
        const c = counts[i];
        const pct = (c / maxCount) * 100;
        const share = (c / total) * 100;
        return (
          <div key={bin.label} className="flex flex-col items-center">
            <div
              className="flex h-24 w-full items-end"
              title={`${bin.label}: ${c}개 (${share.toFixed(1)}%)`}
            >
              <div
                className="w-full rounded-t bg-amber-400/60"
                style={{
                  height: `${pct}%`,
                  minHeight: c > 0 ? 4 : 1,
                }}
              />
            </div>
            <div className="mt-1 text-[10px] leading-tight text-muted-foreground tabular-nums">
              {bin.label}
            </div>
            <div className="text-[10px] leading-tight tabular-nums text-foreground/80">
              {c}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ScoreDistribution({
  scores,
  valueForMoney,
}: {
  scores: number[];
  valueForMoney: number[];
}) {
  if (scores.length === 0 && valueForMoney.length === 0) return null;

  const scoreSummary = summarize(scores);
  const valueSummary = summarize(valueForMoney);

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card/40 p-6 sm:p-8">
      <header className="mb-4">
        <h2 className="font-serif text-2xl tracking-tight">Rating distribution</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          이 위스키의 점수·가성비 평가 분포
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              점수 · 0~100
            </span>
            {scoreSummary && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                평균 {scoreSummary.mean.toFixed(1)} · 중앙 {scoreSummary.median.toFixed(1)} · 범위 {scoreSummary.min}~{scoreSummary.max}
              </span>
            )}
          </div>
          <Histogram
            bins={SCORE_BINS}
            values={scores}
            emptyLabel="점수 데이터 없음"
            cols={9}
          />
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              가성비 · 1~5
            </span>
            {valueSummary && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                평균 {valueSummary.mean.toFixed(2)} · {valueSummary.count}개
              </span>
            )}
          </div>
          <Histogram
            bins={VALUE_BINS}
            values={valueForMoney}
            emptyLabel="가성비 데이터 없음"
            cols={5}
          />
        </div>
      </div>
    </section>
  );
}
