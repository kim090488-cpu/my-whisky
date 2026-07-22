// 증류소 옥션 시세 카드 — whiskyhunter.net 출처
//   - 데이터: 한 증류소가 옥션에서 거래된 *모든 보틀링의 월별 평균/최소/최대*.
//   - 개별 보틀링(예: 맥캘란 18)의 시세가 아님 — UI에서 명확히 라벨.
//   - 통화 단위는 whiskyhunter API에 명시 없음 → 숫자만 표시 + 출처 링크.

type Stat = {
  dt: string;
  winning_bid_mean: number | null;
  winning_bid_min: number | null;
  winning_bid_max: number | null;
  lots_count: number | null;
};

function formatMonth(dt: string): string {
  // "2024-06-01" → "2024.06"
  return dt.slice(0, 7).replace("-", ".");
}

function formatNum(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 10000) return Math.round(n).toLocaleString();
  return n.toFixed(2);
}

export function AuctionStatsCard({
  stats,
  whiskyhunterSlug,
}: {
  stats: Stat[];
  whiskyhunterSlug: string | null;
}) {
  // stats는 dt desc로 들어옴. 차트는 좌→우 시간 순이라 reverse.
  const chronological = [...stats].reverse();
  const latest = stats[0];
  const means = chronological.map((s) => s.winning_bid_mean ?? 0);
  const maxMean = Math.max(1, ...means);

  return (
    <section className="mt-10 border-t border-neutral-900 pt-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">옥션 시세</h2>
        <span className="text-xs text-neutral-500">최근 12개월</span>
      </div>

      <p className="mb-4 text-xs text-neutral-500">
        증류소 전체의 옥션 낙찰가 월별 집계예요. 개별 보틀링 가격이 아니에요.
        {" "}
        <span className="text-neutral-600">출처: </span>
        <a
          href={
            whiskyhunterSlug
              ? `https://whiskyhunter.net/distilleries/${whiskyhunterSlug}/`
              : "https://whiskyhunter.net/"
          }
          target="_blank"
          rel="noopener"
          className="text-amber-300/80 hover:underline"
        >
          whiskyhunter.net
        </a>
      </p>

      <div className="rounded-lg border border-neutral-900 bg-neutral-950 p-4">
        {/* 최신 월 요약 */}
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-xs text-neutral-500">{formatMonth(latest.dt)}</div>
          {latest.lots_count !== null && (
            <div className="text-xs text-neutral-500">{latest.lots_count.toLocaleString()} lots</div>
          )}
        </div>
        <dl className="mt-2 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-neutral-500">평균</dt>
            <dd className="mt-0.5 font-medium text-amber-200">{formatNum(latest.winning_bid_mean)}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">최저</dt>
            <dd className="mt-0.5">{formatNum(latest.winning_bid_min)}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">최고</dt>
            <dd className="mt-0.5">{formatNum(latest.winning_bid_max)}</dd>
          </div>
        </dl>

        {/* 12개월 평균가 막대 — 단순 SVG. y축 0~maxMean 자동 스케일. */}
        {chronological.length >= 2 && (
          <div className="mt-5">
            <svg
              viewBox={`0 0 ${chronological.length * 16} 50`}
              className="h-16 w-full"
              preserveAspectRatio="none"
              role="img"
              aria-label="최근 12개월 옥션 평균가 추이"
            >
              {chronological.map((s, i) => {
                const v = s.winning_bid_mean ?? 0;
                const h = Math.max(2, (v / maxMean) * 46);
                return (
                  <rect
                    key={s.dt}
                    x={i * 16 + 3}
                    y={50 - h}
                    width={10}
                    height={h}
                    rx={1}
                    className="fill-amber-300/40"
                  />
                );
              })}
            </svg>
            <div className="mt-1 flex justify-between text-[10px] text-neutral-600">
              <span>{formatMonth(chronological[0].dt)}</span>
              <span>{formatMonth(chronological[chronological.length - 1].dt)}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
