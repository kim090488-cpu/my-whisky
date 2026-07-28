"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { toggleUserBlock } from "@/lib/social/actions";

type Props = {
  targetUserId: string;
  initialBlocked: boolean;
  currentUserId: string | null;
  loginHref?: string;
  className?: string;
};

export function BlockButton({
  targetUserId,
  initialBlocked,
  currentUserId,
  loginHref,
  className,
}: Props) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(initialBlocked);
  const [pending, startTransition] = useTransition();

  if (currentUserId === targetUserId) return null;

  function handleClick() {
    if (!currentUserId) {
      router.push(loginHref ?? "/login");
      return;
    }
    if (pending) return;
    const label = blocked ? "차단을 해제할까요?" : "이 사용자를 차단할까요? 노트·모먼트가 숨겨지고 팔로우가 해제됩니다.";
    if (!confirm(label)) return;

    const prev = blocked;
    setBlocked(!blocked);

    startTransition(async () => {
      const fd = new FormData();
      fd.set("blocked_id", targetUserId);
      const res = await toggleUserBlock(fd);
      if (res?.error) {
        setBlocked(prev);
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={blocked ? "차단 해제" : "차단"}
      className={
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-50 " +
        (blocked
          ? "border border-destructive/40 text-destructive hover:bg-destructive/10"
          : "text-muted-foreground hover:text-destructive") +
        (className ? " " + className : "")
      }
    >
      <Ban className="size-3" />
      {blocked ? "차단됨" : "차단"}
    </button>
  );
}
