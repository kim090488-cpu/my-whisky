"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  /** 이미 public URL로 변환된 배열 (null은 필터링됨) */
  urls: (string | null)[];
  /** grid 클래스 override (기본 3 columns) */
  gridClassName?: string;
  /** 각 셀 클래스 override */
  cellClassName?: string;
};

export function PhotoGallery({
  urls,
  gridClassName = "grid grid-cols-3 gap-2",
  cellClassName = "aspect-square overflow-hidden rounded border border-neutral-800 transition-colors hover:border-amber-700/60",
}: Props) {
  const items = urls.filter((u): u is string => !!u);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (openIndex === null) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIndex(null);
      else if (e.key === "ArrowLeft") {
        setOpenIndex((i) => (i === null ? null : (i - 1 + items.length) % items.length));
      } else if (e.key === "ArrowRight") {
        setOpenIndex((i) => (i === null ? null : (i + 1) % items.length));
      }
    }
    window.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openIndex, items.length]);

  if (items.length === 0) return null;

  const activeUrl = openIndex !== null ? items[openIndex] : null;

  return (
    <>
      <div className={gridClassName}>
        {items.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpenIndex(i)}
            className={cellClassName}
            aria-label={`사진 ${i + 1} 확대 보기`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {openIndex !== null && activeUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpenIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 py-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenIndex(null);
              }}
              className="pointer-events-auto rounded-full bg-black/50 p-2 text-neutral-100 transition hover:bg-black/80"
              aria-label="닫기"
            >
              <X className="size-5" />
            </button>
            {items.length > 1 && (
              <span className="pointer-events-auto rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-neutral-100 tabular-nums">
                {openIndex + 1} / {items.length}
              </span>
            )}
          </div>

          {/* Prev */}
          {items.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenIndex((i) =>
                  i === null ? null : (i - 1 + items.length) % items.length,
                );
              }}
              className="absolute left-2 rounded-full bg-black/50 p-3 text-neutral-100 transition hover:bg-black/80 sm:left-6"
              aria-label="이전 사진"
            >
              <ChevronLeft className="size-6" />
            </button>
          )}

          {/* Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeUrl}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full object-contain"
          />

          {/* Next */}
          {items.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenIndex((i) =>
                  i === null ? null : (i + 1) % items.length,
                );
              }}
              className="absolute right-2 rounded-full bg-black/50 p-3 text-neutral-100 transition hover:bg-black/80 sm:right-6"
              aria-label="다음 사진"
            >
              <ChevronRight className="size-6" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
