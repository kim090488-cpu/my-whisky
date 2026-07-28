"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { BADGE_META, type UserBadgeRow } from "@/lib/badges";

type Props = {
  badges: UserBadgeRow[];
  displayName: string;
};

export function BadgeStrip({ badges, displayName }: Props) {
  const [open, setOpen] = useState(false);
  if (badges.length === 0) return null;

  // 정의된 코드만 표시 · 최신순
  const known = badges
    .filter((b) => BADGE_META[b.code])
    .sort((a, b) => (a.earned_at < b.earned_at ? 1 : -1));
  if (known.length === 0) return null;

  const previewCount = 6;
  const preview = known.slice(0, previewCount);
  const rest = known.length - preview.length;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="뱃지 전체 보기"
        className="group flex flex-wrap items-center gap-1.5 text-left"
      >
        {preview.map((b) => {
          const meta = BADGE_META[b.code];
          return (
            <span
              key={b.code}
              title={meta.label}
              className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/[0.06] px-2 py-1 text-xs text-primary/90 transition-colors group-hover:border-primary/40 group-hover:bg-primary/10"
            >
              <span aria-hidden>{meta.emoji}</span>
              <span className="font-medium">{meta.label}</span>
            </span>
          );
        })}
        {rest > 0 && (
          <span className="inline-flex items-center rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
            +{rest}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-serif text-lg">
                {displayName}님의 뱃지 · {known.length}개
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </header>
            <ul className="max-h-[70vh] divide-y divide-border/60 overflow-y-auto">
              {known.map((b) => {
                const meta = BADGE_META[b.code];
                const earned = b.earned_at.slice(0, 10);
                return (
                  <li key={b.code} className="flex items-center gap-3 px-5 py-3">
                    <span aria-hidden className="text-2xl">
                      {meta.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{meta.label}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {meta.description}
                      </div>
                    </div>
                    <time className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
                      {earned}
                    </time>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
