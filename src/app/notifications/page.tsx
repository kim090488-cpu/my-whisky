import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart, MessageCircle, UserPlus, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "알림 · my-whisky",
};

const PAGE_SIZE = 20;

type NotificationRow = {
  id: string;
  user_id: string;
  kind: "like" | "comment" | "follow";
  actor_id: string | null;
  target_table: string | null;
  target_id: string | null;
  payload: { tasting_id?: string; comment_id?: string; body?: string; reply_to?: string } | null;
  read_at: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Tasting = {
  id: string;
  bottling_id: string;
};

type BottlingLite = {
  id: string;
  name: string;
  name_kr: string | null;
  distillery_name: string;
  distillery_name_kr: string | null;
};

const KINDS = ["all", "like", "comment", "follow"] as const;
type KindFilter = (typeof KINDS)[number];
const KIND_LABEL: Record<KindFilter, string> = {
  all: "전체",
  like: "좋아요",
  comment: "댓글",
  follow: "팔로우",
};

type SearchParams = Promise<{ page?: string; kind?: string }>;

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const kind: KindFilter = KINDS.includes(sp.kind as KindFilter) ? (sp.kind as KindFilter) : "all";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/notifications");

  let listQuery = supabase
    .from("notifications")
    .select(
      "id, user_id, kind, actor_id, target_table, target_id, payload, read_at, created_at",
      { count: "exact" },
    );
  if (kind !== "all") listQuery = listQuery.eq("kind", kind);
  const { data: rowsRaw, count } = await listQuery
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const rows = (rowsRaw ?? []) as unknown as NotificationRow[];
  const total = count ?? 0;
  const unreadIdsAtLoad = new Set(rows.filter((r) => !r.read_at).map((r) => r.id));

  const actorIds = Array.from(
    new Set(rows.map((r) => r.actor_id).filter((v): v is string => !!v)),
  );
  const actorsById = new Map<string, Profile>();
  if (actorIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", actorIds);
    for (const p of (data ?? []) as unknown as Profile[]) actorsById.set(p.id, p);
  }

  const tastingIdSet = new Set<string>();
  for (const r of rows) {
    if (r.kind === "like" && r.target_id) tastingIdSet.add(r.target_id);
    if (r.kind === "comment") {
      const t = r.payload?.tasting_id;
      if (typeof t === "string") tastingIdSet.add(t);
    }
  }
  const tastingsById = new Map<string, Tasting>();
  if (tastingIdSet.size > 0) {
    const { data } = await supabase
      .from("tastings")
      .select("id, bottling_id")
      .in("id", Array.from(tastingIdSet));
    for (const t of (data ?? []) as unknown as Tasting[]) tastingsById.set(t.id, t);
  }

  const bottlingIdSet = new Set<string>();
  for (const t of tastingsById.values()) bottlingIdSet.add(t.bottling_id);
  const bottlingsById = new Map<string, BottlingLite>();
  if (bottlingIdSet.size > 0) {
    const { data } = await supabase
      .from("bottling_card_stats")
      .select("id, name, name_kr, distillery_name, distillery_name_kr")
      .in("id", Array.from(bottlingIdSet));
    for (const b of (data ?? []) as unknown as BottlingLite[]) {
      if (b.id) bottlingsById.set(b.id, b);
    }
  }

  // 방문 = 미읽음 → 읽음. RLS 로 자기 것만.
  if (unreadIdsAtLoad.size > 0) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">알림</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {KIND_LABEL[kind]} · {total.toLocaleString()}개
          </p>
        </div>
        <Link
          href="/me/notifications"
          aria-label="알림 설정"
          className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs text-foreground/75 transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <Settings className="size-3.5" />
          설정
        </Link>
      </header>

      <nav className="mb-4 flex gap-1 overflow-x-auto text-sm">
        {KINDS.map((k) => {
          const active = k === kind;
          const href = k === "all" ? "/notifications" : `/notifications?kind=${k}`;
          return (
            <Link
              key={k}
              href={href}
              className={
                "shrink-0 rounded-full px-3 py-1.5 transition-colors " +
                (active
                  ? "bg-foreground text-background"
                  : "border border-border bg-card/40 text-foreground/70 hover:border-foreground/30 hover:bg-card")
              }
            >
              {KIND_LABEL[k]}
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/40 p-12 text-center text-sm text-muted-foreground">
          {kind === "all"
            ? "아직 도착한 알림이 없어요."
            : `${KIND_LABEL[kind]} 알림이 없어요.`}
        </div>
      ) : (
        <ul className="divide-y divide-border/60 rounded-2xl border border-border bg-card/40">
          {rows.map((n) => {
            const actor = n.actor_id ? actorsById.get(n.actor_id) ?? null : null;
            const wasUnread = unreadIdsAtLoad.has(n.id);
            return (
              <li key={n.id}>
                <NotificationItem
                  row={n}
                  actor={actor}
                  tastingsById={tastingsById}
                  bottlingsById={bottlingsById}
                  wasUnread={wasUnread}
                />
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        basePath="/notifications"
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        currentSearchParams={(() => {
          const p = new URLSearchParams();
          if (kind !== "all") p.set("kind", kind);
          return p;
        })()}
      />
    </main>
  );
}

function NotificationItem({
  row,
  actor,
  tastingsById,
  bottlingsById,
  wasUnread,
}: {
  row: NotificationRow;
  actor: Profile | null;
  tastingsById: Map<string, Tasting>;
  bottlingsById: Map<string, BottlingLite>;
  wasUnread: boolean;
}) {
  const actorName = actor?.display_name || actor?.username || "누군가";

  const { href, message, bottlingLine, Icon, tint } = buildContent({
    row,
    actorName,
    actor,
    tastingsById,
    bottlingsById,
  });

  return (
    <Link
      href={href}
      className={
        "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-foreground/5 " +
        (wasUnread ? "bg-amber-500/[0.06]" : "")
      }
    >
      <div className="relative shrink-0">
        <Avatar name={actorName} avatarUrl={actor?.avatar_url ?? null} size={40} />
        <span
          className={
            "absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-background " +
            tint
          }
        >
          <Icon className="h-3 w-3 text-white" strokeWidth={2.5} />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-foreground/90">{message}</p>
        {bottlingLine && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{bottlingLine}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground/70">{formatTime(row.created_at)}</p>
      </div>

      {wasUnread && (
        <span
          aria-hidden
          className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-500"
        />
      )}
    </Link>
  );
}

function buildContent({
  row,
  actorName,
  actor,
  tastingsById,
  bottlingsById,
}: {
  row: NotificationRow;
  actorName: string;
  actor: Profile | null;
  tastingsById: Map<string, Tasting>;
  bottlingsById: Map<string, BottlingLite>;
}) {
  if (row.kind === "like") {
    const tastingId = row.target_id ?? row.payload?.tasting_id ?? null;
    const tasting = tastingId ? tastingsById.get(tastingId) : null;
    const bottling = tasting ? bottlingsById.get(tasting.bottling_id) : null;
    return {
      href: tastingId ? `/tastings/${tastingId}` : "/notifications",
      message: (
        <>
          <strong className="font-medium">{actorName}</strong>님이 회원님의 노트를 좋아합니다.
        </>
      ),
      bottlingLine: bottling ? formatBottlingLabel(bottling) : null,
      Icon: Heart,
      tint: "bg-rose-500",
    } as const;
  }

  if (row.kind === "comment") {
    const tastingId = row.payload?.tasting_id ?? row.target_id ?? null;
    const commentId = row.payload?.comment_id ?? null;
    const tasting = tastingId ? tastingsById.get(tastingId) : null;
    const bottling = tasting ? bottlingsById.get(tasting.bottling_id) : null;
    const isReply = !!row.payload?.reply_to;
    const body = row.payload?.body ?? "";
    return {
      href: tastingId
        ? commentId
          ? `/tastings/${tastingId}#comment-${commentId}`
          : `/tastings/${tastingId}`
        : "/notifications",
      message: (
        <>
          <strong className="font-medium">{actorName}</strong>님이 회원님의{" "}
          {isReply ? "댓글" : "노트"}에 댓글을 남겼습니다
          {body ? <>: <span className="text-muted-foreground">“{body}”</span></> : null}
        </>
      ),
      bottlingLine: bottling ? formatBottlingLabel(bottling) : null,
      Icon: MessageCircle,
      tint: "bg-sky-500",
    } as const;
  }

  // follow
  return {
    href: actor?.username ? `/profile/${actor.username}` : "/notifications",
    message: (
      <>
        <strong className="font-medium">{actorName}</strong>님이 회원님을 팔로우했습니다.
      </>
    ),
    bottlingLine: actor?.username ? `@${actor.username}` : null,
    Icon: UserPlus,
    tint: "bg-emerald-500",
  } as const;
}

function formatBottlingLabel(b: BottlingLite): string {
  const dist = b.distillery_name_kr || b.distillery_name;
  const name = b.name_kr || b.name;
  return `${dist} · ${name}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  return d.toISOString().slice(0, 10);
}
