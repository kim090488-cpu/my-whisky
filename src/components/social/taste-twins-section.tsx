import Link from "next/link";
import { Avatar } from "@/components/avatar";
import type { TasteTwin } from "@/lib/social/taste-twins";

export function TasteTwinsSection({
  twins,
  ownerName,
  isSelf,
}: {
  twins: TasteTwin[];
  ownerName: string;
  isSelf: boolean;
}) {
  if (twins.length === 0) return null;
  const heading = isSelf
    ? "나와 같은 위스키를 사랑하는 사람"
    : `${ownerName}과 같은 위스키를 사랑하는 사람`;
  return (
    <section className="mt-10">
      <div className="mb-4">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {heading}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground/80">
          85점 이상 겹치는 보틀링 개수 순위
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {twins.map((t) => {
          const name = t.displayName || t.username;
          return (
            <li key={t.userId}>
              <Link
                href={`/profile/${t.username}`}
                className="group flex flex-col gap-2 rounded-xl border border-border bg-card/40 p-3 transition-colors hover:border-foreground/30 hover:bg-card"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={name} avatarUrl={t.avatarUrl} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{name}</div>
                    <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      @{t.username}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">
                    {t.commonBottlingCount}종
                  </div>
                </div>
                {t.previewBottlings.length > 0 && (
                  <div className="border-t border-border/60 pt-2 text-[11px] text-muted-foreground/90">
                    <span className="text-muted-foreground/70">함께 좋아함 · </span>
                    {t.previewBottlings
                      .map((b) => b.nameKr || b.name)
                      .join(" · ")}
                    {t.commonBottlingCount > t.previewBottlings.length && (
                      <span className="text-muted-foreground/60">
                        {" "}
                        외 {t.commonBottlingCount - t.previewBottlings.length}종
                      </span>
                    )}
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
