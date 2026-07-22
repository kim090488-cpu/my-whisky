import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NoteStarter } from "./note-starter";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "노트 작성 · my-whisky",
};

export default async function NewTastingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/tastings/new");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/tastings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        노트
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="font-serif text-3xl tracking-tight">노트 작성</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          위스키를 골라서 후기를 남겨주세요.
        </p>
      </header>

      <NoteStarter userId={user.id} />
    </main>
  );
}
