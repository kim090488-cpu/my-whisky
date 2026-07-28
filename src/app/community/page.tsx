import Link from "next/link";
import { Plus, Search, MessageCircle, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadBlockedUserIds } from "@/lib/social/blocks";
import { Pagination } from "@/components/pagination";
import type { CommunityCategory } from "@/lib/community/actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "커뮤니티 · my-whisky",
  description: "위스키 관련 질문·추천·팁·잡담을 자유롭게 나누는 게시판.",
};

const CATEGORIES = [
  { v: "all", label: "전체" },
  { v: "question", label: "질문" },
  { v: "recommendation", label: "추천" },
  { v: "tip", label: "팁" },
  { v: "free", label: "잡담" },
] as const;
type CatFilter = (typeof CATEGORIES)[number]["v"];

const CATEGORY_META: Record<CommunityCategory, { label: string; badgeClass: string }> = {
  question: { label: "질문", badgeClass: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  recommendation: { label: "추천", badgeClass: "bg-amber-400/15 text-amber-200 border-amber-400/30" },
  tip: { label: "팁", badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  free: { label: "잡담", badgeClass: "bg-neutral-500/15 text-neutral-300 border-neutral-500/30" },
};

const PAGE_SIZE = 20;

type SearchParams = Promise<{ page?: string; cat?: string; q?: string }>;

type PostRow = {
  id: string;
  user_id: string;
  category: CommunityCategory;
  title: string;
  body: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
};

type MatchKind = "title" | "body" | "comment";

function isEdited(created: string, updated: string) {
  const c = new Date(created).getTime();
  const u = new Date(updated).getTime();
  return u - c > 5_000;
}

export default async function CommunityListPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const catRaw = String(sp.cat ?? "all");
  const cat: CatFilter = (CATEGORIES.some((c) => c.v === catRaw) ? catRaw : "all") as CatFilter;
  const q = String(sp.q ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const blockedIds = await loadBlockedUserIds(supabase, user?.id ?? null);

  let items: Array<PostRow & { match?: MatchKind }> = [];
  let total = 0;

  if (q.length > 0) {
    // 검색 모드: title/body ilike + comment 매칭 → union
    const safe = q.replace(/[%_\\]/g, (m) => `\\${m}`);
    const pattern = `%${safe}%`;

    const [postsRes, commentsRes] = await Promise.all([
      supabase
        .from("community_posts")
        .select("id, user_id, category, title, body, like_count, comment_count, created_at, updated_at")
        .or(`title.ilike.${pattern},body.ilike.${pattern}`)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("community_post_comments")
        .select("post_id")
        .ilike("body", pattern)
        .limit(200),
    ]);

    const tbRows = ((postsRes.data ?? []) as unknown as PostRow[]);
    const titleMatch = new Set<string>();
    const bodyMatch = new Set<string>();
    const qLower = q.toLowerCase();
    for (const p of tbRows) {
      if (p.title.toLowerCase().includes(qLower)) titleMatch.add(p.id);
      else if (p.body.toLowerCase().includes(qLower)) bodyMatch.add(p.id);
    }

    const commentPostIds = Array.from(
      new Set(((commentsRes.data ?? []) as Array<{ post_id: string }>).map((c) => c.post_id)),
    );
    const missingIds = commentPostIds.filter((id) => !tbRows.some((p) => p.id === id));
    let extraRows: PostRow[] = [];
    if (missingIds.length > 0) {
      const { data } = await supabase
        .from("community_posts")
        .select("id, user_id, category, title, body, like_count, comment_count, created_at, updated_at")
        .in("id", missingIds);
      extraRows = ((data ?? []) as unknown as PostRow[]);
    }

    let all = [...tbRows, ...extraRows];
    if (cat !== "all") all = all.filter((p) => p.category === cat);
    if (blockedIds.size > 0) all = all.filter((p) => !blockedIds.has(p.user_id));

    const commentSet = new Set(commentPostIds);
    items = all.map((r) => ({
      ...r,
      match: titleMatch.has(r.id)
        ? "title"
        : bodyMatch.has(r.id)
          ? "body"
          : commentSet.has(r.id)
            ? "comment"
            : "title",
    }));
    total = items.length;
  } else {
    let listQ = supabase
      .from("community_posts")
      .select(
        "id, user_id, category, title, body, like_count, comment_count, created_at, updated_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });
    if (cat !== "all") listQ = listQ.eq("category", cat);
    if (blockedIds.size > 0) {
      listQ = listQ.not("user_id", "in", `(${Array.from(blockedIds).join(",")})`);
    }
    const { data, count } = await listQ.range(offset, offset + PAGE_SIZE - 1);
    items = ((data ?? []) as unknown as PostRow[]);
    total = count ?? 0;
  }

  const userIds = Array.from(new Set(items.map((i) => i.user_id)));
  const profById = new Map<string, { username: string; display_name: string | null }>();
  if (userIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", userIds);
    for (const p of (data ?? []) as Array<{ id: string; username: string; display_name: string | null }>) {
      profById.set(p.id, { username: p.username, display_name: p.display_name });
    }
  }

  const currentSearchParams = new URLSearchParams();
  if (cat !== "all") currentSearchParams.set("cat", cat);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">커뮤니티</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            질문·추천·팁·잡담 자유롭게 · {total.toLocaleString()}개
          </p>
        </div>
        {user && (
          <Link
            href="/community/new"
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-medium text-neutral-950 transition-colors hover:bg-amber-300"
          >
            <Plus className="size-3.5" />새 글
          </Link>
        )}
      </header>

      {/* 검색 폼 */}
      <form
        method="GET"
        action="/community"
        className="mb-4 flex items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2"
      >
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="제목 · 본문 · 댓글 검색"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
        {cat !== "all" && <input type="hidden" name="cat" value={cat} />}
        <button
          type="submit"
          className="rounded-md bg-secondary/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          검색
        </button>
      </form>

      {/* 카테고리 필터 */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => {
          const qs = new URLSearchParams();
          if (c.v !== "all") qs.set("cat", c.v);
          if (q) qs.set("q", q);
          const href = "/community" + (qs.toString() ? `?${qs.toString()}` : "");
          const active = cat === c.v;
          return (
            <Link
              key={c.v}
              href={href}
              className={
                "rounded-full border px-3 py-1 text-xs transition-colors " +
                (active
                  ? "border-amber-400 bg-amber-400/10 text-amber-300 font-medium"
                  : "border-border bg-card/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground")
              }
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/40 p-12 text-center text-sm text-muted-foreground">
          {q ? `"${q}" 검색 결과가 없어요.` : "아직 등록된 게시글이 없어요."}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => {
            const prof = profById.get(p.user_id);
            const authorName = prof?.display_name ?? prof?.username ?? "익명";
            const meta = CATEGORY_META[p.category];
            return (
              <li key={p.id}>
                <Link
                  href={`/community/${p.id}`}
                  className="block rounded-xl border border-border bg-card/50 p-4 transition-colors hover:border-foreground/20 hover:bg-card"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={
                        "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold " + meta.badgeClass
                      }
                    >
                      {meta.label}
                    </span>
                    {p.match && (
                      <span className="italic text-amber-300">
                        {p.match === "title" ? "제목 매칭" : p.match === "body" ? "본문 매칭" : "댓글 매칭"}
                      </span>
                    )}
                    <span className="ml-auto text-muted-foreground">{authorName}</span>
                    <span className="text-muted-foreground/70">· {p.created_at.slice(0, 10)}</span>
                    {isEdited(p.created_at, p.updated_at) && (
                      <span className="italic text-muted-foreground/70">수정됨</span>
                    )}
                  </div>
                  <h2 className="mt-2 line-clamp-2 text-[15px] font-semibold text-foreground">
                    {p.title}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.body}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="size-3" />
                      {p.like_count}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="size-3" />
                      {p.comment_count}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {q.length === 0 && (
        <Pagination
          basePath="/community"
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          currentSearchParams={currentSearchParams}
        />
      )}
    </main>
  );
}
