import Link from "next/link";
import { Avatar } from "@/components/avatar";
import type {
  CommonBottling,
  FollowRecommendation,
  FollowRecommendationTopNote,
} from "@/lib/social/follow-recommendations";
import type { TasteTagTone } from "@/lib/tastings/taste-profile";

const TONE_CLASS: Record<TasteTagTone, string> = {
  amber:   "border-amber-400/40 bg-amber-400/10 text-amber-300",
  emerald: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  rose:    "border-rose-400/40 bg-rose-400/10 text-rose-300",
  sky:     "border-sky-400/40 bg-sky-400/10 text-sky-300",
};

export function FollowRecommendationCard({ rec }: { rec: FollowRecommendation }) {
  const name = rec.display_name ?? rec.username;
  return (
    <Link
      href={`/profile/${rec.username}`}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-4 transition-colors hover:border-foreground/30 hover:bg-card"
    >
      <div className="flex items-center gap-3">
        <Avatar name={name} avatarUrl={rec.avatar_url} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{name}</div>
          <div className="truncate text-xs text-muted-foreground">
            @{rec.username} · 노트 {rec.publicNoteCount}
          </div>
        </div>
        {rec.matchScore > 0 && (
          <div className="shrink-0 rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-center">
            <div className="text-[9px] uppercase tracking-wide text-amber-300/80">매치</div>
            <div className="text-sm font-bold tabular-nums leading-tight text-amber-300">
              {rec.matchScore}%
            </div>
          </div>
        )}
      </div>
      {rec.sharedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rec.sharedTags.slice(0, 4).map((tag) => (
            <span
              key={tag.key}
              title={tag.hint}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${TONE_CLASS[tag.tone]}`}
            >
              {tag.label}
            </span>
          ))}
          {rec.sharedTags.length > 4 && (
            <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
              +{rec.sharedTags.length - 4}
            </span>
          )}
        </div>
      )}
      {rec.commonBottlings.length > 0 && (
        <CommonBottlingsRow bottlings={rec.commonBottlings} />
      )}
      {rec.topNote && <TopNotePreview note={rec.topNote} />}
    </Link>
  );
}

function CommonBottlingsRow({ bottlings }: { bottlings: CommonBottling[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
      <span className="text-muted-foreground">함께 좋아함</span>
      {bottlings.map((b) => {
        const dist = b.distilleryNameKr || b.distilleryName;
        const name = b.nameKr || b.name;
        return (
          <span
            key={b.id}
            className="max-w-[16ch] truncate rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-emerald-300"
            title={`${dist} · ${name}`}
          >
            {name}
          </span>
        );
      })}
    </div>
  );
}

function TopNotePreview({ note }: { note: FollowRecommendationTopNote }) {
  const dist = note.distilleryNameKr || note.distilleryName;
  const bottling = note.bottlingNameKr || note.bottlingName;
  return (
    <div className="mt-1 flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/40 p-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-foreground/5">
        {note.labelImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={note.labelImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs text-muted-foreground">🥃</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground/70">
          대표 노트
        </div>
        <div className="truncate text-xs text-foreground/90">
          {dist} · {bottling}
        </div>
      </div>
      {note.score !== null && (
        <div className="shrink-0 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium tabular-nums text-amber-300">
          {note.score}
        </div>
      )}
    </div>
  );
}
