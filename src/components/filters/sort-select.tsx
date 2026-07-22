"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { SORT_OPTIONS, type SortKey, toQueryString } from "@/lib/whiskies/filters";

export function SortSelect({ value }: { value: SortKey }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => {
        const qs = toQueryString({ sort: e.target.value as SortKey, page: 1 }, new URLSearchParams(sp.toString()));
        startTransition(() => router.push(`/whiskies${qs}`));
      }}
      className="rounded-md border border-border bg-card px-3 py-1.5 text-sm transition-colors focus:border-ring focus:outline-none disabled:opacity-50"
    >
      {SORT_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
