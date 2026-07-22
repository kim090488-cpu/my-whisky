import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottlingForm } from "./bottling-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "새 보틀링 추가 · my-whisky" };

type SearchParams = Promise<{ distillery_id?: string }>;

export default async function NewBottlingPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const preselect = sp.distillery_id ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/contribute/bottling/new${preselect ? `?distillery_id=${preselect}` : ""}`);

  // 증류소 목록 (~57개 → 단순 select)
  const { data: distilleries } = await supabase
    .from("distilleries")
    .select("id, name, name_kr, country, region")
    .order("country")
    .order("name");

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <Link href="/whiskies" className="text-sm text-neutral-500 hover:text-neutral-300">
        ← 위스키 카탈로그
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">새 보틀링 추가</h1>
      <p className="mt-1 text-sm text-neutral-500">
        증류소가 카탈로그에 없으면 먼저{" "}
        <Link href="/contribute/distillery/new" className="text-amber-300 hover:underline">
          증류소 등록
        </Link>
        부터.
      </p>
      <div className="mt-8">
        <BottlingForm distilleries={distilleries ?? []} preselectId={preselect} />
      </div>
    </main>
  );
}
