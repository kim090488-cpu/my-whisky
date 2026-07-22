import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COLLECTION_LABEL } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { NotebookPen, Library, Pencil, Rss, Bell, Sparkles } from "lucide-react";
import type { CollectionStatus } from "@/types/database";
import { loadTasteProfile } from "@/lib/tastings/taste-profile";
import { TasteProfileChips } from "@/components/social/taste-profile-chips";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, bio, avatar_url, follower_count, following_count")
    .eq("id", user.id)
    .maybeSingle();

  const { data: collection } = await supabase
    .from("collection_items")
    .select("status")
    .eq("user_id", user.id);

  const counts = (collection ?? []).reduce<Record<CollectionStatus, number>>(
    (acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    },
    { owned: 0, opened: 0, finished: 0, wishlist: 0 },
  );

  const { count: tastingCount } = await supabase
    .from("tastings")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const tasteProfile = await loadTasteProfile(supabase, user.id, {
    publicOnly: false,
  });

  const displayName = profile?.display_name ?? profile?.username ?? user.email ?? "사용자";

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <Avatar name={displayName} avatarUrl={profile?.avatar_url} size={88} />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-3xl tracking-tight">{displayName}</h1>
          {profile?.username && (
            <p className="mt-1 text-sm text-muted-foreground">@{profile.username}</p>
          )}
          <div className="mt-3 flex gap-5 text-sm text-muted-foreground">
            <span>
              팔로워 <span className="font-semibold text-foreground tabular-nums">{profile?.follower_count ?? 0}</span>
            </span>
            <span>
              팔로잉 <span className="font-semibold text-foreground tabular-nums">{profile?.following_count ?? 0}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {profile?.username && (
            <ActionLink href={`/profile/${profile.username}`} icon={<Library className="size-3.5" />}>
              내 공개 프로필
            </ActionLink>
          )}
          <ActionLink href="/me/feed" icon={<Rss className="size-3.5" />}>
            피드
          </ActionLink>
          <ActionLink href="/me/edit" icon={<Pencil className="size-3.5" />}>
            프로필 편집
          </ActionLink>
          <ActionLink href="/me/notifications" icon={<Bell className="size-3.5" />}>
            알림 설정
          </ActionLink>
        </div>
      </header>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(Object.keys(counts) as CollectionStatus[]).map((s) => (
          <StatCard key={s} href="/me/collection" label={COLLECTION_LABEL[s]} value={counts[s]} />
        ))}
        <StatCard
          href="/me/tastings"
          label="테이스팅"
          value={tastingCount ?? 0}
          accent
        />
      </div>

      {tasteProfile.total > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            내 취향 요약
          </h2>
          <TasteProfileChips
            profile={tasteProfile}
            emptyMessage="노트를 5개 이상 쌓으면 취향 태그가 자동으로 생겨요."
          />
        </section>
      )}

      <div className="mt-10 flex flex-wrap gap-3 text-sm">
        <Link
          href="/me/collection"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card/40 px-4 py-2 transition-colors hover:border-foreground/30 hover:bg-card"
        >
          <Library className="size-4" />
          내 컬렉션
        </Link>
        <Link
          href="/me/tastings"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card/40 px-4 py-2 transition-colors hover:border-foreground/30 hover:bg-card"
        >
          <NotebookPen className="size-4" />
          내 테이스팅 노트
        </Link>
        <Link
          href="/wrapped"
          className="inline-flex items-center gap-2 rounded-md border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-amber-200 transition-colors hover:bg-amber-400/20"
        >
          <Sparkles className="size-4" />
          이번 달 회고
        </Link>
      </div>
    </main>
  );
}

function ActionLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-foreground/75 transition-colors hover:border-foreground/30 hover:text-foreground"
    >
      {icon}
      {children}
    </Link>
  );
}

function StatCard({
  href,
  label,
  value,
  accent,
}: {
  href: string;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-card/40 p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-card"
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div
        className={
          "mt-2 font-serif text-3xl tabular-nums " + (accent ? "text-primary" : "text-foreground")
        }
      >
        {value}
      </div>
    </Link>
  );
}
