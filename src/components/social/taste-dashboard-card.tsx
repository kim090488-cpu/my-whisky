import type { DistItem, ScoreBucket, TasteDashboard } from "@/lib/tastings/taste-profile";

const MIN_TOTAL = 5;

export function TasteDashboardCard({
  dashboard,
  isSelf,
}: {
  dashboard: TasteDashboard;
  isSelf: boolean;
}) {
  if (dashboard.total < MIN_TOTAL) return null;

  const hasFlavor = dashboard.flavors.some((f) => f.count > 0);
  const hasAny =
    hasFlavor ||
    dashboard.topCountries.length > 0 ||
    dashboard.topCasks.length > 0 ||
    dashboard.topRegions.length > 0 ||
    dashboard.ageBands.length > 0 ||
    dashboard.scoreBuckets.some((b) => b.count > 0) ||
    dashboard.abvBuckets.length > 0;
  if (!hasAny) return null;

  return (
    <section className="mt-6">
      <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        취향 상세
      </h2>
      <div className="grid gap-3 rounded-xl border border-border bg-card/40 p-4 sm:grid-cols-2 sm:gap-5 sm:p-5">
        {hasFlavor && <FlavorBars flavors={dashboard.flavors} />}
        <div className="flex flex-col gap-4">
          {dashboard.topCountries.length > 0 && (
            <DistributionRow title="즐겨 마신 국가" items={dashboard.topCountries} />
          )}
          {dashboard.topCasks.length > 0 && (
            <DistributionRow title="캐스크" items={dashboard.topCasks} />
          )}
          {dashboard.topRegions.length > 0 && (
            <DistributionRow title="서브지역" items={dashboard.topRegions} />
          )}
          {dashboard.ageBands.length > 0 && (
            <DistributionRow title="숙성대" items={dashboard.ageBands} />
          )}
        </div>
        {dashboard.scoreBuckets.some((b) => b.count > 0) && (
          <ScoreDistribution buckets={dashboard.scoreBuckets} />
        )}
        {dashboard.abvBuckets.length > 0 && (
          <DistributionBars title="ABV 분포" items={dashboard.abvBuckets} />
        )}
      </div>
      {isSelf && dashboard.total < 10 && (
        <p className="mt-2 text-[11px] text-muted-foreground/70">
          노트가 쌓일수록 세밀해져요 (지금 {dashboard.total}개).
        </p>
      )}
    </section>
  );
}

function FlavorBars({
  flavors,
}: {
  flavors: TasteDashboard["flavors"];
}) {
  const visible = flavors.filter((f) => f.count > 0);
  if (visible.length === 0) return null;
  return (
    <div>
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
        향미 프로파일
      </h3>
      <ul className="flex flex-col gap-2">
        {visible.map((f) => {
          const pct = Math.max(0, Math.min(100, (f.avg / 10) * 100));
          return (
            <li key={f.key} className="flex items-center gap-3 text-xs">
              <span className="w-14 shrink-0 text-muted-foreground">{f.label}</span>
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/5">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-amber-400/70"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right tabular-nums text-foreground/85">
                {f.avg.toFixed(1)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DistributionRow({ title, items }: { title: string; items: DistItem[] }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
        {title}
      </h3>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li
            key={item.key}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-2.5 py-0.5 text-[11px]"
            title={`${item.count}개 노트`}
          >
            <span className="text-foreground/85">{item.label}</span>
            <span className="text-muted-foreground/80 tabular-nums">{item.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DistributionBars({ title, items }: { title: string; items: DistItem[] }) {
  const max = items.reduce((m, b) => Math.max(m, b.count), 0);
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
        {title}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <BucketBar
            key={item.key}
            label={item.label}
            count={item.count}
            pct={max > 0 ? (item.count / max) * 100 : 0}
            highlight={item.count === max}
          />
        ))}
      </ul>
    </div>
  );
}

function ScoreDistribution({ buckets }: { buckets: ScoreBucket[] }) {
  const max = buckets.reduce((m, b) => Math.max(m, b.count), 0);
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
        점수 분포
      </h3>
      <ul className="flex flex-col gap-1.5">
        {buckets.map((b) => (
          <BucketBar
            key={b.label}
            label={b.label}
            count={b.count}
            pct={max > 0 ? (b.count / max) * 100 : 0}
            highlight={b.count === max && b.count > 0}
          />
        ))}
      </ul>
    </div>
  );
}

function BucketBar({
  label,
  count,
  pct,
  highlight,
}: {
  label: string;
  count: number;
  pct: number;
  highlight: boolean;
}) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className="w-14 shrink-0 text-muted-foreground">{label}</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/5">
        <div
          className={
            "absolute inset-y-0 left-0 rounded-full " +
            (highlight ? "bg-amber-400/70" : "bg-foreground/25")
          }
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right tabular-nums text-foreground/80">{count}</span>
    </li>
  );
}
