import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CommunityPostForm, type CommunityFormInitial } from "./community-post-form";
import type { CommunityCategory } from "@/lib/community/actions";

export const metadata = {
  title: "새 게시글 · 커뮤니티 · my-whisky",
};

type SearchParams = Promise<{ edit?: string }>;

export default async function NewCommunityPostPage({ searchParams }: { searchParams: SearchParams }) {
  const { edit } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/community/new${edit ? `?edit=${edit}` : ""}`);

  let initial: CommunityFormInitial | null = null;
  const editId = edit && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(edit)
    ? edit
    : null;

  if (editId) {
    const { data } = await supabase
      .from("community_posts")
      .select("id, user_id, category, title, body")
      .eq("id", editId)
      .maybeSingle();
    const p = data as unknown as {
      id: string;
      user_id: string;
      category: CommunityCategory;
      title: string;
      body: string;
    } | null;
    if (!p) redirect("/community");
    if (p.user_id !== user.id) redirect(`/community/${editId}`);
    initial = { id: p.id, category: p.category, title: p.title, body: p.body };
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link
        href={editId ? `/community/${editId}` : "/community"}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        {editId ? "게시글" : "커뮤니티"}
      </Link>

      <h1 className="mt-6 font-serif text-3xl tracking-tight">
        {editId ? "게시글 수정" : "새 게시글"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        위스키 관련 무엇이든 자유롭게 남겨보세요.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-card/40 p-6">
        <CommunityPostForm initial={initial} />
      </div>
    </main>
  );
}
