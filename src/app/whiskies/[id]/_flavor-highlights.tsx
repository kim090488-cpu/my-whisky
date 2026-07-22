const AXES = [
  { key: "avg_sweetness",     label: "달콤" },
  { key: "avg_smokiness",     label: "스모키" },
  { key: "avg_fruitiness",    label: "과일" },
  { key: "avg_spiciness",     label: "스파이시" },
  { key: "avg_smoothness",    label: "부드러운" },
  { key: "avg_complexity",    label: "복잡한" },
  { key: "avg_finish_length", label: "긴 여운" },
] as const;

const THRESHOLD = 7;
const MAX_TAGS = 3;

export type FlavorHighlightsData = {
  avg_sweetness: number | null;
  avg_smokiness: number | null;
  avg_fruitiness: number | null;
  avg_spiciness: number | null;
  avg_smoothness: number | null;
  avg_complexity: number | null;
  avg_finish_length: number | null;
};

export function FlavorHighlights({ data }: { data: FlavorHighlightsData }) {
  const scored: { label: string; value: number }[] = [];
  for (const axis of AXES) {
    const v = data[axis.key];
    if (typeof v === "number" && v >= THRESHOLD) {
      scored.push({ label: axis.label, value: v });
    }
  }
  scored.sort((a, b) => b.value - a.value);
  const tags = scored.slice(0, MAX_TAGS);
  if (tags.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span
          key={t.label}
          className="inline-flex items-baseline gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300"
          title={`${t.label} · ${t.value.toFixed(1)}/10`}
        >
          {t.label}
          <span className="text-[9px] tabular-nums text-amber-300/60">
            {t.value.toFixed(1)}
          </span>
        </span>
      ))}
    </div>
  );
}
