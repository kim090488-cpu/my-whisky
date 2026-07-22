"use client";

import { useState } from "react";
import { COUNTRY_FLAG, formatAge, formatAbv } from "@/lib/format";
import { TastingFormFull } from "@/app/whiskies/[id]/tastings/new/tasting-form-full";
import { BottlingPicker, type BottlingHit } from "./bottling-picker";

export function NoteStarter({ userId }: { userId: string }) {
  const [bottling, setBottling] = useState<BottlingHit | null>(null);

  if (!bottling) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-5 sm:p-6">
        <BottlingPicker onSelect={setBottling} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-700/40 bg-amber-400/5 p-4">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-amber-300/80">
            노트 대상
          </div>
          <div className="mt-0.5 truncate text-sm font-medium">
            {bottling.name_kr ?? bottling.name}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {COUNTRY_FLAG[bottling.country]}{" "}
            {bottling.distillery_name_kr ?? bottling.distillery_name} ·{" "}
            {formatAge(bottling.age_years)} · {formatAbv(bottling.abv)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setBottling(null)}
          className="shrink-0 rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-500"
        >
          다른 위스키 고르기
        </button>
      </div>

      <TastingFormFull bottlingId={bottling.id} userId={userId} />
    </div>
  );
}
