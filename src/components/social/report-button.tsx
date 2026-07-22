"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitReport } from "@/lib/reports/actions";
import { REPORT_REASON_LABEL } from "@/lib/reports/labels";
import type { ReportReason, ReportTarget } from "@/types/database";

type Props = {
  targetTable: ReportTarget;
  targetId: string;
  ownerId: string | null;
  currentUserId: string | null;
  loginHref?: string;
  label?: React.ReactNode;
  className?: string;
};

export function ReportButton({
  targetTable, targetId, ownerId, currentUserId, loginHref,
  label = "신고",
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // 본인 거는 신고 버튼 자체 숨김
  if (currentUserId && ownerId && currentUserId === ownerId) return null;

  function trigger() {
    if (!currentUserId) {
      router.push(loginHref ?? "/login");
      return;
    }
    setOpen(true);
    setMsg(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("target_table", targetTable);
      fd.set("target_id", targetId);
      fd.set("reason", reason);
      fd.set("body", body);
      const res = await submitReport(fd);
      if (res?.error) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: "신고가 접수됐어요. 검토 후 처리됩니다." });
      setBody("");
      setTimeout(() => setOpen(false), 1200);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={trigger}
        className={
          className ??
          "text-[10px] text-neutral-600 hover:text-red-400"
        }
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-800 bg-neutral-950 p-5"
          >
            <h3 className="text-sm font-semibold">신고하기</h3>

            <label className="block text-xs">
              <span className="text-neutral-400">사유</span>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                className="mt-1 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              >
                {(Object.keys(REPORT_REASON_LABEL) as ReportReason[]).map((r) => (
                  <option key={r} value={r}>{REPORT_REASON_LABEL[r]}</option>
                ))}
              </select>
            </label>

            <label className="block text-xs">
              <span className="text-neutral-400">추가 설명 (선택, 1000자)</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="어떤 점이 문제인지 알려주시면 처리에 도움돼요."
                className="mt-1 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              />
            </label>

            {msg && (
              <p className={"text-xs " + (msg.kind === "ok" ? "text-emerald-300" : "text-red-300")}>
                {msg.text}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs hover:border-neutral-500"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-400 disabled:opacity-50"
              >
                {pending ? "전송 중…" : "신고"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
