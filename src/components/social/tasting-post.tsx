import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { LikeButton } from "@/components/social/like-button";
import { CommentsThread } from "@/components/social/comments-thread";
import { ReportButton } from "@/components/social/report-button";
import { tastingPhotoUrl, bottlingImageUrl } from "@/lib/uploads/storage";
import { COUNTRY_FLAG } from "@/lib/format";
import type { WhiskyCountry, TastingVisibility } from "@/types/database";

export type TastingPostData = {
  id: string;
  tasted_at: string;
  score: number | null;
  notes: string | null;
  photos: string[] | null;
  visibility: TastingVisibility;
  user_id: string;
  bottling_id: string;
  like_count: number;
  comment_count: number;
  would_buy_again: boolean | null;
  value_for_money: number | null;
  liked: boolean;
  profile: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  bottling: {
    id: string;
    name: string;
    name_kr: string | null;
    distillery_name: string;
    distillery_name_kr: string | null;
    country: WhiskyCountry;
    label_image_url: string | null;
  } | null;
};

const COUNTRY_GRADIENT: Record<WhiskyCountry, string> = {
  scotland: "from-amber-900/30 via-neutral-950 to-neutral-950",
  ireland: "from-emerald-900/30 via-neutral-950 to-neutral-950",
  usa: "from-orange-900/30 via-neutral-950 to-neutral-950",
  japan: "from-rose-900/30 via-neutral-950 to-neutral-950",
  india: "from-yellow-900/30 via-neutral-950 to-neutral-950",
  taiwan: "from-teal-900/30 via-neutral-950 to-neutral-950",
  canada: "from-red-900/30 via-neutral-950 to-neutral-950",
  australia: "from-sky-900/30 via-neutral-950 to-neutral-950",
  france: "from-blue-900/30 via-neutral-950 to-neutral-950",
  sweden: "from-cyan-900/30 via-neutral-950 to-neutral-950",
  germany: "from-stone-800/40 via-neutral-950 to-neutral-950",
  south_korea: "from-purple-900/30 via-neutral-950 to-neutral-950",
  other: "from-neutral-800/40 via-neutral-950 to-neutral-950",
};

export function TastingPost({
  tasting,
  currentUserId,
  loginHref,
}: {
  tasting: TastingPostData;
  currentUserId: string | null;
  loginHref: string;
}) {
  const t = tasting;
  const p = t.profile;
  const b = t.bottling;
  const authorName = p?.display_name ?? p?.username ?? "익명";
  const photoSrc = t.photos?.[0] ? tastingPhotoUrl(t.photos[0]) : null;
  const labelSrc = b ? bottlingImageUrl(b.label_image_url) : null;
  const extraPhotos = (t.photos?.length ?? 0) - 1;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card/40">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <Avatar name={authorName} avatarUrl={p?.avatar_url ?? null} size={36} />
        <div className="min-w-0 flex-1">
          {p?.username ? (
            <Link
              href={`/profile/${p.username}`}
              className="block truncate text-sm font-semibold hover:text-amber-300"
            >
              {authorName}
            </Link>
          ) : (
            <span className="block truncate text-sm font-semibold">{authorName}</span>
          )}
          {b && (
            <Link
              href={`/whiskies/${b.id}`}
              className="block truncate text-[11px] text-muted-foreground hover:text-foreground"
            >
              {COUNTRY_FLAG[b.country]} {b.distillery_name_kr ?? b.distillery_name}
            </Link>
          )}
        </div>
        <ReportButton
          targetTable="tasting"
          targetId={t.id}
          ownerId={t.user_id}
          currentUserId={currentUserId}
          loginHref={loginHref}
          label={<span aria-label="더보기" className="text-xl leading-none">⋯</span>}
          className="rounded-full px-2 py-0 text-muted-foreground hover:text-foreground"
        />
      </div>

      {/* Media */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-950">
        {photoSrc ? (
          // 사용자 노트 사진 (1순위)
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoSrc} alt="" className="h-full w-full object-cover" />
        ) : labelSrc ? (
          // 보틀링 라벨 (2순위) — 라벨은 보통 세로 비율이라 contain
          <div className="flex h-full w-full items-center justify-center bg-neutral-950 p-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={labelSrc} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        ) : (
          // 텍스트 placeholder (3순위)
          <div
            className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br p-8 text-center ${
              b ? COUNTRY_GRADIENT[b.country] : COUNTRY_GRADIENT.other
            }`}
          >
            <span className="text-6xl">{b ? COUNTRY_FLAG[b.country] : "🥃"}</span>
            <p className="mt-6 font-serif text-2xl leading-tight text-foreground/90">
              {b?.name_kr ?? b?.name ?? "테이스팅 노트"}
            </p>
            {b && (b.name_kr ?? b.name) && (
              <p className="mt-2 text-xs text-muted-foreground">
                {b.distillery_name_kr ?? b.distillery_name}
              </p>
            )}
          </div>
        )}

        {extraPhotos > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
            +{extraPhotos}
          </span>
        )}
        {t.score !== null && (
          <div className="absolute bottom-3 right-3 inline-flex items-baseline gap-1 rounded-full bg-black/70 px-3 py-1.5 backdrop-blur">
            <span className="font-serif text-lg font-semibold text-amber-300 leading-none">
              {t.score}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-neutral-400">점</span>
          </div>
        )}
        {t.visibility === "followers" && (
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur">
            팔로워만
          </span>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-5 px-4 pt-3">
        <LikeButton
          tastingId={t.id}
          initialLiked={t.liked}
          initialCount={t.like_count}
          currentUserId={currentUserId}
          loginHref={loginHref}
          size="lg"
        />
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground/70">
          <span aria-hidden className="text-2xl leading-none">💬</span>
          <span className="tabular-nums">{t.comment_count}</span>
        </span>
      </div>

      {/* Caption */}
      <div className="space-y-2 px-4 py-3">
        {(t.notes || b) && (
          <p className="text-sm leading-relaxed">
            {p?.username && (
              <Link
                href={`/profile/${p.username}`}
                className="mr-1.5 font-semibold hover:text-amber-300"
              >
                {authorName}
              </Link>
            )}
            {b && (
              <Link
                href={`/whiskies/${b.id}`}
                className="mr-1 font-medium text-amber-300 hover:text-amber-200"
              >
                {b.name_kr ?? b.name}
              </Link>
            )}
            {t.notes && (
              <span className="whitespace-pre-wrap text-foreground/90">{t.notes}</span>
            )}
          </p>
        )}

        {(t.would_buy_again !== null || t.value_for_money !== null) && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {t.would_buy_again === true && (
              <span className="rounded-full border border-emerald-700/40 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-300">
                ✓ 다시 살래요
              </span>
            )}
            {t.would_buy_again === false && (
              <span className="rounded-full border border-rose-700/40 bg-rose-400/10 px-2 py-0.5 text-[11px] text-rose-300">
                ✗ 안 살래요
              </span>
            )}
            {t.value_for_money !== null && (
              <span className="rounded-full border border-border bg-secondary/30 px-2 py-0.5 text-[11px] text-muted-foreground">
                가성비 {t.value_for_money}/5
              </span>
            )}
          </div>
        )}

        <Link
          href={`/tastings/${t.id}`}
          className="block pt-1 text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        >
          {t.tasted_at}
        </Link>
      </div>

      {/* Comments thread */}
      <div className="border-t border-border/60 px-4 py-3">
        <CommentsThread
          tastingId={t.id}
          initialCount={t.comment_count}
          currentUserId={currentUserId}
          loginHref={loginHref}
        />
      </div>
    </article>
  );
}
