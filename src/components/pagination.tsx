import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toQueryString } from "@/lib/whiskies/filters";

type Props = {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  currentSearchParams: URLSearchParams;
};

export function Pagination({ basePath, page, pageSize, total, currentSearchParams }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) =>
    basePath + toQueryString({ page: p }, new URLSearchParams(currentSearchParams.toString()));

  const btn =
    "inline-flex items-center gap-1 rounded-md border border-border bg-card/40 px-3 py-1.5 text-sm transition-colors hover:border-foreground/30 hover:bg-card";
  const disabled = "pointer-events-none opacity-40";

  return (
    <nav className="mt-10 flex items-center justify-center gap-3 text-sm">
      <Link
        href={hrefFor(Math.max(1, page - 1))}
        aria-disabled={page <= 1}
        className={btn + (page <= 1 ? " " + disabled : "")}
      >
        <ChevronLeft className="size-3.5" /> 이전
      </Link>
      <span className="text-muted-foreground tabular-nums">
        {page} / {totalPages}
        <span className="ml-2 text-muted-foreground/60">· {total.toLocaleString()}개</span>
      </span>
      <Link
        href={hrefFor(Math.min(totalPages, page + 1))}
        aria-disabled={page >= totalPages}
        className={btn + (page >= totalPages ? " " + disabled : "")}
      >
        다음 <ChevronRight className="size-3.5" />
      </Link>
    </nav>
  );
}
