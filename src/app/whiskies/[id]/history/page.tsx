import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EditCard, type EditRow } from "./edit-card";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ sort?: string }>;

export const metadata = { title: "수정 이력 · my-whisky" };

const SORTS = [
  { value: "recent", label: "최근" },
  { value: "liked", label: "추천 많은 순" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

export default async function BottlingHistoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const sort: Sort = SORTS.some((o) => o.value === sp.sort)
    ? (sp.sort as Sort)
    : "recent";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: bottling } = await supabase
    .from("bottlings")
    .select(
      "id, name, name_kr, distillery_id, age_years, abv, vintage_year, bottling_year, cask_type, bottler, bottler_name, bottle_size_ml, total_bottles, notes",
    )
    .eq("id", id)
    .maybeSingle();
  if (!bottling) notFound();

  // 시간순으로 가져와서 before→after 매핑 후 정렬
  const { data: edits } = await supabase
    .from("bottling_edits")
    .select("id, edited_by, edited_at, before, like_count")
    .eq("bottling_id", id)
    .order("edited_at", { ascending: false })
    .limit(100);

  const items = edits ?? [];
  const editorIds = Array.from(
    new Set(items.map((e) => e.edited_by).filter((v): v is string => !!v)),
  );
  const profilesById = new Map<
    string,
    { username: string; display_name: string | null; avatar_url: string | null }
  >();
  if (editorIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", editorIds);
    for (const p of data ?? []) {
      profilesById.set(p.id, {
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
      });
    }
  }

  const myLikedIds = new Set<string>();
  if (user && items.length > 0) {
    const { data } = await supabase
      .from("bottling_edit_likes")
      .select("edit_id")
      .eq("user_id", user.id)
      .in("edit_id", items.map((e) => e.id));
    for (const l of data ?? []) myLikedIds.add(l.edit_id);
  }

  const current = bottling as unknown as Record<string, unknown>;

  // after 매핑은 항상 시간순 기준 (i=0 가장 최근)
  const rowsByTime: EditRow[] = items.map((e, i) => ({
    id: e.id,
    edited_at: e.edited_at,
    editor: e.edited_by ? profilesById.get(e.edited_by) ?? null : null,
    before: e.before as Record<string, unknown>,
    after:
      i === 0
        ? current
        : (items[i - 1].before as Record<string, unknown>),
    like_count: e.like_count ?? 0,
    liked: myLikedIds.has(e.id),
  }));

  const rows =
    sort === "liked"
      ? [...rowsByTime].sort((a, b) => {
          if (b.like_count !== a.like_count) return b.like_count - a.like_count;
          return a.edited_at < b.edited_at ? 1 : -1;
        })
      : rowsByTime;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href={`/whiskies/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        보틀링으로
      </Link>

      <header className="mt-4 mb-4">
        <h1 className="font-serif text-2xl tracking-tight">수정 이력</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {bottling.name_kr ?? bottling.name} · 총 {rows.length}건 · 정확한 정정에 추천을 눌러주세요
        </p>
      </header>

      <nav className="mb-4 flex gap-1 rounded-md border border-border bg-card/40 p-1 text-xs">
        {SORTS.map((o) => (
          <Link
            key={o.value}
            href={`/whiskies/${id}/history${o.value === "recent" ? "" : `?sort=${o.value}`}`}
            className={[
              "rounded px-3 py-1.5 transition-colors",
              sort === o.value
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {o.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          아직 수정 이력이 없어요.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <EditCard
              key={row.id}
              edit={row}
              bottlingId={id}
              loginHref={`/login?next=/whiskies/${id}/history`}
              isLoggedIn={!!user}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
