import type { TasteProfile, TasteTagTone } from "@/lib/tastings/taste-profile";

const TONE_CLASS: Record<TasteTagTone, string> = {
  amber:   "border-amber-400/40 bg-amber-400/10 text-amber-300",
  emerald: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  rose:    "border-rose-400/40 bg-rose-400/10 text-rose-300",
  sky:     "border-sky-400/40 bg-sky-400/10 text-sky-300",
};

export function TasteProfileChips({
  profile,
  emptyMessage,
}: {
  profile: TasteProfile;
  emptyMessage?: string;
}) {
  if (profile.total === 0) return null;

  if (profile.tags.length === 0) {
    if (!emptyMessage) return null;
    return <p className="text-xs text-muted-foreground/70">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {profile.tags.map((tag) => (
        <span
          key={tag.key}
          title={tag.hint}
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${TONE_CLASS[tag.tone]}`}
        >
          {tag.label}
        </span>
      ))}
    </div>
  );
}
