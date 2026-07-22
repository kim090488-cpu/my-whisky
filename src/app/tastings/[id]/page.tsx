import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import {
  COUNTRY_FLAG, COUNTRY_LABEL, CASK_LABEL,
  formatAge, formatAbv, formatScore,
} from "@/lib/format";
import { LikeButton } from "@/components/social/like-button";
import { CommentsThread } from "@/components/social/comments-thread";
import { ReportButton } from "@/components/social/report-button";
import { FlavorRadar } from "@/components/social/flavor-radar";
import { bottlingImageUrl, tastingPhotoUrl } from "@/lib/uploads/storage";
import { PhotoGallery } from "@/components/tastings/photo-gallery";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tastings")
    .select("score, notes, bottling_id, user_id, visibility")
    .eq("id", id)
    .maybeSingle();
  if (!t) return { title: "노트를 찾을 수 없어요 · my-whisky" };

  const [bRes, pRes] = await Promise.all([
    supabase.from("bottling_card_stats").select("name, name_kr, distillery_name, distillery_name_kr").eq("id", t.bottling_id).maybeSingle(),
    supabase.from("profiles").select("username, display_name").eq("id", t.user_id).maybeSingle(),
  ]);
  const b = bRes.data;
  const p = pRes.data;
  const author = p?.display_name ?? p?.username ?? "익명";
  const titleParts = b ? [`${b.distillery_name_kr ?? b.distillery_name} ${b.name_kr ?? b.name}`] : ["테이스팅 노트"];
  if (t.score !== null) titleParts.push(`${t.score}점`);
  const title = `${titleParts.join(" · ")} — my-whisky`;
  const desc = (t.notes ?? "").slice(0, 140) || `${author}의 테이스팅 노트`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: `by ${author}`,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
    },
  };
}

export default async function TastingDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS — 권한 없으면 null 반환
  const { data: t } = await supabase
    .from("tastings")
    .select(
      "id, tasted_at, score, notes, color, photos, visibility, user_id, bottling_id, like_count, comment_count, created_at, would_buy_again, value_for_money, recommended_for, sweetness, smokiness, fruitiness, spiciness, smoothness, complexity, finish_length, purchase_price, purchase_currency, purchased_at_place, food_pairing",
    )
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileRes, bRes, myLikeRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", t.user_id)
      .maybeSingle(),
    supabase
      .from("bottlings")
      .select(
        "id, name, name_kr, age_years, abv, cask_type, label_image_url, distillery:distilleries(id, name, name_kr, country, region)",
      )
      .eq("id", t.bottling_id)
      .maybeSingle(),
    user
      ? supabase
          .from("tasting_likes")
          .select("id")
          .eq("user_id", user.id)
          .eq("tasting_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const profile = profileRes.data;
  const b = bRes.data;
  const d = b && (Array.isArray(b.distillery) ? b.distillery[0] : b.distillery);
  const myLiked = !!myLikeRes.data;

  const authorName = profile?.display_name ?? profile?.username ?? "익명";
  const bottlingThumbUrl = b ? bottlingImageUrl(b.label_image_url) : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {b && (
        <Link href={`/whiskies/${b.id}`} className="text-sm text-neutral-500 hover:text-neutral-300">
          ← {b.name_kr ?? b.name}
        </Link>
      )}

      {/* 작성자 헤더 */}
      <header className="mt-4 flex items-center gap-3">
        <Avatar name={authorName} avatarUrl={profile?.avatar_url} size={44} />
        <div>
          {profile?.username ? (
            <Link href={`/profile/${profile.username}`} className="font-medium hover:text-amber-300">
              {authorName}
            </Link>
          ) : (
            <span className="font-medium">{authorName}</span>
          )}
          <div className="text-xs text-neutral-500">
            {t.tasted_at}
            {t.visibility !== "public" && (
              <span className="ml-2 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
                {t.visibility === "private" ? "비공개" : "팔로워만"}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* 보틀링 카드 + 점수 */}
      {b && (
        <Link
          href={`/whiskies/${b.id}`}
          className="mt-6 flex items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 hover:border-amber-700/60"
        >
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-neutral-950">
            {bottlingThumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bottlingThumbUrl} alt={b.name} className="h-full w-full object-contain" />
            ) : (
              <span className="text-[10px] text-muted-foreground/60">사진 없음</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-neutral-500">
              {d && (
                <>
                  {COUNTRY_FLAG[d.country]} {d.name_kr ?? d.name} · {d.region ?? COUNTRY_LABEL[d.country]}
                </>
              )}
            </div>
            <div className="mt-0.5 font-medium">{b.name_kr ?? b.name}</div>
            {b.name_kr && b.name_kr !== b.name && (
              <div className="text-[11px] text-neutral-500">{b.name}</div>
            )}
            <div className="mt-1 text-xs text-neutral-500">
              {formatAge(b.age_years)} · {formatAbv(b.abv)}
              {b.cask_type && b.cask_type !== "unknown" && ` · ${CASK_LABEL[b.cask_type]}`}
            </div>
          </div>
          {t.score !== null && (
            <div className="shrink-0 text-right">
              <div className="text-3xl font-semibold text-amber-300 leading-none">{t.score}</div>
              <div className="text-[10px] text-neutral-500">/ 100</div>
            </div>
          )}
        </Link>
      )}

      {/* 향미 프로필 */}
      {(t.sweetness !== null || t.smokiness !== null || t.fruitiness !== null ||
        t.spiciness !== null || t.smoothness !== null || t.complexity !== null ||
        t.finish_length !== null) && (
        <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            향미 프로필
          </div>
          <FlavorRadar
            values={{
              sweetness: t.sweetness,
              smokiness: t.smokiness,
              fruitiness: t.fruitiness,
              spiciness: t.spiciness,
              smoothness: t.smoothness,
              complexity: t.complexity,
              finish_length: t.finish_length,
            }}
          />
        </div>
      )}

      {/* 노트 본문 */}
      <section className="mt-8 space-y-4">
        {t.color && (
          <Block label="색">
            <p className="text-sm text-neutral-200">{t.color}</p>
          </Block>
        )}
        {t.notes && (
          <Block label="후기">
            <p className="whitespace-pre-wrap text-base leading-relaxed text-neutral-100">{t.notes}</p>
          </Block>
        )}

        {t.photos && t.photos.length > 0 && (
          <PhotoGallery urls={t.photos.map((p) => tastingPhotoUrl(p))} />
        )}

        {!t.color && !t.notes && (
          <p className="text-sm text-neutral-500">본문 없는 노트.</p>
        )}
      </section>

      {/* 좋아요 + 댓글 (default open) */}
      <section className="mt-10 border-t border-neutral-900 pt-6">
        <div className="mb-4 flex items-center justify-end gap-4">
          {user?.id === t.user_id && (
            <Link
              href={`/tastings/${t.id}/edit`}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              수정
            </Link>
          )}
          <ReportButton
            targetTable="tasting"
            targetId={t.id}
            ownerId={t.user_id}
            currentUserId={user?.id ?? null}
            loginHref={`/login?next=/tastings/${t.id}`}
          />
          <LikeButton
            tastingId={t.id}
            initialLiked={myLiked}
            initialCount={t.like_count}
            currentUserId={user?.id ?? null}
            loginHref={`/login?next=/tastings/${t.id}`}
          />
        </div>
        <CommentsThread
          tastingId={t.id}
          initialCount={t.comment_count}
          currentUserId={user?.id ?? null}
          loginHref={`/login?next=/tastings/${t.id}`}
          defaultOpen
        />
      </section>
    </main>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      {children}
    </div>
  );
}
