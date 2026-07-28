import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { CommunityCategory } from "@/lib/community/actions";
import {
  CommunityLikeButton,
  CommunityCommentForm,
  DeleteCommunityCommentButton,
  DeleteCommunityPostButton,
} from "./_interactions";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CATEGORY_META: Record<CommunityCategory, { label: string; badgeClass: string }> = {
  question: { label: "질문", badgeClass: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  recommendation: { label: "추천", badgeClass: "bg-amber-400/15 text-amber-200 border-amber-400/30" },
  tip: { label: "팁", badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  free: { label: "잡담", badgeClass: "bg-neutral-500/15 text-neutral-300 border-neutral-500/30" },
};

function isEdited(created: string, updated: string) {
  return new Date(updated).getTime() - new Date(created).getTime() > 5_000;
}

type PostRow = {
  id: string;
  user_id: string;
  category: CommunityCategory;
  title: string;
  body: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
};
type Author = { id: string; username: string; display_name: string | null };
type CommentRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return { title: "게시글 · my-whisky" };
  const supabase = await createClient();
  const { data } = await supabase
    .from("community_posts")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  const title = (data as unknown as { title: string } | null)?.title;
  return { title: title ? `${title} · 커뮤니티 · my-whisky` : "커뮤니티 · my-whisky" };
}

export default async function CommunityPostDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: pRaw } = await supabase
    .from("community_posts")
    .select("id, user_id, category, title, body, like_count, comment_count, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  const post = pRaw as unknown as PostRow | null;
  if (!post) notFound();

  const [authorRes, commentsRes, likedRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("id", post.user_id)
      .maybeSingle(),
    supabase
      .from("community_post_comments")
      .select("id, user_id, body, created_at, updated_at")
      .eq("post_id", id)
      .order("created_at", { ascending: true }),
    user
      ? supabase
          .from("community_post_likes")
          .select("id")
          .eq("user_id", user.id)
          .eq("post_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const author = (authorRes.data as unknown as Author | null) ?? null;
  const comments = ((commentsRes.data ?? []) as unknown as CommentRow[]);
  const liked = !!(likedRes.data as unknown as { id: string } | null);

  const commentUserIds = Array.from(new Set(comments.map((c) => c.user_id)));
  const commentAuthorById = new Map<string, Author>();
  if (commentUserIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", commentUserIds);
    for (const a of (data ?? []) as Author[]) commentAuthorById.set(a.id, a);
  }

  const authorName = author?.display_name ?? author?.username ?? "익명";
  const isOwn = !!user && post.user_id === user.id;
  const meta = CATEGORY_META[post.category];
  const loginHref = `/login?next=/community/${post.id}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <Link
        href="/community"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        커뮤니티
      </Link>

      <article className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              "rounded-md border px-2 py-0.5 text-[11px] font-semibold " + meta.badgeClass
            }
          >
            {meta.label}
          </span>
          {isOwn && (
            <div className="ml-auto flex items-center gap-3 text-xs">
              <Link
                href={`/community/new?edit=${post.id}`}
                className="text-muted-foreground hover:text-foreground"
              >
                수정
              </Link>
              <DeleteCommunityPostButton postId={post.id} />
            </div>
          )}
        </div>

        <h1 className="mt-3 font-serif text-3xl leading-tight tracking-tight">{post.title}</h1>

        <div className="mt-2 flex flex-wrap items-baseline gap-1.5 text-xs text-muted-foreground">
          {author?.username ? (
            <Link href={`/profile/${author.username}`} className="font-medium text-amber-300 hover:underline">
              {authorName}
            </Link>
          ) : (
            <span className="font-medium">{authorName}</span>
          )}
          <span>·</span>
          <span>{post.created_at.slice(0, 10)}</span>
          {isEdited(post.created_at, post.updated_at) && (
            <span className="italic text-muted-foreground/70">수정됨</span>
          )}
        </div>

        <div className="mt-6 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/95">
          {post.body}
        </div>

        <div className="mt-6 flex items-center gap-4 border-y border-border py-3 text-sm">
          <CommunityLikeButton
            postId={post.id}
            initialLiked={liked}
            initialCount={post.like_count}
            currentUserId={user?.id ?? null}
            loginHref={loginHref}
          />
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <MessageCircle className="size-4" />
            <span className="tabular-nums">{post.comment_count}</span>
          </span>
        </div>
      </article>

      <section className="mt-8">
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          댓글 {post.comment_count}
        </h2>

        <CommunityCommentForm postId={post.id} currentUserId={user?.id ?? null} loginHref={loginHref} />

        {comments.length === 0 ? (
          <p className="mt-4 text-center text-xs text-muted-foreground/70 py-6">
            첫 댓글을 남겨보세요.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {comments.map((c) => {
              const a = commentAuthorById.get(c.user_id);
              const name = a?.display_name ?? a?.username ?? "익명";
              const canDelete = user?.id === c.user_id;
              return (
                <li
                  key={c.id}
                  className="rounded-lg border border-border bg-card/40 p-3"
                >
                  <div className="flex items-center gap-2 text-xs">
                    {a?.username ? (
                      <Link
                        href={`/profile/${a.username}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">{name}</span>
                    )}
                    <span className="text-muted-foreground/70">{c.created_at.slice(0, 10)}</span>
                    {isEdited(c.created_at, c.updated_at) && (
                      <span className="italic text-muted-foreground/70">수정됨</span>
                    )}
                    {canDelete && (
                      <span className="ml-auto">
                        <DeleteCommunityCommentButton commentId={c.id} postId={post.id} />
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground/90">{c.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
