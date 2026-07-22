"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleFollow } from "@/lib/social/actions";

type Props = {
  followeeId: string;
  initialFollowing: boolean;
  currentUserId: string | null;
  loginHref?: string;
};

export function FollowButton({ followeeId, initialFollowing, currentUserId, loginHref }: Props) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  // 본인 프로필에선 안 보임
  if (currentUserId === followeeId) return null;

  function handleClick() {
    if (!currentUserId) {
      router.push(loginHref ?? "/login");
      return;
    }
    if (pending) return;

    const prev = following;
    setFollowing(!following);

    startTransition(async () => {
      const fd = new FormData();
      fd.set("followee_id", followeeId);
      const res = await toggleFollow(fd);
      if (res?.error) setFollowing(prev);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={
        "rounded-md px-4 py-1.5 text-xs font-medium transition " +
        (following
          ? "border border-neutral-700 text-neutral-300 hover:border-red-500 hover:text-red-300"
          : "bg-amber-400 text-neutral-950 hover:bg-amber-300")
      }
    >
      {following ? "팔로잉" : "+ 팔로우"}
    </button>
  );
}
