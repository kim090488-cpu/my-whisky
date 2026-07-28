import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  REPORT_REASON_LABEL, REPORT_STATUS_LABEL, REPORT_TARGET_LABEL,
} from "@/lib/reports/labels";
import { updateReportStatus as _updateReportStatus } from "@/lib/reports/actions";
import {
  hideTasting as _hideTasting,
  hideComment as _hideComment,
  suspendUser as _suspendUser,
} from "@/lib/admin/actions";
import type { ReportStatus, ReportTarget } from "@/types/database";

// React 19 form action은 void 반환을 요구 — 서버 액션은 {ok|error} 반환하므로 캐스팅.
type FormAction = (fd: FormData) => Promise<void>;
const hideTasting = _hideTasting as unknown as FormAction;
const hideComment = _hideComment as unknown as FormAction;
const suspendUser = _suspendUser as unknown as FormAction;
const updateReportStatus = _updateReportStatus as unknown as FormAction;

export const dynamic = "force-dynamic";

export const metadata = { title: "신고 큐 · my-whisky 관리" };

type SearchParams = Promise<{ status?: string }>;

const STATUS_TABS: { v: ReportStatus | "all"; l: string }[] = [
  { v: "open", l: "미처리" },
  { v: "in_progress", l: "진행 중" },
  { v: "resolved", l: "해결됨" },
  { v: "dismissed", l: "기각됨" },
  { v: "all", l: "전체" },
];

export default async function AdminReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const status = (sp.status ?? "open") as ReportStatus | "all";

  const supabase = await createClient();

  let q = supabase
    .from("reports")
    .select(
      "id, reporter_id, target_table, target_id, reason, body, status, resolved_by, resolved_at, resolution_note, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (status !== "all") q = q.eq("status", status);

  const { data: reports } = await q;

  // 신고자·대상 정보 묶기
  const reporterIds = Array.from(new Set((reports ?? []).map((r) => r.reporter_id)));
  const profilesById = new Map<string, { username: string; display_name: string | null }>();
  if (reporterIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", reporterIds);
    for (const p of profs ?? []) {
      profilesById.set(p.id, { username: p.username, display_name: p.display_name });
    }
  }

  // 대상 미리보기: tasting / comment / user 각각 fetch
  const tastingIds = (reports ?? []).filter((r) => r.target_table === "tasting").map((r) => r.target_id);
  const commentIds = (reports ?? []).filter((r) => r.target_table === "comment").map((r) => r.target_id);
  const userIds = (reports ?? []).filter((r) => r.target_table === "user").map((r) => r.target_id);

  const tastingsById = new Map<string, { id: string; notes: string | null; score: number | null; user_id: string }>();
  if (tastingIds.length > 0) {
    const { data } = await supabase
      .from("tastings")
      .select("id, notes, score, user_id")
      .in("id", tastingIds);
    for (const t of data ?? []) tastingsById.set(t.id, t);
  }

  const commentsById = new Map<string, { id: string; body: string; tasting_id: string; user_id: string }>();
  if (commentIds.length > 0) {
    const { data } = await supabase
      .from("tasting_comments")
      .select("id, body, tasting_id, user_id")
      .in("id", commentIds);
    for (const c of data ?? []) commentsById.set(c.id, c);
  }

  const targetUsersById = new Map<string, { id: string; username: string; display_name: string | null }>();
  if (userIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", userIds);
    for (const p of data ?? []) targetUsersById.set(p.id, p);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">신고 큐</h1>
      <p className="mt-1 text-sm text-neutral-500">컨텐츠·사용자 신고 처리</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.v}
            href={`/admin/reports?status=${t.v}`}
            className={
              "rounded-md border px-3 py-1.5 text-xs transition " +
              (status === t.v
                ? "border-amber-500 bg-amber-400/10 text-amber-200"
                : "border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200")
            }
          >
            {t.l}
          </Link>
        ))}
      </div>

      {!reports || reports.length === 0 ? (
        <div className="mt-8 rounded-md border border-neutral-800 bg-neutral-900/40 p-8 text-center text-sm text-neutral-500">
          {status === "open" ? "처리할 신고가 없어요." : "이 상태의 신고가 없어요."}
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {reports.map((r) => {
            const reporter = profilesById.get(r.reporter_id);
            const reporterName = reporter?.display_name ?? reporter?.username ?? "?";
            return (
              <li key={r.id} className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3 text-xs">
                  <div className="flex items-baseline gap-2">
                    <span className="rounded bg-red-900/40 px-2 py-0.5 font-medium text-red-300">
                      {REPORT_REASON_LABEL[r.reason]}
                    </span>
                    <span className="text-neutral-500">
                      {REPORT_TARGET_LABEL[r.target_table as ReportTarget]}
                    </span>
                    <span className="text-neutral-600">·</span>
                    <span className="text-neutral-500">
                      {new Date(r.created_at).toLocaleString("ko-KR")}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={"rounded px-2 py-0.5 " + statusBadge(r.status)}>
                      {REPORT_STATUS_LABEL[r.status]}
                    </span>
                    <span className="text-neutral-500">
                      reporter:{" "}
                      {reporter?.username ? (
                        <Link href={`/profile/${reporter.username}`} className="hover:text-amber-300">
                          {reporterName}
                        </Link>
                      ) : (
                        reporterName
                      )}
                    </span>
                  </div>
                </div>

                {r.body && (
                  <p className="mt-3 whitespace-pre-wrap rounded bg-neutral-900 p-2 text-sm text-neutral-200">
                    {r.body}
                  </p>
                )}

                <div className="mt-3 rounded-md border border-neutral-800 bg-neutral-900/60 p-3 text-sm">
                  <TargetPreview
                    target={r.target_table}
                    targetId={r.target_id}
                    tasting={tastingsById.get(r.target_id)}
                    comment={commentsById.get(r.target_id)}
                    user={targetUsersById.get(r.target_id)}
                  />
                </div>

                {r.status === "open" || r.status === "in_progress" ? (
                  <>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <ResolveForm reportId={r.id} status="in_progress" label="진행 중" />
                      <ResolveForm reportId={r.id} status="resolved" label="해결됨" />
                      <ResolveForm reportId={r.id} status="dismissed" label="기각" />
                    </div>
                    <ModerationActions
                      target={r.target_table}
                      targetId={r.target_id}
                      tastingOwnerId={tastingsById.get(r.target_id)?.user_id}
                      commentOwnerId={commentsById.get(r.target_id)?.user_id}
                      reportId={r.id}
                    />
                  </>
                ) : (
                  r.resolution_note && (
                    <p className="mt-2 text-xs text-neutral-500">
                      처리 메모: {r.resolution_note}
                    </p>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function statusBadge(s: ReportStatus): string {
  switch (s) {
    case "open": return "bg-red-900/40 text-red-300";
    case "in_progress": return "bg-amber-900/40 text-amber-300";
    case "resolved": return "bg-emerald-900/40 text-emerald-300";
    case "dismissed": return "bg-neutral-800 text-neutral-400";
  }
}

function ModerationActions({
  target, targetId, tastingOwnerId, commentOwnerId, reportId,
}: {
  target: ReportTarget;
  targetId: string;
  tastingOwnerId?: string;
  commentOwnerId?: string;
  reportId: string;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-800 pt-3 text-xs">
      <span className="text-neutral-500">즉시 조치:</span>

      {target === "tasting" && (
        <>
          <form action={hideTasting} className="inline">
            <input type="hidden" name="tasting_id" value={targetId} />
            <input type="hidden" name="report_id" value={reportId} />
            <input type="hidden" name="reason" value="신고 처리" />
            <button className="rounded-md border border-red-700/50 px-2.5 py-1 text-red-300 hover:border-red-500">
              노트 숨김
            </button>
          </form>
          {tastingOwnerId && (
            <form action={suspendUser} className="inline-flex items-center gap-1">
              <input type="hidden" name="user_id" value={tastingOwnerId} />
              <input type="hidden" name="report_id" value={reportId} />
              <input
                name="days"
                type="number"
                defaultValue={7}
                min={1}
                max={365}
                className="w-12 rounded border border-neutral-800 bg-neutral-950 px-1.5 py-1 text-[10px]"
                title="정지 일수"
              />
              <input
                name="reason"
                placeholder="사유"
                defaultValue="신고 처리"
                className="w-24 rounded border border-neutral-800 bg-neutral-950 px-1.5 py-1 text-[10px]"
              />
              <button className="rounded-md border border-red-700/50 px-2.5 py-1 text-red-300 hover:border-red-500">
                작성자 정지
              </button>
            </form>
          )}
        </>
      )}

      {target === "comment" && (
        <>
          <form action={hideComment} className="inline">
            <input type="hidden" name="comment_id" value={targetId} />
            <input type="hidden" name="report_id" value={reportId} />
            <input type="hidden" name="reason" value="신고 처리" />
            <button className="rounded-md border border-red-700/50 px-2.5 py-1 text-red-300 hover:border-red-500">
              댓글 숨김
            </button>
          </form>
          {commentOwnerId && (
            <form action={suspendUser} className="inline-flex items-center gap-1">
              <input type="hidden" name="user_id" value={commentOwnerId} />
              <input type="hidden" name="report_id" value={reportId} />
              <input
                name="days"
                type="number"
                defaultValue={3}
                min={1}
                max={365}
                className="w-12 rounded border border-neutral-800 bg-neutral-950 px-1.5 py-1 text-[10px]"
              />
              <input
                name="reason"
                placeholder="사유"
                defaultValue="신고 처리"
                className="w-24 rounded border border-neutral-800 bg-neutral-950 px-1.5 py-1 text-[10px]"
              />
              <button className="rounded-md border border-red-700/50 px-2.5 py-1 text-red-300 hover:border-red-500">
                작성자 정지
              </button>
            </form>
          )}
        </>
      )}

      {target === "user" && (
        <form action={suspendUser} className="inline-flex items-center gap-1">
          <input type="hidden" name="user_id" value={targetId} />
          <input type="hidden" name="report_id" value={reportId} />
          <input
            name="days"
            type="number"
            defaultValue={7}
            min={1}
            max={365}
            className="w-12 rounded border border-neutral-800 bg-neutral-950 px-1.5 py-1 text-[10px]"
          />
          <input
            name="reason"
            placeholder="사유"
            defaultValue="신고 처리"
            className="w-24 rounded border border-neutral-800 bg-neutral-950 px-1.5 py-1 text-[10px]"
          />
          <button className="rounded-md border border-red-700/50 px-2.5 py-1 text-red-300 hover:border-red-500">
            정지
          </button>
        </form>
      )}
    </div>
  );
}

function ResolveForm({ reportId, status, label }: { reportId: string; status: ReportStatus; label: string }) {
  return (
    <form action={updateReportStatus} className="inline">
      <input type="hidden" name="report_id" value={reportId} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className={
          "rounded-md border px-2.5 py-1 text-xs transition " +
          (status === "resolved"
            ? "border-emerald-700/50 text-emerald-300 hover:border-emerald-500"
            : status === "dismissed"
            ? "border-neutral-700 text-neutral-400 hover:border-neutral-500"
            : "border-amber-700/50 text-amber-300 hover:border-amber-500")
        }
      >
        {label}
      </button>
    </form>
  );
}

function TargetPreview({
  target, targetId, tasting, comment, user,
}: {
  target: ReportTarget;
  targetId: string;
  tasting?: { id: string; notes: string | null; score: number | null; user_id: string };
  comment?: { id: string; body: string; tasting_id: string; user_id: string };
  user?: { id: string; username: string; display_name: string | null };
}) {
  if (target === "tasting") {
    if (!tasting) return <span className="text-xs text-neutral-500">[삭제됨] {targetId}</span>;
    return (
      <div>
        <div className="text-xs text-neutral-500">
          노트 · 점수 {tasting.score ?? "—"} ·{" "}
          <Link href={`/tastings/${tasting.id}`} className="text-amber-300 hover:underline">
            보기 ↗
          </Link>
        </div>
        {tasting.notes && (
          <p className="mt-1 line-clamp-3 text-neutral-300">{tasting.notes}</p>
        )}
      </div>
    );
  }
  if (target === "comment") {
    if (!comment) return <span className="text-xs text-neutral-500">[삭제됨] {targetId}</span>;
    return (
      <div>
        <div className="text-xs text-neutral-500">
          댓글 ·{" "}
          <Link href={`/tastings/${comment.tasting_id}`} className="text-amber-300 hover:underline">
            상위 노트 보기 ↗
          </Link>
        </div>
        <p className="mt-1 line-clamp-3 text-neutral-300">{comment.body}</p>
      </div>
    );
  }
  if (target === "user") {
    if (!user) return <span className="text-xs text-neutral-500">[삭제됨] {targetId}</span>;
    return (
      <div className="text-xs">
        사용자 ·{" "}
        <Link href={`/profile/${user.username}`} className="text-amber-300 hover:underline">
          @{user.username}
          {user.display_name && ` (${user.display_name})`} ↗
        </Link>
      </div>
    );
  }
  return null;
}
