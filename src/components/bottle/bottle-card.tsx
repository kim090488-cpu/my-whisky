import Link from "next/link";
import { GlassWater } from "lucide-react";
import { COUNTRY_FLAG, CASK_LABEL, formatAge, formatAbv } from "@/lib/format";
import { bottlingImageUrl } from "@/lib/uploads/storage";
import type { WhiskyCountry, CaskType } from "@/types/database";

type Props = {
  id: string;
  name: string;
  name_kr?: string | null;
  age_years: number | null;
  abv: number | null;
  cask_type: CaskType | null;
  distillery_name: string;
  distillery_name_kr?: string | null;
  country: WhiskyCountry;
  region: string | null;
  label_image_url?: string | null;
  avg_score?: number | null;
  tasting_count?: number;
  // v2: verdict 신호
  avg_value_for_money?: number | null;
  buy_again_pct?: number | null;
};

type BadgeTone = "neutral" | "amber";
function pickBadge(b: Props): { label: string; tone: BadgeTone } | null {
  if (b.buy_again_pct != null && b.buy_again_pct >= 80) {
    return { label: `재구매 ${b.buy_again_pct}%`, tone: "neutral" };
  }
  if (b.avg_score != null && b.avg_score >= 90) {
    return { label: `평점 ${b.avg_score}`, tone: "amber" };
  }
  if (b.avg_value_for_money != null && b.avg_value_for_money >= 4.5) {
    return { label: `가성비 ${b.avg_value_for_money.toFixed(1)}`, tone: "neutral" };
  }
  return null;
}

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "border-border/60 bg-background/85 text-foreground/85 backdrop-blur",
  amber: "border-amber-700/50 bg-amber-400/15 text-amber-200 backdrop-blur",
};

export function BottleCard(b: Props) {
  const imgUrl = bottlingImageUrl(b.label_image_url);
  const badge = pickBadge(b);
  return (
    <Link
      href={`/whiskies/${b.id}`}
      className="group block overflow-hidden rounded-xl border border-border bg-card/40 transition-all hover:-translate-y-0.5 hover:border-border hover:bg-card hover:shadow-lg hover:shadow-black/20"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br from-amber-900/15 via-accent/30 to-background">
        {badge && (
          <span
            className={`absolute left-2 top-2 z-10 rounded-full border px-2 py-0.5 text-[10px] font-medium ${BADGE_TONE[badge.tone]}`}
          >
            {badge.label}
          </span>
        )}
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgUrl}
            alt={b.name}
            className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-amber-200/40 transition-colors group-hover:text-amber-200/60">
            <GlassWater className="size-12" strokeWidth={1.2} />
            <span className="text-[10px] uppercase tracking-wider">no label yet</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-baseline gap-1.5 text-xs text-muted-foreground">
          <span>{b.country ? COUNTRY_FLAG[b.country] : "🌐"}</span>
          <span className="truncate">
            {b.distillery_name_kr ?? b.distillery_name ?? "증류소 미상"}
            {b.distillery_name_kr && b.distillery_name && b.distillery_name_kr !== b.distillery_name && (
              <span className="text-muted-foreground/55"> · {b.distillery_name}</span>
            )}
          </span>
          {b.region && (
            <>
              <span className="text-border">·</span>
              <span className="truncate">{b.region}</span>
            </>
          )}
        </div>

        <div className="mt-1 line-clamp-2 min-h-[2.5em] font-medium text-foreground">
          {b.name_kr ?? b.name}
        </div>
        {b.name_kr && b.name_kr !== b.name && (
          <div className="line-clamp-1 text-[11px] text-muted-foreground/70">
            {b.name}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span>{formatAge(b.age_years)}</span>
            <span className="text-border">·</span>
            <span>{formatAbv(b.abv)}</span>
            {b.cask_type && b.cask_type !== "unknown" && (
              <>
                <span className="text-border">·</span>
                <span className="truncate">{CASK_LABEL[b.cask_type]}</span>
              </>
            )}
          </div>
          {b.avg_score !== null && b.avg_score !== undefined ? (
            <div className="flex items-baseline gap-0.5">
              <span className="font-serif text-base text-primary">{b.avg_score}</span>
              <span className="text-[10px] text-muted-foreground">({b.tasting_count ?? 0})</span>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground/60">노트 없음</span>
          )}
        </div>

        {/* v2: verdict 신호 — 데이터 있을 때만 노출 */}
        {(b.buy_again_pct !== null && b.buy_again_pct !== undefined) ||
        (b.avg_value_for_money !== null && b.avg_value_for_money !== undefined) ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {b.buy_again_pct !== null && b.buy_again_pct !== undefined && (
              <span className="text-emerald-300/90">↻ 다시 살래요 {b.buy_again_pct}%</span>
            )}
            {b.avg_value_for_money !== null && b.avg_value_for_money !== undefined && (
              <span>가성비 {b.avg_value_for_money.toFixed(1)}/5</span>
            )}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
