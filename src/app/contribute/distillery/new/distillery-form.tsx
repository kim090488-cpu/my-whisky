"use client";

import { useState, useTransition } from "react";
import { createDistillery } from "@/lib/contribute/actions";
import { COUNTRY_LABEL } from "@/lib/format";
import type { WhiskyCountry, DistilleryStatus } from "@/types/database";

const STATUSES: { v: DistilleryStatus; l: string }[] = [
  { v: "active", l: "가동 중" },
  { v: "silent", l: "침묵" },
  { v: "closed", l: "폐쇄" },
  { v: "demolished", l: "철거됨" },
  { v: "planned", l: "예정" },
];

export function DistilleryForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [country, setCountry] = useState<WhiskyCountry>("scotland");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createDistillery(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="이름 (영문)" required>
        <input name="name" required maxLength={100} className={fieldCls} placeholder="Glenfiddich" />
      </Field>

      <Field label="이름 (한글)" hint="예: 글렌피딕">
        <input name="name_kr" maxLength={100} className={fieldCls} placeholder="한글 표기 (선택)" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="국가" required>
          <select
            name="country"
            value={country}
            onChange={(e) => setCountry(e.target.value as WhiskyCountry)}
            className={fieldCls}
          >
            {(Object.keys(COUNTRY_LABEL) as WhiskyCountry[]).map((c) => (
              <option key={c} value={c}>{COUNTRY_LABEL[c]}</option>
            ))}
          </select>
        </Field>
        <Field label="지역" hint="Speyside / Islay / Kentucky 등">
          <input name="region" maxLength={50} className={fieldCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="상태">
          <select name="status" defaultValue="active" className={fieldCls}>
            {STATUSES.map((s) => (
              <option key={s.v} value={s.v}>{s.l}</option>
            ))}
          </select>
        </Field>
        <Field label="설립 연도">
          <input name="founded_year" type="number" min={1500} max={new Date().getFullYear() + 1} className={fieldCls} />
        </Field>
      </div>

      <Field label="웹사이트">
        <input name="website" type="url" placeholder="https://..." className={fieldCls} />
      </Field>

      <Field label="소개" hint="2000자 이내">
        <textarea name="description" rows={5} maxLength={2000} className={fieldCls} />
      </Field>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex gap-3 border-t border-neutral-900 pt-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-amber-400 px-5 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-300 disabled:opacity-50"
        >
          {pending ? "저장 중…" : "증류소 등록"}
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
