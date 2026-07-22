import Link from "next/link";
import type { PersonalizedBottling } from "@/lib/social/personalized-bottlings";

function formatKrwShort(krw: number): string {
  if (krw >= 100_000) return `${Math.round(krw / 10_000)}만원`;
  if (krw >= 10_000) return `${(krw / 10_000).toFixed(1).replace(/\.0$/, "")}만원`;
  return `${krw.toLocaleString()}원`;
}

export function PersonalizedBottlingCard({ bottling }: { bottling: PersonalizedBottling }) {
  const dist = bottling.distilleryNameKr || bottling.distilleryName;
  const name = bottling.nameKr || bottling.name;
  return (
    <Link
      href={`/whiskies/${bottling.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card/40 transition-colors hover:border-foreground/30 hover:bg-card"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-foreground/5">
        {bottling.labelImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bottling.labelImageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl text-muted-foreground/40">
            🥃
          </div>
        )}
        <div className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-medium tabular-nums text-amber-300 backdrop-blur-sm">
          {bottling.avgScore.toFixed(1)}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground/70">
          {dist}
        </div>
        <div className="line-clamp-2 text-sm font-medium leading-snug">{name}</div>
        {bottling.medianPriceKrw !== null && (
          <div className="text-[11px] tabular-nums text-muted-foreground">
            ≈ {formatKrwShort(bottling.medianPriceKrw)}
          </div>
        )}
        {bottling.matchedFlavors.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {bottling.matchedFlavors.slice(0, 3).map((f) => (
              <span
                key={f.key}
                className="rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-300"
              >
                {f.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
