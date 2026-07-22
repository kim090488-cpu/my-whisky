"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ThumbsUp } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { toggleBottlingEditLike } from "@/lib/bottling-edits/actions";

export type EditRow = {
  id: string;
  edited_at: string;
  editor: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  like_count: number;
  liked: boolean;
};

const FIELD_LABEL: Record<string, string> = {
  distillery_id: "증류소",
  name: "영문 이름",
  name_kr: "한글 이름",
  age_years: "숙성",
  abv: "ABV",
  vintage_year: "빈티지",
  bottling_year: "병입 연도",
  cask_type: "캐스크",
  bottler: "병입자",
  bottler_name: "병입자 이름",
  bottle_size_ml: "병 용량",
  total_bottles: "총 병수",
  notes: "추가 노트",
};

const TRACKED = Object.keys(FIELD_LABEL);
const STRONG_SIGNAL = 3;

function formatVal(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "string") return v.length > 80 ? v.slice(0, 80) + "…" : v;
  return String(v);
}

export function EditCard({
  edit,
  bottlingId,
  loginHref,
  isLoggedIn,
}: {
  edit: EditRow;
  bottlingId: string;
  loginHref: string;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    { liked: edit.liked, count: edit.like_count },
    (state, action: "toggle") => {
      void action;
      return state.liked
        ? { liked: false, count: Math.max(0, state.count - 1) }
        : { liked: true, count: state.count + 1 };
    },
  );

  const name = edit.editor?.display_name ?? edit.editor?.username ?? "익명";
  const time = edit.edited_at.replace("T", " ").slice(0, 16);
  const strong = optimistic.count >= STRONG_SIGNAL;

  const changes = TRACKED.filter((f) => {
    const a = edit.before[f] ?? null;
    const b = edit.after[f] ?? null;
    return JSON.stringify(a) !== JSON.stringify(b);
  });

  function handleLike(e: React.MouseEvent) {
    e.stopPropagation();
    if (!isLoggedIn) {
      router.push(loginHref);
      return;
    }
    startTransition(async () => {
      setOptimistic("toggle");
      await toggleBottlingEditLike(edit.id, bottlingId);
    });
  }

  return (
    <li
      className={`overflow-hidden rounded-lg border transition-colors ${
        strong
          ? "border-amber-700/50 bg-amber-400/[0.04] hover:bg-amber-400/[0.08]"
          : "border-border bg-card/40 hover:bg-card"
      }`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Avatar name={name} avatarUrl={edit.editor?.avatar_url ?? null} size={26} />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 text-sm">
              {edit.editor?.username ? (
                <Link
                  href={`/profile/${edit.editor.username}`}
                  onClick={(e) => e.stopPropagation()}
                  className="truncate font-medium hover:text-primary"
                >
                  {name}
                </Link>
              ) : (
                <span className="truncate font-medium">{name}</span>
              )}
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {time}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {changes.length === 0 ? (
                <span className="text-[10px] text-muted-foreground/60">변경 없음</span>
              ) : (
                changes.slice(0, 4).map((f) => (
                  <span
                    key={f}
                    className="rounded-full bg-secondary/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {FIELD_LABEL[f] ?? f}
                  </span>
                ))
              )}
              {changes.length > 4 && (
                <span className="text-[10px] text-muted-foreground/60">+{changes.length - 4}</span>
              )}
            </div>
          </div>
          {changes.length > 0 && (
            <ChevronDown
              className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          )}
        </button>

        <button
          type="button"
          onClick={handleLike}
          disabled={pending}
          aria-label={optimistic.liked ? "추천 취소" : "추천"}
          className={`flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
            optimistic.liked
              ? "border-amber-600/60 bg-amber-400/15 text-amber-300"
              : "border-border text-muted-foreground hover:border-amber-700/40 hover:text-amber-300"
          }`}
        >
          <ThumbsUp className={`size-3.5 ${optimistic.liked ? "fill-current" : ""}`} />
          <span className="tabular-nums">추천 {optimistic.count}</span>
        </button>
      </div>

      {open && changes.length > 0 && (
        <div className="border-t border-border/60 bg-background/30 px-3 py-2.5">
          <ul className="space-y-1.5 text-xs">
            {changes.map((f) => (
              <li key={f} className="grid grid-cols-[5.5rem_1fr] items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {FIELD_LABEL[f] ?? f}
                </span>
                <span className="flex flex-wrap items-baseline gap-1.5">
                  <span className="line-through text-muted-foreground/60">
                    {formatVal(edit.before[f])}
                  </span>
                  <span className="text-muted-foreground/40">→</span>
                  <span className="text-foreground">
                    {formatVal(edit.after[f])}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
