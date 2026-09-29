import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { updateFeedbackStatus as _updateFeedbackStatus, type FeedbackStatus } from "@/lib/feedback/actions";

type FormAction = (fd: FormData) => Promise<void>;
const updateFeedbackStatus = _updateFeedbackStatus as unknown as FormAction;

export const dynamic = "force-dynamic";
export const metadata = { title: "문의·건의 · my-whisky 관리" };

type Category = "bug" | "suggestion" | "question" | "other";

const CATEGORY_LABEL: Record<Category, string> = {
  bug: "버그",
  suggestion: "건의",
  question: "질문",
  other: "기타",
};

const CATEGORY_BADGE: Record<Category, string> = {
  bug: "bg-rose-900/40 text-rose-300",
  suggestion: "bg-amber-900/40 text-amber-300",
  question: "bg-sky-900/40 text-sky-300",
  other: "bg-neutral-800 text-neutral-300",
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  open: "미처리",
  in_progress: "진행 중",
  resolved: "해결됨",
};

const STATUS_TABS: { v: FeedbackStatus | "all"; l: string }[] = [
  { v: "open", l: "미처리" },
  { v: "in_progress", l: "진행 중" },
  { v: "resolved", l: "해결됨" },
  { v: "all", l: "전체" },
];

type SearchParams = Promise<{ status?: string; category?: string }>;

export default async function AdminFeedbackPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const status = (sp.status ?? "open") as FeedbackStatus | "all";
  const category = sp.category as Category | undefined;

  const supabase = await createClient();

  let q = supabase
    .from("feedback")
    .select("id, user_id, category, subject, body, status, admin_note, app_version, platform, created_at, resolved_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status !== "all") q = q.eq("status", status);
  if (category) q = q.eq("category", category);

  const { data: rows } = await q;
  const list = rows ?? [];

  const userIds = Array.from(new Set(list.map((r) => r.user_id)));
  const profilesById = new Map<string, { username: string; display_name: string | null; email?: string | null }>();
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", userIds);
    for (const p of (profs ?? []) as Array<{ id: string; username: string; display_name: string | null }>) {
      profilesById.set(p.id, { username: p.username, display_name: p.display_name });
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">문의·건의</h1>
      <p className="mt-1 text-sm text-neutral-500">사용자 접수 관리</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => {
          const params = new URLSearchParams();
          params.set("status", t.v);
          if (category) params.set("category", category);
          return (
            <Link
              key={t.v}
              href={`/admin/feedback?${params.toString()}`}
              className={
                "rounded-md border px-3 py-1.5 text-xs transition " +
                (status === t.v
                  ? "border-amber-500 bg-amber-400/10 text-amber-200"
                  : "border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200")
              }
            >
              {t.l}
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <CategoryFilter current={category} status={status} value={undefined} label="전체 종류" />
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
          <CategoryFilter key={c} current={category} status={status} value={c} label={CATEGORY_LABEL[c]} />
        ))}
      </div>

      {list.length === 0 ? (
        <div className="mt-8 rounded-md border border-neutral-800 bg-neutral-900/40 p-8 text-center text-sm text-neutral-500">
          {status === "open" ? "처리할 문의가 없어요." : "해당 조건의 문의가 없어요."}
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {list.map((f) => {
            const author = profilesById.get(f.user_id);
            const authorName = author?.display_name ?? author?.username ?? "?";
            return (
              <li key={f.id} className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3 text-xs">
                  <div className="flex items-baseline gap-2">
                    <span className={"rounded px-2 py-0.5 font-medium " + CATEGORY_BADGE[f.category]}>
                      {CATEGORY_LABEL[f.category]}
                    </span>
                    <span className="text-neutral-500">
                      {new Date(f.created_at).toLocaleString("ko-KR")}
                    </span>
                    {f.platform && (
                      <span className="text-neutral-600">· {f.platform}{f.app_version ? ` v${f.app_version}` : ""}</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={"rounded px-2 py-0.5 " + statusBadge(f.status)}>
                      {STATUS_LABEL[f.status]}
                    </span>
                    <span className="text-neutral-500">
                      by{" "}
                      {author?.username ? (
                        <Link href={`/profile/${author.username}`} className="hover:text-amber-300">
                          {authorName}
                        </Link>
                      ) : (
                        authorName
                      )}
                    </span>
                  </div>
                </div>

                <h3 className="mt-3 text-base font-semibold text-neutral-100">{f.subject}</h3>
                <p className="mt-2 whitespace-pre-wrap rounded bg-neutral-900 p-3 text-sm text-neutral-200">
                  {f.body}
                </p>

                {f.admin_note && (
                  <div className="mt-3 rounded border border-emerald-900/40 bg-emerald-950/20 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                      관리자 메모
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-emerald-100">{f.admin_note}</p>
                  </div>
                )}

                <form action={updateFeedbackStatus} className="mt-3 space-y-2 border-t border-neutral-800 pt-3">
                  <input type="hidden" name="feedback_id" value={f.id} />
                  <textarea
                    name="admin_note"
                    defaultValue={f.admin_note ?? ""}
                    rows={2}
                    maxLength={2000}
                    placeholder="관리자 메모 (선택) — 응답 내용·처리 결과 등"
                    className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-100 focus:border-amber-400 focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    {(["open", "in_progress", "resolved"] as FeedbackStatus[]).map((s) => (
                      <button
                        key={s}
                        type="submit"
                        name="status"
                        value={s}
                        disabled={f.status === s}
                        className={
                          "rounded-md border px-3 py-1.5 text-xs transition " +
                          (f.status === s
                            ? "border-neutral-800 bg-neutral-900 text-neutral-600"
                            : "border-neutral-700 text-neutral-200 hover:border-amber-500 hover:text-amber-200")
                        }
                      >
                        {STATUS_LABEL[s]}로 변경
                      </button>
                    ))}
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function statusBadge(s: FeedbackStatus): string {
  switch (s) {
    case "open":
      return "bg-rose-900/40 text-rose-300";
    case "in_progress":
      return "bg-amber-900/40 text-amber-300";
    case "resolved":
      return "bg-emerald-900/40 text-emerald-300";
  }
}

function CategoryFilter({
  current, status, value, label,
}: {
  current: Category | undefined;
  status: FeedbackStatus | "all";
  value: Category | undefined;
  label: string;
}) {
  const params = new URLSearchParams();
  params.set("status", status);
  if (value) params.set("category", value);
  const active = current === value;
  return (
    <Link
      href={`/admin/feedback?${params.toString()}`}
      className={
        "rounded-md border px-3 py-1 text-[11px] transition " +
        (active
          ? "border-neutral-500 bg-neutral-800 text-neutral-100"
          : "border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-200")
      }
    >
      {label}
    </Link>
  );
}
