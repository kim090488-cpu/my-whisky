"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { togglePostLike, addPostComment, deletePostComment } from "@/lib/social/actions";

export function PostLikeButton({
  postId, initialLiked, initialCount, currentUserId, loginHref,
}: {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  currentUserId: string | null;
  loginHref?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  function handleClick() {
    if (!currentUserId) {
      router.push(loginHref ?? "/login");
      return;
    }
    if (pending) return;
    const prev = { liked, count };
    setLiked(!liked);
    setCount(liked ? Math.max(0, count - 1) : count + 1);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("post_id", postId);
      const res = await togglePostLike(fd);
      if (res?.error) {
        setLiked(prev.liked);
        setCount(prev.count);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={liked}
      className={
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition " +
        (liked ? "text-amber-300" : "text-neutral-500 hover:text-amber-300")
      }
    >
      <span aria-hidden className="text-lg leading-none">{liked ? "♥" : "♡"}</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

export function PostCommentForm({
  postId, currentUserId, loginHref,
}: {
  postId: string;
  currentUserId: string | null;
  loginHref?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!currentUserId) {
    return (
      <p className="text-xs text-neutral-500">
        <Link href={loginHref ?? "/login"} className="text-amber-300 hover:underline">
          로그인
        </Link>{" "}
        후 댓글을 작성할 수 있어요.
      </p>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || pending) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("post_id", postId);
      fd.set("body", text);
      const res = await addPostComment(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="댓글…"
          className="flex-1 resize-none rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="self-end rounded-md bg-amber-400 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-amber-300 disabled:opacity-50"
        >
          {pending ? "…" : "등록"}
        </button>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </form>
  );
}

export function DeleteCommentButton({
  commentId, postId,
}: {
  commentId: string;
  postId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("이 댓글을 삭제할까요?")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("comment_id", commentId);
      fd.set("post_id", postId);
      const res = await deletePostComment(fd);
      if (res?.error) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-[10px] text-neutral-600 hover:text-red-400"
    >
      삭제
    </button>
  );
}
