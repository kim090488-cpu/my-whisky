import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { LikeButton } from "@/components/social/like-button";
import { TagChips } from "@/components/tag-input";
import { tastingPhotoUrl, bottlingImageUrl } from "@/lib/uploads/storage";
import { COUNTRY_FLAG } from "@/lib/format";
import type { WhiskyCountry, TastingVisibility } from "@/types/database";

export type TastingTileData = {
  id: string;
  tasted_at: string;
  score: number | null;
  notes: string | null;
  photos: string[] | null;
  visibility: TastingVisibility;
  user_id: string;
  like_count: number;
  comment_count: number;
  liked: boolean;
  would_buy_again: boolean | null;
  value_for_money: number | null;
  sweetness: number | null;
  smokiness: number | null;
  fruitiness: number | null;
  spiciness: number | null;
  smoothness: number | null;
  complexity: number | null;
  finish_length: number | null;
  tags: string[] | null;
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

const FLAVOR_TILE_TAGS = [
  { key: "sweetness",     label: "달콤" },
  { key: "smokiness",     label: "스모키" },
  { key: "fruitiness",    label: "과일" },
  { key: "spiciness",     label: "스파이시" },
  { key: "smoothness",    label: "부드러운" },
  { key: "complexity",    label: "복잡한" },
  { key: "finish_length", label: "긴 여운" },
] as const satisfies readonly {
  key:
    | "sweetness" | "smokiness" | "fruitiness" | "spiciness"
    | "smoothness" | "complexity" | "finish_length";
  label: string;
}[];
const FLAVOR_TILE_THRESHOLD = 7;

function pickDominantFlavors(t: TastingTileData): string[] {
  const scored: { label: string; value: number }[] = [];
  for (const tag of FLAVOR_TILE_TAGS) {
    const v = t[tag.key];
    if (typeof v === "number" && v >= FLAVOR_TILE_THRESHOLD) {
      scored.push({ label: tag.label, value: v });
    }
  }
  scored.sort((a, b) => b.value - a.value);
  return scored.slice(0, 2).map((s) => s.label);
}

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

export function TastingTile({
  tasting,
  currentUserId,
  loginHref,
}: {
  tasting: TastingTileData;
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
  const flavorTags = pickDominantFlavors(t);

  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-card/30 transition-colors hover:border-border hover:bg-card/60">
      {/* Media — square, click → detail */}
      <Link
        href={`/tastings/${t.id}`}
        className="relative block aspect-square w-full overflow-hidden bg-neutral-950"
      >
        {photoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : labelSrc ? (
          <div className="flex h-full w-full items-center justify-center bg-neutral-950 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={labelSrc}
              alt=""
              className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ) : (
          <div
            className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br p-4 text-center ${
              b ? COUNTRY_GRADIENT[b.country] : COUNTRY_GRADIENT.other
            }`}
          >
            <span className="text-3xl sm:text-4xl">
              {b ? COUNTRY_FLAG[b.country] : "🥃"}
            </span>
            <p className="mt-3 line-clamp-3 font-serif text-sm leading-tight text-foreground/85 sm:text-base">
              {b?.name_kr ?? b?.name ?? "테이스팅 노트"}
            </p>
          </div>
        )}

        {/* Overlays */}
        {t.score !== null && (
          <div className="absolute right-2 top-2 inline-flex items-baseline gap-0.5 rounded-full bg-black/70 px-2 py-1 backdrop-blur">
            <span className="font-serif text-sm font-semibold leading-none text-amber-300">
              {t.score}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-neutral-400">점</span>
          </div>
        )}
        {extraPhotos > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
            +{extraPhotos}
          </span>
        )}
        {t.visibility === "followers" && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white backdrop-blur">
            팔로워만
          </span>
        )}
      </Link>

      {/* Info strip */}
      <div className="space-y-1.5 px-3 py-2.5">
        {/* User row */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Avatar name={authorName} avatarUrl={p?.avatar_url ?? null} size={20} />
          {p?.username ? (
            <Link
              href={`/profile/${p.username}`}
              className="truncate text-xs font-medium hover:text-amber-300"
            >
              {authorName}
            </Link>
          ) : (
            <span className="truncate text-xs font-medium">{authorName}</span>
          )}
        </div>

        {/* Bottling */}
        {b && (
          <Link
            href={`/whiskies/${b.id}`}
            className="block truncate text-[11px] text-muted-foreground hover:text-foreground"
          >
            {COUNTRY_FLAG[b.country]} {b.distillery_name_kr ?? b.distillery_name}
            <span className="text-foreground/70"> · {b.name_kr ?? b.name}</span>
          </Link>
        )}

        {/* Verdict + flavor tags */}
        {(flavorTags.length > 0 ||
          t.would_buy_again !== null ||
          t.value_for_money !== null) && (
          <div className="flex flex-wrap gap-1">
            {t.would_buy_again === true && (
              <span
                className="rounded-full border border-emerald-700/50 bg-emerald-400/10 px-1.5 py-0 text-[10px] text-emerald-300"
                title="다시 살래요"
              >
                ✓ 재구매
              </span>
            )}
            {t.would_buy_again === false && (
              <span
                className="rounded-full border border-rose-700/50 bg-rose-400/10 px-1.5 py-0 text-[10px] text-rose-300"
                title="다시 안 살래요"
              >
                ✗ 재구매
              </span>
            )}
            {t.value_for_money !== null && (
              <span
                className="rounded-full border border-border bg-secondary/40 px-1.5 py-0 text-[10px] text-muted-foreground"
                title={`가성비 ${t.value_for_money}/5`}
              >
                가성비 {t.value_for_money}
              </span>
            )}
            {flavorTags.map((label) => (
              <span
                key={label}
                className="rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 py-0 text-[10px] text-amber-300"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {(t.tags?.length ?? 0) > 0 && (
          <TagChips tags={t.tags} max={3} />
        )}

        {/* Notes preview (single line) */}
        {t.notes && (
          <Link
            href={`/tastings/${t.id}`}
            className="block truncate text-[11px] leading-relaxed text-foreground/70 hover:text-foreground"
          >
            {t.notes}
          </Link>
        )}

        {/* Counts row */}
        <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <LikeButton
              tastingId={t.id}
              initialLiked={t.liked}
              initialCount={t.like_count}
              currentUserId={currentUserId}
              loginHref={loginHref}
            />
            <span className="inline-flex items-center gap-0.5">
              <span aria-hidden>💬</span>
              <span className="tabular-nums">{t.comment_count}</span>
            </span>
          </div>
          <span className="tabular-nums">{t.tasted_at}</span>
        </div>
      </div>
    </article>
  );
}
