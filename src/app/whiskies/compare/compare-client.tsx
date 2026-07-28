"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  BOTTLER_LABEL,
  CASK_LABEL,
  COUNTRY_FLAG,
  formatAbv,
  formatAge,
} from "@/lib/format";
import { BottlingPicker, type BottlingHit } from "@/app/tastings/new/bottling-picker";
import type { BottlerKind, CaskType, WhiskyCountry } from "@/types/database";

type FlavorAgg = {
  sweetness: number | null;
  smokiness: number | null;
  fruitiness: number | null;
  spiciness: number | null;
  smoothness: number | null;
  complexity: number | null;
  finish_length: number | null;
};

type BottlingFull = {
  id: string;
  name: string;
  name_kr: string | null;
  age_years: number | null;
  abv: number | null;
  cask_type: CaskType;
  bottler: BottlerKind;
  bottler_name: string | null;
  bottle_size_ml: number | null;
  vintage_year: number | null;
  bottling_year: number | null;
  distillery: {
    name: string;
    name_kr: string | null;
    country: WhiskyCountry;
  } | null;
  avg_score: number | null;
  tasting_count: number;
  flavor: FlavorAgg | null;
};

const FLAVOR_AXES: Array<{ k: keyof FlavorAgg; label: string }> = [
  { k: "sweetness", label: "단맛" },
  { k: "smokiness", label: "스모크" },
  { k: "fruitiness", label: "과일" },
  { k: "spiciness", label: "스파이시" },
  { k: "smoothness", label: "부드러움" },
  { k: "complexity", label: "복합미" },
  { k: "finish_length", label: "여운" },
];

export function CompareClient({
  initialA,
  initialB,
}: {
  initialA: string | null;
  initialB: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [aId, setAId] = useState<string | null>(initialA);
  const [bId, setBId] = useState<string | null>(initialB);
  const [a, setA] = useState<BottlingFull | null>(null);
  const [b, setB] = useState<BottlingFull | null>(null);
  const [pickerFor, setPickerFor] = useState<"a" | "b" | null>(null);

  const loadOne = useCallback(async (id: string | null): Promise<BottlingFull | null> => {
    if (!id) return null;
    const supabase = createClient();
    const [bRes, tRes] = await Promise.all([
      supabase
        .from("bottlings")
        .select(
          "id, name, name_kr, age_years, abv, cask_type, bottler, bottler_name, bottle_size_ml, vintage_year, bottling_year, distillery:distilleries(name, name_kr, country)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("tastings")
        .select(
          "score, sweetness, smokiness, fruitiness, spiciness, smoothness, complexity, finish_length",
        )
        .eq("bottling_id", id),
    ]);
    const row = bRes.data as unknown as
      | (Omit<BottlingFull, "distillery" | "avg_score" | "tasting_count" | "flavor"> & {
          distillery:
            | { name: string; name_kr: string | null; country: WhiskyCountry }
            | { name: string; name_kr: string | null; country: WhiskyCountry }[]
            | null;
        })
      | null;
    if (!row) return null;
    const dist = Array.isArray(row.distillery) ? row.distillery[0] : row.distillery;

    const tastings = (tRes.data ?? []) as Array<{ score: number | null } & FlavorAgg>;
    const scored = tastings.filter((t) => t.score !== null);
    const avg_score =
      scored.length > 0
        ? Math.round(
            (scored.reduce((s, t) => s + (t.score as number), 0) / scored.length) * 10,
          ) / 10
        : null;

    const flavor: FlavorAgg | null =
      tastings.length > 0
        ? {
            sweetness: avgAxis(tastings, "sweetness"),
            smokiness: avgAxis(tastings, "smokiness"),
            fruitiness: avgAxis(tastings, "fruitiness"),
            spiciness: avgAxis(tastings, "spiciness"),
            smoothness: avgAxis(tastings, "smoothness"),
            complexity: avgAxis(tastings, "complexity"),
            finish_length: avgAxis(tastings, "finish_length"),
          }
        : null;

    return {
      ...row,
      distillery: dist ?? null,
      avg_score,
      tasting_count: tastings.length,
      flavor,
    };
  }, []);

  useEffect(() => {
    void (async () => setA(await loadOne(aId)))();
  }, [aId, loadOne]);
  useEffect(() => {
    void (async () => setB(await loadOne(bId)))();
  }, [bId, loadOne]);

  // URL sync — 결과 링크 공유 가능
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (aId) params.set("a", aId);
    else params.delete("a");
    if (bId) params.set("b", bId);
    else params.delete("b");
    const next = params.toString();
    const nextUrl = next ? `${pathname}?${next}` : pathname;
    router.replace(nextUrl, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aId, bId]);

  function onPick(target: "a" | "b", picked: BottlingHit) {
    if (target === "a") setAId(picked.id);
    else setBId(picked.id);
    setPickerFor(null);
  }

  if (pickerFor) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-card/40 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">
            {pickerFor === "a" ? "왼쪽" : "오른쪽"} 위스키 선택
          </h2>
          <button
            type="button"
            onClick={() => setPickerFor(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            취소
          </button>
        </div>
        <BottlingPicker onSelect={(p) => onPick(pickerFor, p)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
        <SlotButton
          bottling={a}
          onPick={() => setPickerFor("a")}
          onClear={() => {
            setAId(null);
            setA(null);
          }}
        />
        <div className="flex items-center">
          <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground">
            VS
          </span>
        </div>
        <SlotButton
          bottling={b}
          onPick={() => setPickerFor("b")}
          onClear={() => {
            setBId(null);
            setB(null);
          }}
        />
      </div>

      {(a || b) && (
        <section className="space-y-1 rounded-xl border border-border bg-card/40 p-5">
          <SectionTitle title="기본 스펙" />
          <Row
            label="이름"
            aVal={a?.name_kr ?? a?.name}
            bVal={b?.name_kr ?? b?.name}
          />
          <Row
            label="증류소"
            aVal={
              a?.distillery
                ? `${COUNTRY_FLAG[a.distillery.country]} ${
                    a.distillery.name_kr ?? a.distillery.name
                  }`
                : null
            }
            bVal={
              b?.distillery
                ? `${COUNTRY_FLAG[b.distillery.country]} ${
                    b.distillery.name_kr ?? b.distillery.name
                  }`
                : null
            }
          />
          <Row
            label="숙성"
            aVal={a ? formatAge(a.age_years) : null}
            bVal={b ? formatAge(b.age_years) : null}
          />
          <Row
            label="ABV"
            aVal={a ? formatAbv(a.abv) : null}
            bVal={b ? formatAbv(b.abv) : null}
          />
          <Row
            label="캐스크"
            aVal={a?.cask_type ? CASK_LABEL[a.cask_type] : null}
            bVal={b?.cask_type ? CASK_LABEL[b.cask_type] : null}
          />
          <Row
            label="병입"
            aVal={
              a
                ? BOTTLER_LABEL[a.bottler] +
                  (a.bottler_name ? ` · ${a.bottler_name}` : "")
                : null
            }
            bVal={
              b
                ? BOTTLER_LABEL[b.bottler] +
                  (b.bottler_name ? ` · ${b.bottler_name}` : "")
                : null
            }
          />
          <Row
            label="용량"
            aVal={a?.bottle_size_ml ? `${a.bottle_size_ml}ml` : null}
            bVal={b?.bottle_size_ml ? `${b.bottle_size_ml}ml` : null}
          />
          {(a?.vintage_year != null || b?.vintage_year != null) && (
            <Row
              label="빈티지"
              aVal={a?.vintage_year?.toString() ?? null}
              bVal={b?.vintage_year?.toString() ?? null}
            />
          )}
          {(a?.bottling_year != null || b?.bottling_year != null) && (
            <Row
              label="병입연도"
              aVal={a?.bottling_year?.toString() ?? null}
              bVal={b?.bottling_year?.toString() ?? null}
            />
          )}
        </section>
      )}

      {(a || b) && (
        <section className="space-y-3 rounded-xl border border-border bg-card/40 p-5">
          <SectionTitle title="커뮤니티 평점" />
          <div className="grid grid-cols-2 gap-3">
            <ScoreCol bottling={a} />
            <ScoreCol bottling={b} />
          </div>
        </section>
      )}

      {(a?.flavor || b?.flavor) && (
        <section className="space-y-3 rounded-xl border border-border bg-card/40 p-5">
          <SectionTitle title="향미 프로필 (평균)" />
          <div className="mb-2 flex items-center gap-4 text-[10px] text-muted-foreground">
            <LegendDot color="bg-amber-400/80" label={a?.name_kr ?? a?.name ?? "왼쪽"} />
            <LegendDot color="bg-sky-300/80" label={b?.name_kr ?? b?.name ?? "오른쪽"} />
          </div>
          {FLAVOR_AXES.map((ax) => (
            <FlavorRow
              key={ax.k}
              label={ax.label}
              aVal={a?.flavor?.[ax.k] ?? null}
              bVal={b?.flavor?.[ax.k] ?? null}
            />
          ))}
        </section>
      )}

      {!a && !b && (
        <p className="rounded-xl border border-dashed border-border bg-card/20 p-8 text-center text-sm text-muted-foreground">
          위 슬롯에서 위스키 두 개를 골라보세요.
        </p>
      )}
    </div>
  );
}

function SlotButton({
  bottling,
  onPick,
  onClear,
}: {
  bottling: BottlingFull | null;
  onPick: () => void;
  onClear: () => void;
}) {
  if (!bottling) {
    return (
      <button
        type="button"
        onClick={onPick}
        className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-card/20 p-4 text-primary transition-colors hover:border-primary/40 hover:bg-primary/5"
      >
        <Plus className="size-5" />
        <span className="text-xs font-medium">위스키 선택</span>
      </button>
    );
  }
  return (
    <div className="flex min-h-24 flex-col gap-1 rounded-xl border border-border bg-card p-4">
      <Link
        href={`/whiskies/${bottling.id}`}
        className="line-clamp-2 text-sm font-medium hover:text-primary"
      >
        {bottling.name_kr ?? bottling.name}
      </Link>
      {bottling.distillery && (
        <p className="truncate text-[11px] text-muted-foreground">
          {COUNTRY_FLAG[bottling.distillery.country]}{" "}
          {bottling.distillery.name_kr ?? bottling.distillery.name}
        </p>
      )}
      <div className="mt-auto flex items-center gap-3 text-[11px]">
        <button
          type="button"
          onClick={onPick}
          className="text-primary hover:underline"
        >
          변경
        </button>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-destructive"
        >
          <X className="size-3" />
          제거
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
      {title}
    </h2>
  );
}

function Row({
  label,
  aVal,
  bVal,
}: {
  label: string;
  aVal?: string | null;
  bVal?: string | null;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr_1fr] gap-3 border-b border-border/60 py-2 text-sm last:border-b-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="truncate">{aVal ?? "—"}</span>
      <span className="truncate">{bVal ?? "—"}</span>
    </div>
  );
}

function ScoreCol({ bottling }: { bottling: BottlingFull | null }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-background/40 p-4">
      <span className="font-serif text-3xl font-semibold tabular-nums text-primary">
        {bottling?.avg_score ?? "—"}
      </span>
      <span className="text-[10px] text-muted-foreground">
        {bottling ? `${bottling.tasting_count.toLocaleString()}개 노트` : ""}
      </span>
    </div>
  );
}

function FlavorRow({
  label,
  aVal,
  bVal,
}: {
  label: string;
  aVal: number | null;
  bVal: number | null;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr] items-center gap-3 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="space-y-1">
        <FlavorBar value={aVal} color="bg-amber-400/80" />
        <FlavorBar value={bVal} color="bg-sky-300/80" />
      </div>
    </div>
  );
}

function FlavorBar({ value, color }: { value: number | null; color: string }) {
  const pct = value != null ? Math.min(100, value * 10) : 0;
  return (
    <div className="relative h-4 overflow-hidden rounded-full bg-muted/50">
      <div
        className={"absolute inset-y-0 left-0 " + color}
        style={{ width: `${pct}%` }}
      />
      <span className="absolute inset-y-0 right-1.5 flex items-center text-[10px] font-medium tabular-nums text-foreground">
        {value != null ? value.toFixed(1) : "—"}
      </span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 truncate">
      <span className={"size-2 rounded-full " + color} />
      <span className="truncate">{label}</span>
    </span>
  );
}

function avgAxis(
  rows: Array<Partial<FlavorAgg>>,
  key: keyof FlavorAgg,
): number | null {
  const nums = rows
    .map((r) => r[key])
    .filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}
