import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import { COUNTRY_FLAG, formatScore } from "@/lib/format";
import { LikeButton } from "@/components/social/like-button";
import { CommentsThread } from "@/components/social/comments-thread";
import { tastingPhotoUrl } from "@/lib/uploads/storage";
import type { WhiskyCountry, TastingVisibility } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/me/feed");

  // 1. 내가 팔로우한 user_ids
  const { data: follows } = await supabase
    .from("follows")
    .select("followee_id")
    .eq("follower_id", user.id);
  const followeeIds = (follows ?? []).map((f) => f.followee_id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/me" className="text-sm text-neutral-500 hover:text-neutral-300">
        ← 내 페이지
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">피드</h1>
      <p className="mt-1 text-sm text-neutral-500">
        팔로우한 사람들의 최근 테이스팅 노트
      </p>

      {followeeIds.length === 0 ? (
        <div className="mt-10 rounded-lg border border-neutral-800 bg-neutral-900/40 p-8 text-center text-sm text-neutral-500">
          아직 팔로우하는 사람이 없어요.{" "}
          <Link href="/whiskies" className="text-amber-300 hover:underline">
            카탈로그
          </Link>
          에서 마음에 드는 노트의 작성자를 팔로우해보세요.
        </div>
      ) : (
        <FeedList userId={user.id} followeeIds={followeeIds} />
      )}
    </main>
  );
}

async function FeedList({ userId, followeeIds }: { userId: string; followeeIds: string[] }) {
  const supabase = await createClient();

  // RLS가 자동으로 followers 노트도 노출 (내가 팔로우한 사용자라면)
  const { data: tastingsRaw } = await supabase
    .from("tastings")
    .select(
      "id, tasted_at, score, notes, photos, visibility, user_id, bottling_id, like_count, comment_count",
    )
    .in("user_id", followeeIds)
    .order("tasted_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (!tastingsRaw || tastingsRaw.length === 0) {
    return (
      <div className="mt-10 rounded-lg border border-neutral-800 bg-neutral-900/40 p-8 text-center text-sm text-neutral-500">
        팔로우한 사용자들이 아직 노트를 작성하지 않았어요.
      </div>
    );
  }

  // profiles
  const userIds = Array.from(new Set(tastingsRaw.map((t) => t.user_id)));
  const profilesById = new Map<
    string,
    { id: string; username: string; display_name: string | null; avatar_url: string | null }
  >();
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", userIds);
  for (const p of profs ?? []) profilesById.set(p.id, p);

  // bottlings
  const bottlingIds = Array.from(new Set(tastingsRaw.map((t) => t.bottling_id)));
  const bottlingsById = new Map<
    string,
    { id: string; name: string; name_kr: string | null; distillery_name: string; distillery_name_kr: string | null; country: WhiskyCountry }
  >();
  const { data: bs } = await supabase
    .from("bottling_card_stats")
    .select("id, name, name_kr, distillery_name, distillery_name_kr, country")
    .in("id", bottlingIds);
  for (const b of bs ?? []) bottlingsById.set(b.id, b);

  // 내가 좋아요한 노트
  const { data: myLikes } = await supabase
    .from("tasting_likes")
    .select("tasting_id")
    .eq("user_id", userId)
    .in("tasting_id", tastingsRaw.map((t) => t.id));
  const myLikedIds = new Set((myLikes ?? []).map((l) => l.tasting_id));

  return (
    <ul className="mt-8 space-y-4">
      {tastingsRaw.map((t) => {
        const p = profilesById.get(t.user_id);
        const b = bottlingsById.get(t.bottling_id);
        const name = p?.display_name ?? p?.username ?? "익명";
        return (
          <li key={t.id} className="rounded-lg border border-neutral-900 bg-neutral-950 p-4">
            <div className="flex items-start gap-3">
              <Avatar name={name} avatarUrl={p?.avatar_url} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 text-xs">
                  {p?.username ? (
                    <Link href={`/profile/${p.username}`} className="font-medium hover:text-amber-300">
                      {name}
                    </Link>
                  ) : (
                    <span className="font-medium">{name}</span>
                  )}
                  <Link href={`/tastings/${t.id}`} className="text-neutral-600 hover:text-amber-300">
                    {t.tasted_at}
                  </Link>
                  {t.visibility === ("followers" as TastingVisibility) && (
                    <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
                      팔로워만
                    </span>
                  )}
                </div>
                {b && (
                  <Link
                    href={`/whiskies/${b.id}`}
                    className="mt-1 block text-sm text-neutral-300 hover:text-amber-300"
                  >
                    {COUNTRY_FLAG[b.country]} {b.distillery_name_kr ?? b.distillery_name} ·{" "}
                    <span className="font-medium">{b.name_kr ?? b.name}</span>
                    {b.name_kr && b.name_kr !== b.name && (
                      <span className="ml-1 text-[10px] text-neutral-500">{b.name}</span>
                    )}
                  </Link>
                )}
                {t.score !== null && (
                  <div className="mt-1 text-xs text-amber-300">{formatScore(t.score)}</div>
                )}
                {t.notes && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-200">{t.notes}</p>
                )}
                {t.photos && t.photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {t.photos.map((path) => {
                      const url = tastingPhotoUrl(path);
                      return url ? (
                        <a
                          key={path}
                          href={url}
                          target="_blank"
                          rel="noopener"
                          className="h-20 w-20 overflow-hidden rounded border border-neutral-800"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </a>
                      ) : null;
                    })}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-end gap-3 border-t border-neutral-900 pt-2">
                  <CommentsThread
                    tastingId={t.id}
                    initialCount={t.comment_count}
                    currentUserId={userId}
                  />
                  <LikeButton
                    tastingId={t.id}
                    initialLiked={myLikedIds.has(t.id)}
                    initialCount={t.like_count}
                    currentUserId={userId}
                  />
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
