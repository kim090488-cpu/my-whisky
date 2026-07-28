import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CuratorChat } from "./curator-chat";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI 큐레이터 · my-whisky",
  description: "예산·취향·용도를 알려주면 맞춤 위스키를 추천해드립니다.",
};

export default async function CuratorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/curator");

  return (
    <main className="mx-auto flex h-[calc(100vh-56px)] max-w-3xl flex-col px-4 sm:px-6">
      <header className="border-b border-border/60 py-4">
        <h1 className="font-serif text-2xl tracking-tight">AI 큐레이터</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          예산·취향·용도를 알려주면 카탈로그에서 맞춤 추천을 도와드려요.
        </p>
      </header>
      <CuratorChat userId={user.id} />
    </main>
  );
}
