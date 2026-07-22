import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileEditForm } from "./profile-edit-form";

export const dynamic = "force-dynamic";

export default async function MeEditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/me/edit");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, bio")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <Link href="/me" className="text-sm text-neutral-500 hover:text-neutral-300">
        ← 내 페이지
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">프로필 편집</h1>
      <p className="mt-1 text-sm text-neutral-500">
        username은 공개 프로필 URL이 돼요 (예: <span className="text-neutral-300">/profile/&lt;username&gt;</span>).
      </p>

      <div className="mt-8">
        <ProfileEditForm
          initial={{
            username: profile?.username ?? "",
            display_name: profile?.display_name ?? "",
            bio: profile?.bio ?? "",
          }}
        />
      </div>
    </main>
  );
}
