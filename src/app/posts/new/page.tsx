import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PostForm } from "./post-form";

export const metadata = {
  title: "새 모먼트 · my-whisky",
};

type SearchParams = Promise<{ bottling?: string }>;

export default async function NewPostPage({ searchParams }: { searchParams: SearchParams }) {
  const { bottling } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/posts/new");

  // 보틀 태그 prefill (whiskies/[id]에서 진입한 경우)
  let prefillBottling: { id: string; name: string; name_kr: string | null; distillery_name: string; distillery_name_kr: string | null } | null = null;
  if (bottling) {
    const { data: b } = await supabase
      .from("bottling_card_stats")
      .select("id, name, name_kr, distillery_name, distillery_name_kr")
      .eq("id", bottling)
      .maybeSingle();
    if (b) prefillBottling = {
      id: b.id!,
      name: b.name!,
      name_kr: b.name_kr,
      distillery_name: b.distillery_name!,
      distillery_name_kr: b.distillery_name_kr,
    };
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link
        href="/me"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        내 페이지
      </Link>

      <h1 className="mt-6 font-serif text-3xl tracking-tight">새 모먼트</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        지금 마시는 한 잔, 바에 갔던 순간 — 정식 후기는 아니지만 남기고 싶은 기억.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-card/40 p-6">
        <PostForm userId={user.id} prefillBottling={prefillBottling} />
      </div>
    </main>
  );
}
