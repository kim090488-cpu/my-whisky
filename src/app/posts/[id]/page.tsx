import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, Lock, MapPin, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import { postPhotoUrl } from "@/lib/uploads/storage";
import { PhotoGallery } from "@/components/tastings/photo-gallery";
import { COUNTRY_FLAG } from "@/lib/format";
import { PostLikeButton, PostCommentForm, DeleteCommentButton } from "./_post-interactions";
import type { WhiskyCountry } from "@/types/database";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("posts")
    .select("body, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!p) return { title: "모먼트를 찾을 수 없어요 · my-whisky" };
  const { data: prof } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", p.user_id)
    .maybeSingle();
  const author = prof?.display_name ?? prof?.username ?? "익명";
  const desc = (p.body ?? "").slice(0, 140) || `${author}의 모먼트`;
  return {
    title: `${author}의 모먼트 · my-whisky`,
    description: desc,
    openGraph: { title: `${author}의 모먼트`, description: desc, type: "article" },
  };
}

export default async function PostDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select(
      "id, user_id, body, photos, visibility, bottling_id, location_name, like_count, comment_count, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!post) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileRes, bottlingRes, myLikeRes, commentsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", post.user_id)
      .maybeSingle(),
    post.bottling_id
      ? supabase
          .from("bottling_card_stats")
          .select("id, name, name_kr, distillery_name, distillery_name_kr, country")
          .eq("id", post.bottling_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from("post_likes")
          .select("id")
          .eq("user_id", user.id)
          .eq("post_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("post_comments")
      .select("id, body, user_id, parent_id, created_at")
      .eq("post_id", id)
      .order("created_at"),
  ]);

  const profile = profileRes.data;
  const bottling = bottlingRes.data as {
    id: string;
    name: string;
    name_kr: string | null;
    distillery_name: string;
    distillery_name_kr: string | null;
    country: WhiskyCountry;
  } | null;
  const liked = !!myLikeRes.data;
  const comments = commentsRes.data ?? [];

  const commentUserIds = Array.from(new Set(comments.map((c) => c.user_id)));
  const commentProfilesById = new Map<
    string,
    { username: string; display_name: string | null; avatar_url: string | null }
  >();
  if (commentUserIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", commentUserIds);
    for (const p of profs ?? []) {
      commentProfilesById.set(p.id, {
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
      });
    }
  }

  const authorName = profile?.display_name ?? profile?.username ?? "익명";

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        뒤로
      </Link>

      {/* author */}
      <div className="mt-6 flex items-center gap-3">
        <Avatar name={authorName} avatarUrl={profile?.avatar_url} size={44} />
        <div className="min-w-0 flex-1">
          {profile?.username ? (
            <Link href={`/profile/${profile.username}`} className="font-medium hover:text-amber-300">
              {authorName}
            </Link>
          ) : (
            <span className="font-medium">{authorName}</span>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <time>{post.created_at.slice(0, 10)}</time>
            {post.visibility !== "public" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px]">
                {post.visibility === "private" ? <Lock className="size-2.5" /> : <Users className="size-2.5" />}
                {post.visibility === "private" ? "비공개" : "팔로워만"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* photos */}
      {post.photos.length > 0 && (
        <div className="mt-5">
          <PhotoGallery
            urls={post.photos.map((p) => postPhotoUrl(p))}
            gridClassName={
              post.photos.length === 1 ? "" : "grid grid-cols-2 gap-1.5"
            }
            cellClassName="block aspect-square overflow-hidden rounded-md border border-neutral-900 transition-colors hover:border-amber-700/60"
          />
        </div>
      )}

      {/* body */}
      {post.body && (
        <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
          {post.body}
        </p>
      )}

      {/* meta tags */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        {bottling && (
          <Link
            href={`/whiskies/${bottling.id}`}
            className="inline-flex items-center gap-1 rounded-full border border-amber-700/40 bg-amber-400/5 px-3 py-1 text-amber-200 hover:bg-amber-400/15"
          >
            <span aria-hidden>🥃</span>
            {COUNTRY_FLAG[bottling.country]} {bottling.distillery_name_kr ?? bottling.distillery_name} · {bottling.name_kr ?? bottling.name}
          </Link>
        )}
        {post.location_name && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 px-3 py-1 text-muted-foreground">
            <MapPin className="size-3" />
            {post.location_name}
          </span>
        )}
      </div>

      {/* actions */}
      <div className="mt-5 flex items-center gap-1 border-y border-border py-2">
        <PostLikeButton
          postId={post.id}
          initialLiked={liked}
          initialCount={post.like_count}
          currentUserId={user?.id ?? null}
          loginHref={`/login?next=/posts/${post.id}`}
        />
        <span className="ml-2 text-sm text-muted-foreground">
          💬 <span className="tabular-nums">{post.comment_count}</span>
        </span>
      </div>

      {/* comments */}
      <section className="mt-6 space-y-4">
        <PostCommentForm
          postId={post.id}
          currentUserId={user?.id ?? null}
          loginHref={`/login?next=/posts/${post.id}`}
        />

        {comments.length === 0 ? (
          <p className="text-xs text-neutral-600">첫 댓글을 남겨보세요.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => {
              const p = commentProfilesById.get(c.user_id);
              const name = p?.display_name ?? p?.username ?? "익명";
              return (
                <li key={c.id} className="flex gap-2">
                  <Avatar name={name} avatarUrl={p?.avatar_url ?? null} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 text-xs">
                      {p?.username ? (
                        <Link href={`/profile/${p.username}`} className="font-medium hover:text-amber-300">
                          {name}
                        </Link>
                      ) : (
                        <span className="font-medium">{name}</span>
                      )}
                      <span className="text-[10px] text-neutral-600">{c.created_at.slice(0, 10)}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-neutral-200">{c.body}</p>
                    {c.user_id === user?.id && (
                      <div className="mt-1">
                        <DeleteCommentButton commentId={c.id} postId={post.id} />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
