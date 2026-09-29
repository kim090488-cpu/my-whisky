"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createBottling, updateBottling } from "@/lib/contribute/actions";
import { createClient } from "@/lib/supabase/client";
import { CASK_LABEL, BOTTLER_LABEL, COUNTRY_FLAG, COUNTRY_LABEL } from "@/lib/format";
import type { CaskType, BottlerKind, WhiskyCountry } from "@/types/database";

type DuplicateHit = {
  id: string;
  name: string;
  name_kr: string | null;
  age_years: number | null;
  distillery_name: string | null;
  distillery_name_kr: string | null;
  country: WhiskyCountry;
  tasting_count: number;
};

type Distillery = {
  id: string;
  name: string;
  name_kr: string | null;
  country: WhiskyCountry;
  region: string | null;
};

export type BottlingInitial = {
  distillery_id: string | null;
  name: string;
  name_kr: string | null;
  age_years: number | null;
  abv: number | null;
  vintage_year: number | null;
  bottling_year: number | null;
  cask_type: CaskType | null;
  bottler: BottlerKind;
  bottler_name: string | null;
  bottle_size_ml: number | null;
  total_bottles: number | null;
  notes: string | null;
};

const CASKS: CaskType[] = [
  "bourbon", "sherry", "port", "wine", "rum",
  "virgin_oak", "refill", "mixed", "other", "unknown",
];

const BOTTLERS: BottlerKind[] = ["official", "independent", "private"];

export function BottlingForm({
  distilleries, preselectId, edit,
}: {
  distilleries: Distillery[];
  preselectId: string;
  edit?: { bottlingId: string; initial: BottlingInitial };
}) {
  const isEdit = !!edit;
  const init = edit?.initial;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [bottler, setBottler] = useState<BottlerKind>(init?.bottler ?? "official");

  const [nameKr, setNameKr] = useState(init?.name_kr ?? "");
  const [dupes, setDupes] = useState<DuplicateHit[]>([]);
  const [dupeDismissed, setDupeDismissed] = useState(false);

  // 신규 등록에만 중복 검색 — 수정 모드에선 스킵
  useEffect(() => {
    if (isEdit) return;
    const q = nameKr.trim();
    if (q.length < 2) { setDupes([]); return; }
    const supabase = createClient();
    const safe = q.replace(/[%_\\]/g, (m) => `\\${m}`);
    const pattern = `%${safe}%`;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const [krRes, enRes] = await Promise.all([
        supabase
          .from("bottling_card_stats")
          .select("id, name, name_kr, age_years, distillery_name, distillery_name_kr, country, tasting_count")
          .ilike("name_kr", pattern)
          .limit(5),
        supabase
          .from("bottling_card_stats")
          .select("id, name, name_kr, age_years, distillery_name, distillery_name_kr, country, tasting_count")
          .ilike("name", pattern)
          .limit(5),
      ]);
      if (cancelled) return;
      const map = new Map<string, DuplicateHit>();
      for (const row of [...(krRes.data ?? []), ...(enRes.data ?? [])] as DuplicateHit[]) {
        if (row.id && !map.has(row.id)) map.set(row.id, row);
      }
      setDupes(Array.from(map.values()).slice(0, 5));
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [nameKr, isEdit]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = isEdit
        ? await updateBottling(edit!.bottlingId, fd)
        : await createBottling(fd);
      if (res?.error) setError(res.error);
    });
  }

  // 국가별로 그룹
  const byCountry = new Map<WhiskyCountry, Distillery[]>();
  for (const d of distilleries) {
    const arr = byCountry.get(d.country) ?? [];
    arr.push(d);
    byCountry.set(d.country, arr);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="증류소" hint="모르면 비워둬도 돼요">
        <select
          name="distillery_id"
          defaultValue={init?.distillery_id ?? preselectId}
          className={fieldCls}
        >
          <option value="">— 모름 / 선택 안 함 —</option>
          {[...byCountry.entries()].map(([country, list]) => (
            <optgroup key={country} label={`${COUNTRY_FLAG[country]} ${COUNTRY_LABEL[country]}`}>
              {list.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name_kr ?? d.name}
                  {d.name_kr && d.name_kr !== d.name ? ` (${d.name})` : ""}
                  {d.region ? ` · ${d.region}` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <Field label="보틀링 이름 (한글)" required hint="예: 맥캘란 18년 셰리오크">
        <input
          name="name_kr"
          required
          maxLength={200}
          value={nameKr}
          onChange={(e) => { setNameKr(e.target.value); setDupeDismissed(false); }}
          className={fieldCls}
        />
        {!isEdit && !dupeDismissed && dupes.length > 0 && (
          <div className="mt-2 rounded-lg border border-amber-400/40 bg-amber-400/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
                <AlertTriangle className="size-3.5" />
                이미 등록된 위스키가 있어요
              </div>
              <button
                type="button"
                onClick={() => setDupeDismissed(true)}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                무시
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              중복 등록을 피해주세요. 클릭하면 상세로 이동해요.
            </p>
            <ul className="mt-2 space-y-1">
              {dupes.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/whiskies/${d.id}`}
                    target="_blank"
                    className="flex items-center gap-2 rounded border border-border bg-card/40 px-2.5 py-2 text-xs hover:border-foreground/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-muted-foreground truncate">
                        {COUNTRY_FLAG[d.country]}{" "}
                        {d.distillery_name_kr ?? d.distillery_name ?? "(증류소 없음)"}
                      </div>
                      <div className="mt-0.5 truncate font-medium text-foreground">
                        {d.name_kr ?? d.name}
                        {d.age_years !== null ? ` · ${d.age_years}년` : ""}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground">노트 {d.tasting_count}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Field>

      <Field label="보틀링 이름 (영문)" hint="알면 함께 적어두세요 — 예: Macallan 18 Year Old Sherry Oak">
        <input
          name="name"
          maxLength={200}
          defaultValue={init && init.name !== (init.name_kr ?? "") ? init.name : ""}
          className={fieldCls}
          placeholder="영문 표기 (선택)"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="숙성 (년)">
          <input name="age_years" type="number" min={0} max={100} placeholder="NAS" defaultValue={init?.age_years ?? ""} className={fieldCls} />
        </Field>
        <Field label="ABV (%)">
          <input name="abv" type="number" step="0.1" min={20} max={80} defaultValue={init?.abv ?? ""} className={fieldCls} />
        </Field>
        <Field label="빈티지">
          <input name="vintage_year" type="number" min={1900} max={new Date().getFullYear()} defaultValue={init?.vintage_year ?? ""} className={fieldCls} />
        </Field>
        <Field label="병입 연도">
          <input name="bottling_year" type="number" min={1900} max={new Date().getFullYear() + 1} defaultValue={init?.bottling_year ?? ""} className={fieldCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="캐스크">
          <select name="cask_type" defaultValue={init?.cask_type ?? "unknown"} className={fieldCls}>
            {CASKS.map((c) => (
              <option key={c} value={c}>{CASK_LABEL[c]}</option>
            ))}
          </select>
        </Field>
        <Field label="병입자">
          <select
            name="bottler"
            value={bottler}
            onChange={(e) => setBottler(e.target.value as BottlerKind)}
            className={fieldCls}
          >
            {BOTTLERS.map((b) => (
              <option key={b} value={b}>{BOTTLER_LABEL[b]}</option>
            ))}
          </select>
        </Field>
      </div>

      {bottler !== "official" && (
        <Field label="병입자 이름" hint="예: Signatory Vintage">
          <input name="bottler_name" maxLength={100} defaultValue={init?.bottler_name ?? ""} className={fieldCls} />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="용량 (ml)" hint="기본 700">
          <input name="bottle_size_ml" type="number" min={50} max={10000} placeholder="700" defaultValue={init?.bottle_size_ml ?? ""} className={fieldCls} />
        </Field>
        <Field label="총 병수" hint="한정판이면 입력">
          <input name="total_bottles" type="number" min={1} defaultValue={init?.total_bottles ?? ""} className={fieldCls} />
        </Field>
      </div>

      <Field label="추가 노트" hint="2000자 이내">
        <textarea name="notes" rows={4} maxLength={2000} defaultValue={init?.notes ?? ""} className={fieldCls} />
      </Field>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex gap-3 border-t border-neutral-900 pt-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-amber-400 px-5 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-300 disabled:opacity-50"
        >
          {pending ? "저장 중…" : isEdit ? "수정 저장" : "보틀링 등록"}
        </button>
      </div>
    </form>
  );
}

const fieldCls =
  "w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none";

function Field({
  label, hint, required, children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          {label}{required && <span className="text-amber-400">*</span>}
        </span>
        {hint && <span className="text-[10px] text-neutral-600">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
