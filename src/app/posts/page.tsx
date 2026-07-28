import Link from "next/link";
import { MapPin, Lock, Users, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import { postPhotoSignedUrls } from "@/lib/uploads/storage";
import { COUNTRY_FLAG } from "@/lib/format";
import { PostLikeButton } from "@/app/posts/[id]/_post-interactions";
import { Pagination } from "@/components/pagination";
import { loadBlockedUserIds } from "@/lib/social/blocks";
import type { WhiskyCountry } from "@/types/database";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "모먼트 · my-whisky",
  description: "위스키와 함께한 순간들 — 사진과 짧은 글로 남긴 모먼트 피드.",
};

const PAGE_SIZE = 12;

type SearchParams = Promise<{ page?: string }>;

export default async function PostsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const blockedIds = await loadBlockedUserIds(supabase, user?.id ?? null);

  let postsQuery = supabase
    .from("posts")
    .select(
      "id, user_id, body, photos, visibility, bottling_id, location_name, like_count, comment_count, created_at",
      { count: "exact" },
    )
    .eq("visibility", "public");
  if (blockedIds.size > 0) {
    postsQuery = postsQuery.not("user_id", "in", `(${Array.from(blockedIds).join(",")})`);
  }
  const { data: postsRaw, count } = await postsQuery
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const posts = postsRaw ?? [];
  const userIds = Array.from(new Set(posts.map((p) => p.user_id)));
  const bottlingIds = Array.from(
    new Set(posts.map((p) => p.bottling_id).filter((v): v is string => !!v)),
  );

  const profilesById = new Map<
    string,
    { username: string; display_name: string | null; avatar_url: string | null }
  >();
  if (userIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", userIds);
    for (const p of data ?? []) {
      profilesById.set(p.id, {
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
      });
    }
  }

  const bottlingsById = new Map<
    string,
    {
      id: string;
      name: string;
      name_kr: string | null;
      distillery_name: string;
      distillery_name_kr: string | null;
      country: WhiskyCountry;
    }
  >();
  if (bottlingIds.length > 0) {
    const { data } = await supabase
      .from("bottling_card_stats")
      .select("id, name, name_kr, distillery_name, distillery_name_kr, country")
      .in("id", bottlingIds);
    for (const b of data ?? []) bottlingsById.set(b.id!, b as never);
  }

  const myLikedIds = new Set<string>();
  if (user && posts.length > 0) {
    const { data } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", user.id)
      .in("post_id", posts.map((p) => p.id));
    for (const l of data ?? []) myLikedIds.add(l.post_id);
  }

  // post-photos private 버킷 — 각 리스트 아이템 hero 사진들 signed URL 일괄 발급
  const allPhotoPaths: string[] = [];
  for (const p of posts) for (const path of p.photos.slice(0, 6)) allPhotoPaths.push(path);
  const signedUrls = await postPhotoSignedUrls(supabase, allPhotoPaths);
  const signedUrlByPath = new Map<string, string>();
  for (let i = 0; i < allPhotoPaths.length; i++) {
    const url = signedUrls[i];
    if (url) signedUrlByPath.set(allPhotoPaths[i], url);
  }

  const total = count ?? 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">모먼트</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            마신 순간, 받은 선물, 바 방문 — {total.toLocaleString()}개
          </p>
        </div>
        {user && (
          <Link
            href="/posts/new"
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-medium text-neutral-950 transition-colors hover:bg-amber-300"
          >
            <Plus className="size-3.5" />
            모먼트
          </Link>
        )}
      </header>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/40 p-12 text-center text-sm text-muted-foreground">
          아직 공개된 모먼트가 없어요.
        </div>
      ) : (
        <ul className="space-y-5">
          {posts.map((p) => {
            const prof = profilesById.get(p.user_id);
            const authorName = prof?.display_name ?? prof?.username ?? "익명";
            const bottling = p.bottling_id ? bottlingsById.get(p.bottling_id) ?? null : null;
            const liked = myLikedIds.has(p.id);
            return (
              <li
                key={p.id}
                className="overflow-hidden rounded-xl border border-border bg-card/50 transition-colors hover:bg-card"
              >
                <div className="flex items-center gap-3 px-5 pt-4">
                  <Avatar name={authorName} avatarUrl={prof?.avatar_url ?? null} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 text-xs">
                      {prof?.username ? (
                        <Link
                          href={`/profile/${prof.username}`}
                          className="font-medium hover:text-primary"
                        >
                          {authorName}
                        </Link>
                      ) : (
                        <span className="font-medium">{authorName}</span>
                      )}
                      <Link
                        href={`/posts/${p.id}`}
                        className="tabular-nums text-muted-foreground hover:text-foreground"
                      >
                        {p.created_at.slice(0, 10)}
                      </Link>
                      {p.user_id === user?.id && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                          내 모먼트
                        </span>
                      )}
                      {p.visibility !== "public" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                          {p.visibility === "private" ? (
                            <Lock className="size-2.5" />
                          ) : (
                            <Users className="size-2.5" />
                          )}
                          {p.visibility === "private" ? "비공개" : "팔로워만"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {p.photos.length > 0 && (
                  <Link
                    href={`/posts/${p.id}`}
                    className={
                      p.photos.length === 1
                        ? "mt-3 block"
                        : "mt-3 grid grid-cols-2 gap-0.5 sm:grid-cols-3"
                    }
                  >
                    {p.photos.slice(0, 6).map((path) => {
                      const url = signedUrlByPath.get(path) ?? null;
                      return url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={path}
                          src={url}
                          alt=""
                          className={
                            p.photos.length === 1
                              ? "max-h-[28rem] w-full object-cover"
                              : "aspect-square w-full object-cover"
                          }
                        />
                      ) : null;
                    })}
                  </Link>
                )}

                <div className="space-y-3 px-5 py-4">
                  {p.body && (
                    <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {p.body}
                    </p>
                  )}

                  {(bottling || p.location_name) && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {bottling && (
                        <Link
                          href={`/whiskies/${bottling.id}`}
                          className="inline-flex items-center gap-1 rounded-full border border-amber-700/40 bg-amber-400/5 px-3 py-1 text-amber-200 hover:bg-amber-400/15"
                        >
                          <span aria-hidden>🥃</span>
                          {COUNTRY_FLAG[bottling.country]}{" "}
                          {bottling.distillery_name_kr ?? bottling.distillery_name} ·{" "}
                          {bottling.name_kr ?? bottling.name}
                        </Link>
                      )}
                      {p.location_name && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 px-3 py-1 text-muted-foreground">
                          <MapPin className="size-3" />
                          {p.location_name}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 border-t border-border pt-2 text-xs">
                    <Link
                      href={`/posts/${p.id}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      💬 {p.comment_count}
                    </Link>
                    <PostLikeButton
                      postId={p.id}
                      initialLiked={liked}
                      initialCount={p.like_count}
                      currentUserId={user?.id ?? null}
                      loginHref={`/login?next=/posts`}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        basePath="/posts"
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        currentSearchParams={new URLSearchParams()}
      />
    </main>
  );
}
