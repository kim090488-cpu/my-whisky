"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search, PlusCircle } from "lucide-react";
import { COUNTRY_FLAG, formatAge, formatAbv } from "@/lib/format";
import type { WhiskyCountry } from "@/types/database";

export type BottlingHit = {
  id: string;
  name: string;
  name_kr: string | null;
  age_years: number | null;
  abv: number | null;
  distillery_name: string;
  distillery_name_kr: string | null;
  country: WhiskyCountry;
  region: string | null;
  avg_score: number | null;
  tasting_count: number;
};

export function BottlingPicker({ onSelect }: { onSelect: (b: BottlingHit) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<BottlingHit[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setItems([]);
      setLoading(false);
      return;
    }
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: ac.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { bottlings: BottlingHit[] };
        setItems(data.bottlings ?? []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") console.error(err);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="위스키 이름·증류소 검색 (예: 글렌피딕, 라가불린 16)"
          autoComplete="off"
          autoFocus
          className="w-full rounded-md border border-neutral-800 bg-neutral-950 py-3 pl-10 pr-3 text-sm placeholder:text-neutral-600 focus:border-amber-400 focus:outline-none"
        />
      </div>

      {q.trim() === "" ? (
        <p className="px-1 text-xs text-neutral-600">
          어떤 위스키에 대한 노트인가요? 위에서 검색해서 골라주세요.
        </p>
      ) : loading && items.length === 0 ? (
        <p className="px-1 text-xs text-neutral-500">검색 중…</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-neutral-800 bg-neutral-950/50 p-5 text-center">
          <p className="text-sm text-neutral-400">
            &ldquo;{q}&rdquo;에 대한 결과가 없어요.
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            카탈로그에 없는 위스키라면 직접 등록할 수 있어요.
          </p>
          <Link
            href="/contribute/bottling/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-medium text-neutral-950 transition-colors hover:bg-amber-300"
          >
            <PlusCircle className="size-3.5" />새 위스키 등록
          </Link>
        </div>
      ) : (
        <>
          <ul className="overflow-hidden rounded-md border border-neutral-800 bg-neutral-950/50">
            {items.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onSelect(b)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-amber-400/10 hover:text-amber-100"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{b.name_kr ?? b.name}</div>
                    <div className="mt-0.5 truncate text-xs text-neutral-500">
                      {COUNTRY_FLAG[b.country]} {b.distillery_name_kr ?? b.distillery_name} ·{" "}
                      {formatAge(b.age_years)} · {formatAbv(b.abv)}
                    </div>
                  </div>
                  {b.avg_score !== null && (
                    <span className="shrink-0 text-xs text-amber-300">
                      {b.avg_score}
                      <span className="ml-0.5 text-[10px] text-neutral-500">({b.tasting_count})</span>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <Link
            href="/contribute/bottling/new"
            className="inline-flex items-center gap-1 px-1 text-[11px] text-muted-foreground transition-colors hover:text-amber-300"
          >
            <PlusCircle className="size-3" />
            찾는 위스키가 없나요? 새로 등록
          </Link>
        </>
      )}
    </div>
  );
}
