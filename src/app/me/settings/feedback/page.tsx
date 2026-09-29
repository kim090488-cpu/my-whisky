import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FeedbackForm } from "./feedback-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "문의·건의" };

export default async function FeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/me/settings/feedback");

  const { data: recent } = await supabase
    .from("feedback")
    .select("id, category, subject, status, admin_note, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);
  const list = recent ?? [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:py-14">
      <nav className="mb-6 text-xs text-muted-foreground">
        <Link href="/me" className="hover:text-foreground">내 프로필</Link>{" "}· 문의·건의
      </nav>

      <h1 className="font-serif text-3xl tracking-tight">문의·건의</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        서비스 사용 중 불편한 점이나 아이디어가 있다면 알려주세요. 관리자만 확인할 수 있습니다.
      </p>

      <section className="mt-8">
        <FeedbackForm />
      </section>

      {list.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            최근 접수 내역
          </h2>
          <ul className="space-y-2">
            {list.map((f) => (
              <li
                key={f.id}
                className="rounded-lg border border-border bg-card/40 p-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                  <div className="flex items-baseline gap-2">
                    <span className={"rounded px-2 py-0.5 font-medium " + categoryBadge(f.category)}>
                      {categoryLabel(f.category)}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(f.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <span className={"rounded px-2 py-0.5 " + statusBadge(f.status)}>
                    {statusLabel(f.status)}
                  </span>
                </div>
                <div className="mt-2 font-medium">{f.subject}</div>
                {f.admin_note && (
                  <div className="mt-2 rounded border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-400">
                      관리자 답변
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-emerald-100/90">{f.admin_note}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function categoryLabel(c: string): string {
  switch (c) {
    case "bug": return "버그";
    case "suggestion": return "건의";
    case "question": return "질문";
    default: return "기타";
  }
}
function categoryBadge(c: string): string {
  switch (c) {
    case "bug": return "bg-rose-500/15 text-rose-300";
    case "suggestion": return "bg-amber-500/15 text-amber-300";
    case "question": return "bg-sky-500/15 text-sky-300";
    default: return "bg-neutral-800 text-neutral-300";
  }
}
function statusLabel(s: string): string {
  switch (s) {
    case "open": return "접수됨";
    case "in_progress": return "확인 중";
    case "resolved": return "해결됨";
    default: return s;
  }
}
function statusBadge(s: string): string {
  switch (s) {
    case "open": return "bg-rose-500/15 text-rose-300";
    case "in_progress": return "bg-amber-500/15 text-amber-300";
    case "resolved": return "bg-emerald-500/15 text-emerald-300";
    default: return "bg-neutral-800 text-neutral-300";
  }
}
