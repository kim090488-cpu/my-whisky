"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { COUNTRY_LABEL } from "@/lib/format";
import type { WhiskyCountry } from "@/types/database";
import { FLAVOR_TAGS, type FlavorTag } from "@/lib/tastings/flavor-filters";

const COUNTRY_KEYS = Object.keys(COUNTRY_LABEL) as WhiskyCountry[];

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

const VISIBILITIES = [
  { value: "",          label: "전체" },
  { value: "public",    label: "공개" },
  { value: "followers", label: "팔로워만" },
  { value: "private",   label: "비공개" },
] as const;

export function FilterBar({
  sort,
  country,
  minScore,
  buyback,
  flavors,
  visibility,
  showVisibility = false,
}: {
  sort: string;
  country: string | null;
  minScore: string | null;
  buyback: boolean;
  flavors: FlavorTag[];
  visibility?: string | null;
  showVisibility?: boolean;
}) {
  const flavorSet = new Set<string>(flavors);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp?.toString() ?? "");
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="mb-5 space-y-3">
      <nav className="flex gap-0.5 text-xs">
        {SORTS.map((o) => {
          const active = sort === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => update({ sort: o.value === "recent" ? null : o.value })}
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
        <label className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span>국가</span>
          <select
            value={country ?? ""}
            onChange={(e) => update({ country: e.target.value || null })}
            className="rounded-md border border-border bg-transparent px-2 py-1 text-foreground focus:outline-none focus:border-foreground/40"
          >
            <option value="">전체</option>
            {COUNTRY_KEYS.map((c) => (
              <option key={c} value={c}>
                {COUNTRY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>

        <div className="inline-flex items-center gap-0.5 rounded-full border border-border p-0.5">
          {MIN_SCORES.map((s) => {
            const active = (minScore ?? "") === s.value;
            return (
              <button
                key={s.value || "all"}
                type="button"
                onClick={() => update({ min_score: s.value || null })}
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
            onChange={(e) => update({ buyback: e.target.checked ? "1" : null })}
            className="size-3 accent-emerald-400"
          />
          <span>다시 살래요만</span>
        </label>

        {showVisibility && (
          <div className="inline-flex items-center gap-0.5 rounded-full border border-border p-0.5">
            {VISIBILITIES.map((v) => {
              const active = (visibility ?? "") === v.value;
              return (
                <button
                  key={v.value || "all"}
                  type="button"
                  onClick={() => update({ visibility: v.value || null })}
                  className={[
                    "rounded-full px-2.5 py-0.5 transition-colors",
                    active
                      ? "bg-primary/15 font-medium text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        )}
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
                update({ flavors: list.length > 0 ? list.join(",") : null });
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
