import Link from "next/link";
import { Avatar } from "@/components/avatar";
import type { BottlingFan } from "@/lib/social/bottling-fans";
import type { TasteTagTone } from "@/lib/tastings/taste-profile";

const TONE_CLASS: Record<TasteTagTone, string> = {
  amber:   "border-amber-400/40 bg-amber-400/10 text-amber-300",
  emerald: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  rose:    "border-rose-400/40 bg-rose-400/10 text-rose-300",
  sky:     "border-sky-400/40 bg-sky-400/10 text-sky-300",
};

const MAX_TAGS_PER_CARD = 4;

export function BottlingFansSection({ fans }: { fans: BottlingFan[] }) {
  if (fans.length === 0) return null;
  return (
    <section className="rounded-2xl border border-border bg-card/40 p-4 sm:p-5">
      <div className="mb-3">
        <h3 className="font-serif text-lg tracking-tight">이 위스키를 좋아한 사람들</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          85점 이상 준 유저의 취향을 함께 살펴보세요
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {fans.map((f) => {
          const name = f.displayName || f.username;
          const visibleTags = f.tags.slice(0, MAX_TAGS_PER_CARD);
          const extra = f.tags.length - visibleTags.length;
          return (
            <li key={f.userId}>
              <Link
                href={`/tastings/${f.tastingId}`}
                className="group flex flex-col gap-2 rounded-lg border border-border/60 bg-background/40 p-3 transition-colors hover:border-foreground/30 hover:bg-card"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={name} avatarUrl={f.avatarUrl} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{name}</div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      @{f.username}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium tabular-nums text-amber-300">
                    {f.tastingScore}
                  </div>
                </div>
                {visibleTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {visibleTags.map((tag) => (
                      <span
                        key={tag.key}
                        title={tag.hint}
                        className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] ${TONE_CLASS[tag.tone]}`}
                      >
                        {tag.label}
                      </span>
                    ))}
                    {extra > 0 && (
                      <span className="inline-flex items-center rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        +{extra}
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
