"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleTastingLike } from "@/lib/social/actions";

type Props = {
  tastingId: string;
  initialLiked: boolean;
  initialCount: number;
  /** 비로그인 사용자가 클릭하면 보낼 곳 (보통 /login?next=현재경로) */
  loginHref?: string;
  /** null이면 비로그인 상태 */
  currentUserId: string | null;
  /** 시각적 크기. sm: 카드 풋터 인라인. lg: 인스타식 피드 액션바 */
  size?: "sm" | "lg";
};

export function LikeButton({
  tastingId, initialLiked, initialCount, loginHref, currentUserId, size = "sm",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (!currentUserId) {
      router.push(loginHref ?? "/login");
      return;
    }
    if (pending) return;

    // optimistic
    const prev = { liked, count };
    setLiked(!liked);
    setCount(liked ? Math.max(0, count - 1) : count + 1);

    startTransition(async () => {
      const fd = new FormData();
      fd.set("tasting_id", tastingId);
      const res = await toggleTastingLike(fd);
      if (res?.error) {
        // rollback
        setLiked(prev.liked);
        setCount(prev.count);
      }
    });
  }

  const isLg = size === "lg";
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={liked}
      className={
        "inline-flex items-center transition " +
        (isLg ? "gap-1.5 text-sm " : "gap-1 rounded px-1.5 py-0.5 text-xs ") +
        (liked
          ? "text-amber-300 hover:text-amber-200"
          : isLg
            ? "text-foreground/80 hover:text-amber-300"
            : "text-neutral-500 hover:text-amber-300")
      }
    >
      <span aria-hidden className={isLg ? "text-[28px] leading-none" : "text-base leading-none"}>
        {liked ? "♥" : "♡"}
      </span>
      <span className={isLg ? "tabular-nums" : "tabular-nums"}>{count}</span>
    </button>
  );
}
