import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/social/follow-button";
import { ReportButton } from "@/components/social/report-button";
import { BlockButton } from "@/components/social/block-button";
import { isBlockedByViewer } from "@/lib/social/blocks";
import { BadgeStrip } from "@/components/social/badge-strip";
import type { UserBadgeRow } from "@/lib/badges";
import { NotesFilterBar } from "@/components/social/notes-filter-bar";
import { TastingTile, type TastingTileData } from "@/components/social/tasting-tile";
import { postPhotoUrl } from "@/lib/uploads/storage";
import type { WhiskyCountry } from "@/types/database";
import {
  FLAVOR_COLUMN,
  FLAVOR_THRESHOLD,
  parseFlavors,
  type FlavorTag,
} from "@/lib/tastings/flavor-filters";
import { loadTasteProfileAndDashboard } from "@/lib/tastings/taste-profile";
import { TasteProfileChips } from "@/components/social/taste-profile-chips";
import { TasteDashboardCard } from "@/components/social/taste-dashboard-card";
import { loadFollowRecommendations } from "@/lib/social/follow-recommendations";
import { FollowRecommendationCard } from "@/components/social/follow-recommendation-card";
import { loadTasteTwins } from "@/lib/social/taste-twins";
import { TasteTwinsSection } from "@/components/social/taste-twins-section";

export const dynamic = "force-dynamic";

type Params = Promise<{ username: string }>;
type SearchParams = Promise<{
  notes_sort?: string;
  notes_page?: string;
  notes_min_score?: string;
  notes_buyback?: string;
  notes_flavors?: string;
}>;

const NOTES_PER_PAGE = 20;
const NOTES_SORTS = ["recent", "score", "likes"] as const;
type NotesSort = (typeof NOTES_SORTS)[number];
const NOTES_MIN_SCORES = new Set(["80", "85", "90"]);

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { username: usernameRaw } = await params;
  const sp = await searchParams;
  const notesSort: NotesSort = NOTES_SORTS.includes(sp.notes_sort as NotesSort)
    ? (sp.notes_sort as NotesSort)
    : "recent";
  const notesPage = Math.max(1, Number(sp.notes_page) || 1);
  const notesOffset = (notesPage - 1) * NOTES_PER_PAGE;
  const notesMinScore: string | null = NOTES_MIN_SCORES.has(sp.notes_min_score ?? "")
    ? (sp.notes_min_score as string)
    : null;
  const notesBuyback = sp.notes_buyback === "1";
  const notesFlavors: FlavorTag[] = parseFlavors(sp.notes_flavors);
  const username = decodeURIComponent(usernameRaw).toLowerCase();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, created_at, follower_count, following_count")
    .eq("username", username)
    .maybeSingle();
  if (!profile) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isSelf = user?.id === profile.id;

  let isFollowing = false;
  let isBlocked = false;
  if (user && !isSelf) {
    const [followRes, blockedRes] = await Promise.all([
      supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("followee_id", profile.id)
        .maybeSingle(),
      isBlockedByViewer(supabase, user.id, profile.id),
    ]);
    isFollowing = !!followRes.data;
    isBlocked = blockedRes;
  }

  let tastingsQuery = supabase
    .from("tastings")
    .select(
      "id, tasted_at, score, notes, photos, visibility, user_id, bottling_id, like_count, comment_count, would_buy_again, value_for_money, sweetness, smokiness, fruitiness, spiciness, smoothness, complexity, finish_length, tags",
      { count: "exact" },
    )
    .eq("user_id", profile.id);
  if (!isSelf) tastingsQuery = tastingsQuery.eq("visibility", "public");
  if (notesMinScore !== null) tastingsQuery = tastingsQuery.gte("score", Number(notesMinScore));
  if (notesBuyback) tastingsQuery = tastingsQuery.eq("would_buy_again", true);
  for (const f of notesFlavors) {
    tastingsQuery = tastingsQuery.gte(FLAVOR_COLUMN[f], FLAVOR_THRESHOLD);
  }
  switch (notesSort) {
    case "score":
      tastingsQuery = tastingsQuery.order("score", { ascending: false, nullsFirst: false });
      break;
    case "likes":
      tastingsQuery = tastingsQuery.order("like_count", { ascending: false });
      break;
    case "recent":
    default:
      tastingsQuery = tastingsQuery.order("tasted_at", { ascending: false });
      break;
  }
  const { data: tastingsRaw, count: noteCount } = await tastingsQuery.range(
    notesOffset,
    notesOffset + NOTES_PER_PAGE - 1,
  );

  const myLikedIds = new Set<string>();
  if (user && tastingsRaw && tastingsRaw.length > 0) {
    const { data: myLikes } = await supabase
      .from("tasting_likes")
      .select("tasting_id")
      .eq("user_id", user.id)
      .in("tasting_id", tastingsRaw.map((t) => t.id));
    for (const l of myLikes ?? []) myLikedIds.add(l.tasting_id);
  }

  const bottlingIds = Array.from(new Set((tastingsRaw ?? []).map((t) => t.bottling_id)));
  const bottlingsById = new Map<
    string,
    {
      id: string;
      name: string;
      name_kr: string | null;
      distillery_name: string;
      distillery_name_kr: string | null;
      country: WhiskyCountry;
      label_image_url: string | null;
    }
  >();
  if (bottlingIds.length > 0) {
    const { data: bs } = await supabase
      .from("bottling_card_stats")
      .select("id, name, name_kr, distillery_name, distillery_name_kr, country, label_image_url")
      .in("id", bottlingIds);
    for (const b of bs ?? []) {
      bottlingsById.set(b.id!, b as never);
    }
  }
  const tastings: TastingTileData[] = (tastingsRaw ?? []).map((t) => ({
    ...(t as unknown as TastingTileData),
    profile: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
    },
    bottling: bottlingsById.get(t.bottling_id) ?? null,
    liked: myLikedIds.has(t.id),
  }));

  // 취향 프로필+대시보드 + 팔로우 추천 병렬
  const [tasteData, recommendations] = await Promise.all([
    loadTasteProfileAndDashboard(supabase, profile.id, { publicOnly: !isSelf }),
    loadFollowRecommendations(supabase, profile.id, { viewerId: user?.id ?? null }),
  ]);
  const tasteProfile = tasteData.profile;
  const tasteDashboard = tasteData.dashboard;
  const avgScore = tasteProfile.avgScore;

  // recommendations에 이미 뜬 유저는 twins에서 제외 (dedupe)
  const recommendationIds = recommendations.map((r) => r.id);
  const tasteTwins = await loadTasteTwins(supabase, profile.id, {
    viewerId: user?.id ?? null,
    excludeIds: recommendationIds,
  });

  const notesHasFilters =
    notesMinScore !== null || notesBuyback || notesFlavors.length > 0;

  const notesHrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (notesSort !== "recent") params.set("notes_sort", notesSort);
    if (notesMinScore) params.set("notes_min_score", notesMinScore);
    if (notesBuyback) params.set("notes_buyback", "1");
    if (notesFlavors.length > 0) params.set("notes_flavors", notesFlavors.join(","));
    if (p > 1) params.set("notes_page", String(p));
    const qs = params.toString();
    return `/profile/${profile.username}${qs ? `?${qs}` : ""}#notes`;
  };
  const notesTotalPages = Math.max(1, Math.ceil((noteCount ?? 0) / NOTES_PER_PAGE));

  let collectionCount: number | null = null;
  if (isSelf) {
    const { count } = await supabase
      .from("collection_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id);
    collectionCount = count ?? 0;
  }

  const { data: badgeRows } = await supabase
    .from("user_badges")
    .select("code, earned_at")
    .eq("user_id", profile.id)
    .order("earned_at", { ascending: false });
  const badges = (badgeRows ?? []) as UserBadgeRow[];

  // 모먼트 (인스타식 포스트) — RLS가 visibility 처리
  let postsQuery = supabase
    .from("posts")
    .select("id, photos, comment_count, like_count, body, created_at", { count: "exact" })
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(18);
  if (!isSelf) postsQuery = postsQuery.eq("visibility", "public");
  const { data: postsRaw, count: postCount } = await postsQuery;
  const posts = postsRaw ?? [];

  const displayName = profile.display_name ?? profile.username;
  const joinedDate = new Date(profile.created_at).toISOString().slice(0, 7);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="flex flex-col items-start gap-5 sm:flex-row">
        <Avatar name={displayName} avatarUrl={profile.avatar_url} size={96} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl tracking-tight">{displayName}</h1>
            {isSelf ? (
              <Link
                href="/me/edit"
                className="rounded-md border border-border px-3 py-1 text-xs text-foreground/75 transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                프로필 편집
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                {!isBlocked && (
                  <FollowButton
                    followeeId={profile.id}
                    initialFollowing={isFollowing}
                    currentUserId={user?.id ?? null}
                    loginHref={`/login?next=/profile/${profile.username}`}
                  />
                )}
                <BlockButton
                  targetUserId={profile.id}
                  initialBlocked={isBlocked}
                  currentUserId={user?.id ?? null}
                  loginHref={`/login?next=/profile/${profile.username}`}
                />
                <ReportButton
                  targetTable="user"
                  targetId={profile.id}
                  ownerId={profile.id}
                  currentUserId={user?.id ?? null}
                  loginHref={`/login?next=/profile/${profile.username}`}
                  className="text-xs text-muted-foreground hover:text-destructive"
                />
              </div>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">@{profile.username}</p>
          <div className="mt-3 flex gap-5 text-sm text-muted-foreground">
            <Link
              href={`/profile/${profile.username}/followers`}
              className="transition-colors hover:text-foreground"
            >
              팔로워{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {profile.follower_count.toLocaleString()}
              </span>
            </Link>
            <Link
              href={`/profile/${profile.username}/following`}
              className="transition-colors hover:text-foreground"
            >
              팔로잉{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {profile.following_count.toLocaleString()}
              </span>
            </Link>
          </div>
          {profile.bio && (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{profile.bio}</p>
          )}
          <p className="mt-3 text-xs text-muted-foreground/70">{joinedDate} 가입</p>
        </div>
      </header>

      {isBlocked && (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          차단한 사용자입니다. 상단 &quot;차단됨&quot; 버튼으로 차단을 해제할 수 있어요.
        </div>
      )}

      <section className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={isSelf ? "내 노트" : "공개 노트"} value={(noteCount ?? 0).toLocaleString()} />
        <Stat label="모먼트" value={(postCount ?? 0).toLocaleString()} />
        <Stat label="평균 점수" value={avgScore !== null ? `${avgScore}` : "—"} accent />
        {collectionCount !== null && <Stat label="내 컬렉션" value={collectionCount.toLocaleString()} />}
      </section>

      {badges.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            뱃지
          </h2>
          <BadgeStrip badges={badges} displayName={displayName} />
        </section>
      )}

      {(tasteProfile.tags.length > 0 || (isSelf && tasteProfile.total > 0)) && (
        <section className="mt-6">
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            취향 요약
          </h2>
          <TasteProfileChips
            profile={tasteProfile}
            emptyMessage={
              isSelf
                ? "노트를 5개 이상 쌓으면 취향 태그가 자동으로 생겨요."
                : undefined
            }
          />
        </section>
      )}

      <TasteDashboardCard dashboard={tasteDashboard} isSelf={isSelf} />

      {recommendations.length > 0 && (
        <section className="mt-10">
          <div className="mb-3">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {isSelf ? "취향이 비슷한 사람" : `${displayName}과 취향이 비슷한 사람`}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground/70">
              공통 태그 기준 · 팔로우하면 새 노트가 홈에 뜹니다
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
            {recommendations.map((r) => (
              <FollowRecommendationCard key={r.id} rec={r} />
            ))}
          </div>
        </section>
      )}

      <TasteTwinsSection twins={tasteTwins} ownerName={displayName} isSelf={isSelf} />

      {/* ─── 모먼트 그리드 ─── */}
      {posts.length > 0 && (
        <section className="mt-12">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              모먼트
            </h2>
            {isSelf && (
              <Link href="/posts/new" className="text-xs text-primary hover:underline">
                + 새 모먼트
              </Link>
            )}
          </div>
          <ul className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {posts.map((p) => {
              const first = p.photos[0];
              const url = first ? postPhotoUrl(first) : null;
              return (
                <li key={p.id}>
                  <Link
                    href={`/posts/${p.id}`}
                    className="group relative block aspect-square overflow-hidden rounded-md border border-border bg-card"
                  >
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground/50">
                        사진 없음
                      </div>
                    )}
                    {p.photos.length > 1 && (
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] text-white">
                        {p.photos.length}장
                      </span>
                    )}
                    {(p.like_count > 0 || p.comment_count > 0) && (
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-gradient-to-t from-black/70 to-transparent p-1.5 text-[10px] text-white">
                        {p.like_count > 0 && <span>♥ {p.like_count}</span>}
                        {p.comment_count > 0 && <span>💬 {p.comment_count}</span>}
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {posts.length === 0 && isSelf && (
        <section className="mt-12">
          <div className="rounded-xl border border-dashed border-border bg-card/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">아직 모먼트가 없어요.</p>
            <Link
              href="/posts/new"
              className="mt-3 inline-block rounded-md bg-amber-400 px-4 py-2 text-xs font-medium text-neutral-950 hover:bg-amber-300"
            >
              + 첫 모먼트 올리기
            </Link>
          </div>
        </section>
      )}

      <section id="notes" className="mt-12 scroll-mt-4">
        <h2 className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {isSelf ? "내 테이스팅 노트" : "공개 테이스팅 노트"}
          {noteCount ? (
            <span className="ml-2 normal-case tracking-normal text-muted-foreground/70">
              · {noteCount.toLocaleString()}
              {notesHasFilters && " (필터됨)"}
            </span>
          ) : null}
        </h2>

        <NotesFilterBar
          sort={notesSort}
          minScore={notesMinScore}
          buyback={notesBuyback}
          flavors={notesFlavors}
        />

        {tastings.length === 0 ? (
          <p className="rounded-xl border border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
            {notesHasFilters
              ? "조건에 맞는 노트가 없어요. 필터를 조정해보세요."
              : isSelf
                ? "아직 작성한 노트가 없어요."
                : "아직 공개 노트가 없어요."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {tastings.map((t) => (
              <TastingTile
                key={t.id}
                tasting={t}
                currentUserId={user?.id ?? null}
                loginHref={`/login?next=/profile/${profile.username}`}
              />
            ))}
          </div>
        )}

        {notesTotalPages > 1 && (
          <nav className="mt-8 flex items-center justify-center gap-3 text-sm">
            <Link
              href={notesHrefFor(Math.max(1, notesPage - 1))}
              aria-disabled={notesPage <= 1}
              scroll={false}
              className={
                "inline-flex items-center gap-1 rounded-md border border-border bg-card/40 px-3 py-1.5 transition-colors hover:border-foreground/30 hover:bg-card" +
                (notesPage <= 1 ? " pointer-events-none opacity-40" : "")
              }
            >
              <ChevronLeft className="size-3.5" /> 이전
            </Link>
            <span className="text-muted-foreground tabular-nums">
              {notesPage} / {notesTotalPages}
            </span>
            <Link
              href={notesHrefFor(Math.min(notesTotalPages, notesPage + 1))}
              aria-disabled={notesPage >= notesTotalPages}
              scroll={false}
              className={
                "inline-flex items-center gap-1 rounded-md border border-border bg-card/40 px-3 py-1.5 transition-colors hover:border-foreground/30 hover:bg-card" +
                (notesPage >= notesTotalPages ? " pointer-events-none opacity-40" : "")
              }
            >
              다음 <ChevronRight className="size-3.5" />
            </Link>
          </nav>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div
        className={
          "mt-2 font-serif text-3xl tabular-nums " + (accent ? "text-primary" : "text-foreground")
        }
      >
        {value}
      </div>
    </div>
  );
}
