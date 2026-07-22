"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { addTastingComment, deleteTastingComment } from "@/lib/social/actions";
import { ReportButton } from "@/components/social/report-button";

type Comment = {
  id: string;
  body: string;
  parent_id: string | null;
  user_id: string;
  created_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type Props = {
  tastingId: string;
  initialCount: number;
  currentUserId: string | null;
  loginHref?: string;
  defaultOpen?: boolean;
};

export function CommentsThread({
  tastingId, initialCount, currentUserId, loginHref, defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [comments, setComments] = useState<Comment[]>([]);
  const [count, setCount] = useState(initialCount);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/comments?tasting_id=${tastingId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { comments: Comment[] };
      setComments(data.comments);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  function toggleOpen() {
    if (!open && !loaded) load();
    setOpen(!open);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const text = body.trim();
    if (!text || pending) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("tasting_id", tastingId);
      fd.set("body", text);
      if (replyTo) fd.set("parent_id", replyTo.id);
      const res = await addTastingComment(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setBody("");
      setReplyTo(null);
      await load();
      setCount((c) => c + 1);
    });
  }

  function handleDelete(commentId: string) {
    if (!confirm("이 댓글을 삭제할까요?")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("comment_id", commentId);
      const res = await deleteTastingComment(fd);
      if (res?.error) {
        alert(res.error);
        return;
      }
      await load();
      // 카운트는 다음 줄에서 리스트 길이로 동기화 (답글 cascade delete 케이스 커버)
      setCount((prev) => Math.max(0, prev - 1));
    });
  }

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesOf = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={toggleOpen}
        className={
          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition " +
          (open ? "text-amber-300" : "text-neutral-500 hover:text-amber-300")
        }
      >
        <span aria-hidden>💬</span>
        <span className="tabular-nums">{count}</span>
        <span className="text-[10px]">{open ? "접기" : "댓글"}</span>
      </button>

      {open && (
        <div className="mt-3 rounded-md border border-neutral-900 bg-neutral-950 p-3">
          {currentUserId ? (
            <form onSubmit={handleSubmit} className="mb-3">
              {replyTo && (
                <div className="mb-1.5 flex items-center justify-between rounded bg-amber-400/10 px-2 py-1 text-xs text-amber-200">
                  <span>
                    {replyTo.profile?.display_name ?? replyTo.profile?.username ?? "사용자"} 님께 답글
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="rounded px-1 text-amber-300 hover:bg-amber-400/20"
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder={replyTo ? "답글 작성…" : "댓글 작성…"}
                  className="flex-1 resize-none rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={pending || !body.trim()}
                  className="self-end rounded-md bg-amber-400 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-amber-300 disabled:opacity-50"
                >
                  {pending ? "…" : "등록"}
                </button>
              </div>
              {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
            </form>
          ) : (
            <p className="mb-3 text-xs text-neutral-500">
              <Link href={loginHref ?? "/login"} className="text-amber-300 hover:underline">
                로그인
              </Link>{" "}
              후 댓글을 작성할 수 있어요.
            </p>
          )}

          {loading && comments.length === 0 ? (
            <div className="text-xs text-neutral-600">불러오는 중…</div>
          ) : topLevel.length === 0 ? (
            <div className="text-xs text-neutral-600">첫 댓글을 남겨보세요.</div>
          ) : (
            <ul className="space-y-3">
              {topLevel.map((c) => (
                <li key={c.id}>
                  <CommentItem
                    c={c}
                    isOwn={c.user_id === currentUserId}
                    onDelete={() => handleDelete(c.id)}
                    onReply={() => setReplyTo(c)}
                    canReply={!!currentUserId}
                    currentUserId={currentUserId}
                  />
                  {repliesOf(c.id).length > 0 && (
                    <ul className="mt-2 space-y-2 border-l-2 border-neutral-800 pl-3 sm:ml-6">
                      {repliesOf(c.id).map((r) => (
                        <li key={r.id}>
                          <CommentItem
                            c={r}
                            isOwn={r.user_id === currentUserId}
                            onDelete={() => handleDelete(r.id)}
                            canReply={false}
                            currentUserId={currentUserId}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function CommentItem({
  c, isOwn, onDelete, onReply, canReply, currentUserId,
}: {
  c: Comment;
  isOwn: boolean;
  onDelete: () => void;
  onReply?: () => void;
  canReply: boolean;
  currentUserId: string | null;
}) {
  const name = c.profile?.display_name ?? c.profile?.username ?? "익명";
  return (
    <div className="flex gap-2">
      <Avatar name={name} avatarUrl={c.profile?.avatar_url} size={28} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-xs">
          {c.profile?.username ? (
            <Link href={`/profile/${c.profile.username}`} className="font-medium hover:text-amber-300">
              {name}
            </Link>
          ) : (
            <span className="font-medium">{name}</span>
          )}
          <span className="text-[10px] text-neutral-600">{formatTime(c.created_at)}</span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-neutral-200">{c.body}</p>
        <div className="mt-1 flex gap-2 text-[10px] text-neutral-600">
          {canReply && onReply && (
            <button onClick={onReply} className="hover:text-amber-300">답글</button>
          )}
          {isOwn && (
            <button onClick={onDelete} className="hover:text-red-400">삭제</button>
          )}
          <ReportButton
            targetTable="comment"
            targetId={c.id}
            ownerId={c.user_id}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  return d.toISOString().slice(0, 10);
}
