import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/social/follow-button";

type Direction = "followers" | "following";

const LIMIT = 200;

export async function FollowListPage({
  username: rawUsername,
  direction,
}: {
  username: string;
  direction: Direction;
}) {
  const username = decodeURIComponent(rawUsername).toLowerCase();
  const supabase = await createClient();

  const { data: owner } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", username)
    .maybeSingle();
  if (!owner) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const filterCol = direction === "followers" ? "followee_id" : "follower_id";
  const targetCol = direction === "followers" ? "follower_id" : "followee_id";

  const { data: edges } = await supabase
    .from("follows")
    .select("follower_id, followee_id, created_at")
    .eq(filterCol, owner.id)
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  const otherIds = Array.from(
    new Set(
      (edges ?? []).map((e) =>
        targetCol === "follower_id" ? e.follower_id : e.followee_id,
      ),
    ),
  );

  type Profile = {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
  };

  let profiles: Profile[] = [];
  if (otherIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio")
      .in("id", otherIds);
    const byId = new Map<string, Profile>();
    for (const p of (profs ?? []) as Profile[]) byId.set(p.id, p);
    profiles = otherIds
      .map((oid) => byId.get(oid))
      .filter((x): x is Profile => !!x);
  }

  // 현재 로그인 유저가 이미 팔로우 중인 대상 표시
  let myFollowing = new Set<string>();
  if (user && profiles.length > 0) {
    const { data: mine } = await supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", user.id)
      .in("followee_id", profiles.map((p) => p.id));
    myFollowing = new Set((mine ?? []).map((e) => e.followee_id));
  }

  const displayName = owner.display_name ?? owner.username;
  const title = direction === "followers" ? "팔로워" : "팔로잉";

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/profile/${owner.username}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        {displayName}
      </Link>

      <h1 className="mt-4 mb-6 font-serif text-2xl tracking-tight">{title}</h1>

      {profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {direction === "followers"
            ? "아직 팔로워가 없어요."
            : "아직 팔로잉이 없어요."}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-900">
          {profiles.map((p) => {
            const name = p.display_name ?? p.username;
            const isSelf = user?.id === p.id;
            return (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <Link href={`/profile/${p.username}`} className="shrink-0">
                  <Avatar name={name} avatarUrl={p.avatar_url} size={44} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/profile/${p.username}`}
                    className="block truncate text-sm font-medium hover:text-amber-300"
                  >
                    {name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    @{p.username}
                  </p>
                  {p.bio && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">
                      {p.bio}
                    </p>
                  )}
                </div>
                {!isSelf && (
                  <FollowButton
                    followeeId={p.id}
                    initialFollowing={myFollowing.has(p.id)}
                    currentUserId={user?.id ?? null}
                    loginHref={`/login?next=/profile/${owner.username}/${direction}`}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
