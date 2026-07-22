import Link from "next/link";
import { Avatar } from "@/components/avatar";
import type { SimilarTaster } from "@/lib/social/similar-tasters";

export function SimilarTastersSection({ tasters }: { tasters: SimilarTaster[] }) {
  if (tasters.length === 0) return null;
  return (
    <section className="rounded-2xl border border-border bg-card/40 p-4 sm:p-5">
      <div className="mb-3">
        <h3 className="font-serif text-lg tracking-tight">이 사람들이 당신과 취향이 겹쳐요</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          이 위스키를 사랑하고, 다른 위스키도 당신과 같이 좋아한 사람들
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {tasters.map((t) => {
          const name = t.displayName || t.username;
          return (
            <li key={t.userId}>
              <Link
                href={`/tastings/${t.tastingId}`}
                className="group flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3 transition-colors hover:border-foreground/30 hover:bg-card"
              >
                <Avatar name={name} avatarUrl={t.avatarUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{name}</div>
                  <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    함께 좋아함 {t.commonBottlingCount}종
                  </div>
                </div>
                <div className="shrink-0 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium tabular-nums text-amber-300">
                  {t.tastingScore}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
