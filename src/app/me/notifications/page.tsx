import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NotificationSettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "알림 설정 · my-whisky",
};

export default async function NotificationSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/me/notifications");

  const { data: profile } = await supabase
    .from("profiles")
    .select("notify_like, notify_comment, notify_follow")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <Link href="/me" className="text-sm text-muted-foreground hover:text-foreground">
        ← 내 페이지
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">알림 설정</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        받을 알림 종류를 선택할 수 있어요. 끄면 새 알림이 만들어지지 않아요.
      </p>

      <div className="mt-8">
        <NotificationSettingsForm
          initial={{
            notify_like: profile?.notify_like ?? true,
            notify_comment: profile?.notify_comment ?? true,
            notify_follow: profile?.notify_follow ?? true,
          }}
        />
      </div>
    </main>
  );
}
