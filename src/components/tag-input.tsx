"use client";

import { useState } from "react";
import { X } from "lucide-react";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  placeholder?: string;
};

export function TagInput({
  value,
  onChange,
  max = 10,
  placeholder = "태그 추가 (예: 피트, 입문)",
}: Props) {
  const [draft, setDraft] = useState("");

  function add() {
    const t = draft.trim();
    if (!t || t.length > 30) return;
    if (value.includes(t)) {
      setDraft("");
      return;
    }
    if (value.length >= max) return;
    onChange([...value, t]);
    setDraft("");
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
      return;
    }
    if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t, i) => (
            <span
              key={`${t}-${i}`}
              className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-xs text-primary"
            >
              #{t}
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`${t} 태그 제거`}
                className="inline-flex size-3.5 items-center justify-center rounded-full hover:bg-primary/20"
              >
                <X className="size-2.5" strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}
      {value.length < max && (
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={30}
            placeholder={placeholder}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50"
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim()}
            className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-40"
          >
            추가
          </button>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        {value.length}/{max} · 각 30자 이내 · Enter나 쉼표로 추가
      </p>
    </div>
  );
}

export function TagChips({
  tags,
  className,
  max,
}: {
  tags: string[] | null | undefined;
  className?: string;
  max?: number;
}) {
  const list = tags ?? [];
  if (list.length === 0) return null;
  const shown = typeof max === "number" ? list.slice(0, max) : list;
  const more = typeof max === "number" ? list.length - shown.length : 0;
  return (
    <div className={"flex flex-wrap gap-1 " + (className ?? "")}>
      {shown.map((t, i) => (
        <span
          key={`${t}-${i}`}
          className="inline-flex items-center rounded-full border border-primary/25 bg-primary/[0.06] px-2 py-0.5 text-[10px] text-primary/90"
        >
          #{t}
        </span>
      ))}
      {more > 0 && (
        <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
          +{more}
        </span>
      )}
    </div>
  );
}
