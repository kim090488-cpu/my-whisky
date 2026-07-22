"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { COUNTRY_FLAG, formatAge, formatAbv } from "@/lib/format";
import type { WhiskyCountry } from "@/types/database";

type DistilleryHit = {
  id: string;
  name: string;
  name_kr: string | null;
  country: WhiskyCountry;
  region: string | null;
};

type BottlingHit = {
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

type UserHit = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number;
};

type Results = {
  distilleries: DistilleryHit[];
  bottlings: BottlingHit[];
  users: UserHit[];
};

const EMPTY: Results = { distilleries: [], bottlings: [], users: [] };

export function SearchBar() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 250ms debounce → /api/search
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults(EMPTY);
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
        const data = (await res.json()) as Results;
        setResults(data);
        setActiveIdx(-1);
      } catch (err) {
        if ((err as Error).name !== "AbortError") console.error(err);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  // 외부 클릭으로 닫기
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const items: (
    | ({ kind: "distillery" } & DistilleryHit)
    | ({ kind: "bottling" } & BottlingHit)
    | ({ kind: "user" } & UserHit)
  )[] = [
    ...results.distilleries.map((d) => ({ kind: "distillery" as const, ...d })),
    ...results.bottlings.map((b) => ({ kind: "bottling" as const, ...b })),
    ...results.users.map((u) => ({ kind: "user" as const, ...u })),
  ];

  const navigate = (href: string) => {
    setOpen(false);
    setQ("");
    setResults(EMPTY);
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[activeIdx];
      if (it) {
        const href =
          it.kind === "distillery"
            ? `/distilleries/${it.id}`
            : it.kind === "user"
              ? `/profile/${it.username}`
              : `/whiskies/${it.id}`;
        navigate(href);
      } else if (q.trim()) {
        navigate(`/whiskies?q=${encodeURIComponent(q.trim())}`);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showDropdown = open && (q.trim().length > 0 || loading);

  return (
    <div ref={wrapRef} className="relative w-full max-w-sm">
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="위스키·증류소·유저 검색"
        autoComplete="off"
        className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm placeholder:text-neutral-600 focus:border-amber-400 focus:outline-none"
      />

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-md border border-neutral-800 bg-neutral-900 shadow-xl shadow-black/40">
          {loading && items.length === 0 && (
            <div className="px-4 py-3 text-xs text-neutral-500">검색 중…</div>
          )}

          {!loading && items.length === 0 && q.trim() && (
            <div className="px-4 py-3 text-xs text-neutral-500">
              &ldquo;{q}&rdquo;에 대한 결과가 없어요.
            </div>
          )}

          {results.distilleries.length > 0 && (
            <Section title="증류소">
              {results.distilleries.map((d, i) => (
                <Row
                  key={d.id}
                  active={activeIdx === i}
                  href={`/distilleries/${d.id}`}
                  onClick={() => navigate(`/distilleries/${d.id}`)}
                  onMouseEnter={() => setActiveIdx(i)}
                  title={d.name_kr ?? d.name}
                  meta={
                    <>
                      {COUNTRY_FLAG[d.country]} {d.region ?? ""}
                      {d.name_kr && d.name_kr !== d.name && ` · ${d.name}`}
                    </>
                  }
                />
              ))}
            </Section>
          )}

          {results.bottlings.length > 0 && (
            <Section title="위스키">
              {results.bottlings.map((b, i) => {
                const idx = results.distilleries.length + i;
                return (
                  <Row
                    key={b.id}
                    active={activeIdx === idx}
                    href={`/whiskies/${b.id}`}
                    onClick={() => navigate(`/whiskies/${b.id}`)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    title={b.name_kr ?? b.name}
                    meta={
                      <>
                        {COUNTRY_FLAG[b.country]} {b.distillery_name_kr ?? b.distillery_name} ·{" "}
                        {formatAge(b.age_years)} · {formatAbv(b.abv)}
                      </>
                    }
                    right={
                      b.avg_score !== null ? (
                        <span className="text-xs text-amber-300">
                          {b.avg_score}
                          <span className="ml-0.5 text-[10px] text-neutral-500">
                            ({b.tasting_count})
                          </span>
                        </span>
                      ) : null
                    }
                  />
                );
              })}
            </Section>
          )}

          {results.users.length > 0 && (
            <Section title="유저">
              {results.users.map((u, i) => {
                const idx = results.distilleries.length + results.bottlings.length + i;
                const name = u.display_name ?? u.username;
                const href = `/profile/${u.username}`;
                return (
                  <Link
                    key={u.id}
                    href={href}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(href);
                    }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={
                      "flex items-center gap-3 px-4 py-2 text-sm " +
                      (activeIdx === idx
                        ? "bg-amber-400/10 text-amber-100"
                        : "text-neutral-200 hover:bg-neutral-800/60")
                    }
                  >
                    <Avatar name={name} avatarUrl={u.avatar_url} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{name}</div>
                      <div className="mt-0.5 truncate text-xs text-neutral-500">
                        @{u.username} · 팔로워 {u.follower_count.toLocaleString()}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </Section>
          )}

          {q.trim() && (
            <Link
              href={`/whiskies?q=${encodeURIComponent(q.trim())}`}
              onClick={() => navigate(`/whiskies?q=${encodeURIComponent(q.trim())}`)}
              className="block border-t border-neutral-800 px-4 py-2.5 text-xs text-neutral-400 hover:bg-neutral-800/60 hover:text-amber-300"
            >
              모든 결과 보기 →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-4 py-1.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({
  href, active, title, meta, right, onClick, onMouseEnter,
}: {
  href: string;
  active: boolean;
  title: string;
  meta: React.ReactNode;
  right?: React.ReactNode;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => { e.preventDefault(); onClick(); }}
      onMouseEnter={onMouseEnter}
      className={
        "flex items-center justify-between gap-3 px-4 py-2 text-sm " +
        (active ? "bg-amber-400/10 text-amber-100" : "text-neutral-200 hover:bg-neutral-800/60")
      }
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        <div className="mt-0.5 truncate text-xs text-neutral-500">{meta}</div>
      </div>
      {right}
    </Link>
  );
}
