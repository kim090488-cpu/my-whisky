"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { PAGE_SIZE_OPTIONS, type PageSize, toQueryString } from "@/lib/whiskies/filters";

export function PageSizeSelect({ value }: { value: PageSize }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = Number(e.target.value) as PageSize;
        const qs = toQueryString(
          { pageSize: next, page: 1 },
          new URLSearchParams(sp.toString()),
        );
        startTransition(() => router.push(`/whiskies${qs}`));
      }}
      className="rounded-md border border-border bg-card px-3 py-1.5 text-sm transition-colors focus:border-ring focus:outline-none disabled:opacity-50"
      aria-label="페이지당 표시 개수"
    >
      {PAGE_SIZE_OPTIONS.map((n) => (
        <option key={n} value={n}>{n}개 보기</option>
      ))}
    </select>
  );
}
