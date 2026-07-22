"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FLAVOR_TAGS, type FlavorTag } from "@/lib/tastings/flavor-filters";

const SORTS = [
  { value: "recent", label: "최근" },
  { value: "score",  label: "점수" },
  { value: "likes",  label: "좋아요" },
] as const;

const MIN_SCORES = [
  { value: "",   label: "전체" },
  { value: "80", label: "80+" },
  { value: "85", label: "85+" },
  { value: "90", label: "90+" },
] as const;

export function NotesFilterBar({
  sort,
  minScore,
  buyback,
  flavors,
}: {
  sort: string;
  minScore: string | null;
  buyback: boolean;
  flavors: FlavorTag[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const flavorSet = new Set<string>(flavors);

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp?.toString() ?? "");
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("notes_page");
    const qs = next.toString();
    router.push(
      `${pathname}${qs ? `?${qs}` : ""}#tasting-notes`,
      { scroll: false },
    );
  }

  return (
    <div className="mb-4 space-y-2">
      <nav className="flex gap-0.5 text-xs">
        {SORTS.map((o) => {
          const active = sort === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => update({ notes_sort: o.value === "recent" ? null : o.value })}
              className={[
                "rounded-full px-3 py-1.5 transition-colors",
                active
                  ? "bg-primary/15 font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {o.label}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="inline-flex items-center gap-0.5 rounded-full border border-border p-0.5">
          {MIN_SCORES.map((s) => {
            const active = (minScore ?? "") === s.value;
            return (
              <button
                key={s.value || "all"}
                type="button"
                onClick={() => update({ notes_min_score: s.value || null })}
                className={[
                  "rounded-full px-2.5 py-0.5 transition-colors",
                  active
                    ? "bg-primary/15 font-medium text-primary"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <label
          className={[
            "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 transition-colors",
            buyback
              ? "border-emerald-700/60 bg-emerald-400/10 text-emerald-300"
              : "border-border text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <input
            type="checkbox"
            checked={buyback}
            onChange={(e) => update({ notes_buyback: e.target.checked ? "1" : null })}
            className="size-3 accent-emerald-400"
          />
          <span>다시 살래요만</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">향미</span>
        {FLAVOR_TAGS.map((t) => {
          const active = flavorSet.has(t.value);
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                const next = new Set(flavorSet);
                if (active) next.delete(t.value);
                else next.add(t.value);
                const list = FLAVOR_TAGS.filter((x) => next.has(x.value)).map((x) => x.value);
                update({ notes_flavors: list.length > 0 ? list.join(",") : null });
              }}
              className={[
                "rounded-full border px-2.5 py-0.5 transition-colors",
                active
                  ? "border-amber-400/60 bg-amber-400/10 text-amber-300"
                  : "border-border text-muted-foreground hover:text-foreground",
              ].join(" ")}
              title={`${t.label} 향미가 두드러진 노트 (7/10 이상)`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
