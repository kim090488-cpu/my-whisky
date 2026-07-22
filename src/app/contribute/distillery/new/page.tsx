import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DistilleryForm } from "./distillery-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "새 증류소 추가 · my-whisky" };

export default async function NewDistilleryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/contribute/distillery/new");

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <Link href="/distilleries" className="text-sm text-neutral-500 hover:text-neutral-300">
        ← 증류소 목록
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">새 증류소 추가</h1>
      <p className="mt-1 text-sm text-neutral-500">
        카탈로그에 없는 증류소를 직접 등록할 수 있어요. 잘못된 정보는 다른 사용자가 신고할 수 있습니다.
      </p>
      <div className="mt-8">
        <DistilleryForm />
      </div>
    </main>
  );
}
