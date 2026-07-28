"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCommunityPost,
  updateCommunityPost,
  type CommunityCategory,
} from "@/lib/community/actions";

export type CommunityFormInitial = {
  id: string;
  category: CommunityCategory;
  title: string;
  body: string;
};

const CATEGORIES: Array<{ v: CommunityCategory; label: string }> = [
  { v: "question", label: "질문" },
  { v: "recommendation", label: "추천" },
  { v: "tip", label: "팁" },
  { v: "free", label: "잡담" },
];

export function CommunityPostForm({ initial }: { initial: CommunityFormInitial | null }) {
  const router = useRouter();
  const isEdit = !!initial;
  const [category, setCategory] = useState<CommunityCategory>(initial?.category ?? "free");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const t = title.trim();
    const b = body.trim();
    if (t.length < 1) return setError("제목을 입력해주세요.");
    if (t.length > 200) return setError("제목은 200자 이내.");
    if (b.length < 1) return setError("본문을 입력해주세요.");
    if (b.length > 10000) return setError("본문은 10000자 이내.");
    setError(null);

    const fd = new FormData();
    fd.set("category", category);
    fd.set("title", t);
    fd.set("body", b);
    if (isEdit && initial) fd.set("post_id", initial.id);

    startTransition(async () => {
      const res = isEdit ? await updateCommunityPost(fd) : await createCommunityPost(fd);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      // 성공 시 서버 액션이 redirect — 여기 도달하지 않음
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label>카테고리</Label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const active = category === c.v;
            return (
              <button
                key={c.v}
                type="button"
                onClick={() => setCategory(c.v)}
                className={
                  "rounded-full border px-3 py-1.5 text-xs transition-colors " +
                  (active
                    ? "border-amber-400 bg-amber-400/10 text-amber-300 font-medium"
                    : "border-border bg-card/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground")
                }
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>제목 *</Label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="예: 5만원대 입문 위스키 추천 부탁드립니다"
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>본문 *</Label>
          <span className="text-xs text-muted-foreground/70 tabular-nums">
            {body.length}/10000
          </span>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={10000}
          rows={12}
          placeholder="자유롭게 작성해주세요"
          className="w-full resize-y rounded-md border border-border bg-card px-3 py-2 text-sm leading-relaxed focus:border-amber-400 focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || !title.trim() || !body.trim()}
          className="rounded-md bg-amber-400 px-4 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-amber-300 disabled:opacity-50"
        >
          {pending ? "저장 중…" : isEdit ? "수정 저장" : "게시"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          취소
        </button>
      </div>
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </label>
  );
}
