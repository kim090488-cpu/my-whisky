"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitPriceRecord } from "@/lib/prices/actions";
import { PRICE_SOURCE_LABEL } from "@/lib/format";
import type { PriceSource } from "@/types/database";

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function PriceForm({ bottlingId }: { bottlingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [price, setPrice] = useState("");
  const [source, setSource] = useState<PriceSource>("retail");
  const [place, setPlace] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [recordedAt, setRecordedAt] = useState(todayLocal());

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-400/20"
      >
        + 시세 제보
      </button>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("bottling_id", bottlingId);
    fd.set("price", price);
    fd.set("currency", "KRW");
    fd.set("source", source);
    fd.set("place", place);
    fd.set("source_url", sourceUrl);
    fd.set("recorded_at", recordedAt);

    startTransition(async () => {
      const res = await submitPriceRecord(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setPrice(""); setPlace(""); setSourceUrl("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="가격 (KRW)">
          <input
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            className={fieldCls}
          />
        </Field>
        <Field label="출처">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as PriceSource)}
            className={fieldCls}
          >
            {(Object.keys(PRICE_SOURCE_LABEL) as PriceSource[]).map((s) => (
              <option key={s} value={s}>{PRICE_SOURCE_LABEL[s]}</option>
            ))}
          </select>
        </Field>
        <Field label="장소" hint="가게 이름, 사이트명 등">
          <input
            type="text"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="신세계 본점 / 데일리샷"
            className={fieldCls}
          />
        </Field>
        <Field label="기록일">
          <input
            type="date"
            value={recordedAt}
            onChange={(e) => setRecordedAt(e.target.value)}
            className={fieldCls}
          />
        </Field>
      </div>

      <Field label="출처 URL (선택)" hint="실제 가격 페이지 링크">
        <input
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://..."
          className={fieldCls}
        />
      </Field>

      {error && <p className="text-xs text-red-300">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !price}
          className="rounded-md bg-amber-400 px-4 py-1.5 text-xs font-medium text-neutral-950 hover:bg-amber-300 disabled:opacity-50"
        >
          {pending ? "저장 중…" : "제보"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-neutral-700 px-4 py-1.5 text-xs hover:border-neutral-500"
        >
          취소
        </button>
      </div>
    </form>
  );
}

const fieldCls =
  "w-full rounded-md border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm focus:border-amber-400 focus:outline-none";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</span>
        {hint && <span className="text-[10px] text-neutral-600">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
