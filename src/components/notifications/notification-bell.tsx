"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

const POLL_MS = 45_000;

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/notifications/unread-count", {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { count?: number };
        if (typeof data.count === "number") setCount(data.count);
      } catch {
        // 무시 — 다음 폴링에서 재시도
      }
    }

    const id = window.setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const label = count > 9 ? "9+" : String(count);

  return (
    <Link
      href="/notifications"
      aria-label={count > 0 ? `알림 ${count}건 미확인` : "알림"}
      className="relative shrink-0 rounded-full p-1.5 text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
    >
      <Bell className="h-5 w-5" strokeWidth={1.75} />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold leading-none text-black">
          {label}
        </span>
      )}
    </Link>
  );
}
