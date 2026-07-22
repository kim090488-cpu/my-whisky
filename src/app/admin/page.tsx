import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "관리 · my-whisky" };

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [profilesC, distilleriesC, bottlingsC, tastingsC, commentsC, likesC, pricesC] =
    await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("distilleries").select("*", { count: "exact", head: true }),
      supabase.from("bottlings").select("*", { count: "exact", head: true }),
      supabase.from("tastings").select("*", { count: "exact", head: true }),
      supabase.from("tasting_comments").select("*", { count: "exact", head: true }),
      supabase.from("tasting_likes").select("*", { count: "exact", head: true }),
      supabase.from("price_records").select("*", { count: "exact", head: true }),
    ]);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const [
    newProfilesC, newTastingsC, openReportsC, suspendedC, hiddenTastingsC, hiddenCommentsC,
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).gt("created_at", since),
    supabase.from("tastings").select("*", { count: "exact", head: true }).gt("created_at", since),
    supabase.from("reports").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    supabase.from("profiles").select("*", { count: "exact", head: true }).gt("suspended_until", nowIso),
    supabase.from("tastings").select("*", { count: "exact", head: true }).not("hidden_at", "is", null),
    supabase.from("tasting_comments").select("*", { count: "exact", head: true }).not("hidden_at", "is", null),
  ]);

  // 최근 admin 액션 10개
  const { data: actions } = await supabase
    .from("admin_actions")
    .select("id, admin_id, action, target_table, target_id, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  const adminIds = Array.from(new Set((actions ?? []).map((a) => a.admin_id)));
  const adminsById = new Map<string, { username: string; display_name: string | null }>();
  if (adminIds.length > 0) {
    const { data: admins } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", adminIds);
    for (const a of admins ?? []) adminsById.set(a.id, a);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">대시보드</h1>
      <p className="mt-1 text-sm text-neutral-500">my-whisky 전체 상태</p>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">데이터</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="사용자" value={profilesC.count ?? 0} />
          <Stat label="증류소" value={distilleriesC.count ?? 0} />
          <Stat label="보틀링" value={bottlingsC.count ?? 0} />
          <Stat label="테이스팅" value={tastingsC.count ?? 0} />
          <Stat label="댓글" value={commentsC.count ?? 0} />
          <Stat label="좋아요" value={likesC.count ?? 0} />
          <Stat label="시세 제보" value={pricesC.count ?? 0} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">최근 7일</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="신규 가입" value={newProfilesC.count ?? 0} accent />
          <Stat label="신규 노트" value={newTastingsC.count ?? 0} accent />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">모더레이션</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link
            href="/admin/reports?status=open"
            className={
              "rounded-lg border p-4 transition " +
              ((openReportsC.count ?? 0) > 0
                ? "border-red-900/50 bg-red-950/30 hover:border-red-700"
                : "border-neutral-800 bg-neutral-900/40 hover:border-neutral-600")
            }
          >
            <div className="text-xs uppercase tracking-wide text-neutral-500">미처리 신고</div>
            <div className={"mt-1 text-2xl font-semibold " + ((openReportsC.count ?? 0) > 0 ? "text-red-300" : "")}>
              {(openReportsC.count ?? 0).toLocaleString()}
            </div>
          </Link>
          <Link
            href="/admin/users?suspended=1"
            className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 hover:border-neutral-600"
          >
            <div className="text-xs uppercase tracking-wide text-neutral-500">정지된 사용자</div>
            <div className="mt-1 text-2xl font-semibold">{(suspendedC.count ?? 0).toLocaleString()}</div>
          </Link>
          <Stat label="숨김 노트" value={hiddenTastingsC.count ?? 0} />
          <Stat label="숨김 댓글" value={hiddenCommentsC.count ?? 0} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">최근 관리 액션</h2>
        {!actions || actions.length === 0 ? (
          <p className="rounded-md border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-500">
            아직 기록된 액션이 없어요.
          </p>
        ) : (
          <ul className="space-y-1 text-xs">
            {actions.map((a) => {
              const admin = adminsById.get(a.admin_id);
              return (
                <li key={a.id} className="rounded-md border border-neutral-900 bg-neutral-950 px-3 py-2 text-neutral-400">
                  <span className="text-neutral-600">{new Date(a.created_at).toLocaleString("ko-KR")}</span>
                  {" · "}
                  <span className="text-amber-300">{admin?.display_name ?? admin?.username ?? "?"}</span>
                  {" → "}
                  <span className="text-neutral-200">{a.action}</span>
                  {a.target_id && ` · ${a.target_table}:${a.target_id.slice(0, 8)}`}
                  {a.reason && <span className="ml-1 text-neutral-500">({a.reason})</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={"mt-1 text-2xl font-semibold " + (accent ? "text-amber-300" : "")}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
