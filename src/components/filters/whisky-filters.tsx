"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { WhiskyCountry, CaskType } from "@/types/database";
import { COUNTRY_LABEL, CASK_LABEL } from "@/lib/format";
import { toQueryString, type Filters } from "@/lib/whiskies/filters";
import { FLAVOR_TAGS } from "@/lib/tastings/flavor-filters";

type Props = {
  filters: Filters;
  regionsByCountry: Record<string, string[]>;
};

export function WhiskyFilters({ filters, regionsByCountry }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [ageMin, setAgeMin] = useState(filters.age_min ?? "");
  const [ageMax, setAgeMax] = useState(filters.age_max ?? "");
  const [abvMin, setAbvMin] = useState(filters.abv_min ?? "");
  const [abvMax, setAbvMax] = useState(filters.abv_max ?? "");

  const commit = (patch: Partial<Filters>) => {
    const qs = toQueryString({ ...patch, page: 1 }, new URLSearchParams(searchParams.toString()));
    startTransition(() => router.push(`/whiskies${qs}`));
  };

  const countries = Object.keys(regionsByCountry) as WhiskyCountry[];
  const regions = filters.country ? regionsByCountry[filters.country] ?? [] : [];

  const reset = () => {
    setAgeMin(""); setAgeMax(""); setAbvMin(""); setAbvMax("");
    startTransition(() => router.push("/whiskies"));
  };

  return (
    <aside className={"space-y-6 text-sm transition-opacity " + (pending ? "opacity-50" : "")}>
      <Section title="국가">
        <select
          value={filters.country}
          onChange={(e) => commit({ country: e.target.value as WhiskyCountry, region: "" })}
          className={selectCls}
        >
          <option value="">전체</option>
          {countries.map((c) => (
            <option key={c} value={c}>{COUNTRY_LABEL[c] ?? c}</option>
          ))}
        </select>
      </Section>

      {regions.length > 0 && (
        <Section title="지역">
          <select
            value={filters.region}
            onChange={(e) => commit({ region: e.target.value })}
            className={selectCls}
          >
            <option value="">전체</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </Section>
      )}

      <Section title="캐스크">
        <select
          value={filters.cask}
          onChange={(e) => commit({ cask: e.target.value as CaskType })}
          className={selectCls}
        >
          <option value="">전체</option>
          {(Object.keys(CASK_LABEL) as CaskType[])
            .filter((k) => k !== "unknown")
            .map((k) => (
              <option key={k} value={k}>{CASK_LABEL[k]}</option>
            ))}
        </select>
      </Section>

      <Section title="숙성연수">
        <div className="flex items-center gap-2">
          <NumberInput value={ageMin} onChange={setAgeMin} placeholder="0"
            onBlur={() => commit({ age_min: ageMin === "" ? null : Number(ageMin) })} />
          <span className="text-muted-foreground">~</span>
          <NumberInput value={ageMax} onChange={setAgeMax} placeholder="30+"
            onBlur={() => commit({ age_max: ageMax === "" ? null : Number(ageMax) })} />
        </div>
      </Section>

      <Section title="ABV (%)">
        <div className="flex items-center gap-2">
          <NumberInput value={abvMin} onChange={setAbvMin} placeholder="40" step="0.1"
            onBlur={() => commit({ abv_min: abvMin === "" ? null : Number(abvMin) })} />
          <span className="text-muted-foreground">~</span>
          <NumberInput value={abvMax} onChange={setAbvMax} placeholder="65" step="0.1"
            onBlur={() => commit({ abv_max: abvMax === "" ? null : Number(abvMax) })} />
        </div>
      </Section>

      <Section title="향미 (리뷰 평균)">
        <div className="flex flex-wrap gap-1.5">
          {FLAVOR_TAGS.map((tag) => {
            const active = filters.flavors.includes(tag.value);
            return (
              <button
                key={tag.value}
                type="button"
                onClick={() => {
                  const next = active
                    ? filters.flavors.filter((v) => v !== tag.value)
                    : [...filters.flavors, tag.value];
                  commit({ flavors: next });
                }}
                className={[
                  "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  active
                    ? "border-amber-400/60 bg-amber-400/10 text-amber-300"
                    : "border-border text-muted-foreground hover:text-foreground",
                ].join(" ")}
                title={`평균 ${tag.label} 7/10 이상인 위스키만`}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      </Section>

      <button
        onClick={reset}
        className="w-full rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
      >
        필터 초기화
      </button>
    </aside>
  );
}

const selectCls =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function NumberInput({
  value, onChange, onBlur, placeholder, step,
}: {
  value: number | string;
  onChange: (v: string) => void;
  onBlur: () => void;
  placeholder?: string;
  step?: string;
}) {
  return (
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      placeholder={placeholder}
      className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"
    />
  );
}
