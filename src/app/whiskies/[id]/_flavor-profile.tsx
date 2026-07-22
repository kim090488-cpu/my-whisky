import { FlavorRadar, type FlavorValues } from "@/components/social/flavor-radar";

export type FlavorProfileData = {
  avg_sweetness: number | null;
  avg_smokiness: number | null;
  avg_fruitiness: number | null;
  avg_spiciness: number | null;
  avg_smoothness: number | null;
  avg_complexity: number | null;
  avg_finish_length: number | null;
};

const SUMMARY_AXES = [
  { key: "avg_sweetness",     label: "단맛" },
  { key: "avg_smokiness",     label: "스모키" },
  { key: "avg_fruitiness",    label: "과일맛" },
  { key: "avg_spiciness",     label: "스파이시" },
  { key: "avg_finish_length", label: "여운" },
  { key: "avg_complexity",    label: "복잡도" },
  { key: "avg_smoothness",    label: "부드러움" },
] as const satisfies readonly { key: keyof FlavorProfileData; label: string }[];

export function FlavorProfile({ data }: { data: FlavorProfileData }) {
  const values: FlavorValues = {
    sweetness:     data.avg_sweetness,
    smokiness:     data.avg_smokiness,
    fruitiness:    data.avg_fruitiness,
    spiciness:     data.avg_spiciness,
    smoothness:    data.avg_smoothness,
    complexity:    data.avg_complexity,
    finish_length: data.avg_finish_length,
  };
  const hasAny = Object.values(values).some((v) => v !== null);

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card/40 p-6 sm:p-8">
      <header className="mb-4">
        <h2 className="font-serif text-2xl tracking-tight">Flavor profile</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasAny ? "후기 평균 · 1~10" : "후기에서 맛 프로필이 입력되면 채워져요 · 1~10"}
        </p>
      </header>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-10">
        <div className="w-full max-w-[320px] shrink-0">
          {hasAny ? (
            <FlavorRadar values={values} size={320} showValueLabels />
          ) : (
            <div className="grid aspect-square place-items-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
              데이터 없음
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:flex-1">
          {SUMMARY_AXES.map((axis) => {
            const v = data[axis.key];
            return (
              <div key={axis.key} className="flex items-baseline justify-between">
                <span className="text-foreground/80">{axis.label}</span>
                <span
                  className={`tabular-nums ${v === null ? "text-muted-foreground/60" : "text-amber-300"}`}
                >
                  {v === null ? "—" : v.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
