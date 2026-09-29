"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bug, Lightbulb, HelpCircle, MessageSquare } from "lucide-react";
import { submitFeedback, type FeedbackCategory } from "@/lib/feedback/actions";

const CATEGORIES: { key: FeedbackCategory; label: string; icon: React.ReactNode }[] = [
  { key: "bug",        label: "버그 신고",  icon: <Bug className="size-3.5" /> },
  { key: "suggestion", label: "기능 건의",  icon: <Lightbulb className="size-3.5" /> },
  { key: "question",   label: "질문",        icon: <HelpCircle className="size-3.5" /> },
  { key: "other",      label: "기타",        icon: <MessageSquare className="size-3.5" /> },
];

export function FeedbackForm() {
  const router = useRouter();
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);

    if (!subject.trim()) { setError("제목을 입력해주세요."); return; }
    if (!body.trim()) { setError("내용을 입력해주세요."); return; }

    const fd = new FormData();
    fd.set("category", category);
    fd.set("subject", subject.trim());
    fd.set("body", body.trim());

    startTransition(async () => {
      const res = await submitFeedback(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOkMsg("접수됐어요. 검토 후 반영할게요.");
      setSubject("");
      setBody("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          종류
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition " +
                  (active
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground")
                }
              >
                {c.icon}
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          제목 <span className="text-rose-400">*</span>
        </label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          placeholder="예: 위스키 검색 시 자동완성이 느려요"
          className="w-full rounded-md border border-border bg-card/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <div className="text-right text-[10px] text-muted-foreground">{subject.length}/200</div>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          내용 <span className="text-rose-400">*</span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          rows={8}
          placeholder="자세한 상황·재현 방법·원하는 개선점을 자유롭게 적어주세요"
          className="w-full rounded-md border border-border bg-card/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <div className="text-right text-[10px] text-muted-foreground">{body.length}/5000</div>
      </div>

      {error && <p className="rounded bg-rose-500/10 p-2 text-sm text-rose-300">{error}</p>}
      {okMsg && <p className="rounded bg-emerald-500/10 p-2 text-sm text-emerald-300">{okMsg}</p>}

      <button
        type="submit"
        disabled={pending || !subject.trim() || !body.trim()}
        className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? "전송 중…" : "관리자에게 보내기"}
      </button>
    </form>
  );
}
