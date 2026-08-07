"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CONFIRM_WORD = "삭제";

export function DeleteAccountForm({ username }: { username: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSubmit = confirm.trim() === CONFIRM_WORD;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;

    startTransition(async () => {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "삭제에 실패했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      // 클라이언트 세션도 클리어 (Realtime·localStorage)
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/?deleted=1");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="confirm" className="text-xs text-muted-foreground">
          계속하려면 아래 입력란에 <span className="font-semibold text-rose-300">삭제</span>{" "}
          두 글자를 입력하세요.
          {username && (
            <span className="ml-2 text-muted-foreground/70">(계정: {username})</span>
          )}
        </label>
        <input
          id="confirm"
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="삭제"
          autoComplete="off"
          className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-rose-400/60"
        />
      </div>

      {error && (
        <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit || pending}
        className="inline-flex items-center justify-center rounded-md border border-rose-500/60 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "삭제 중…" : "계정 영구 삭제"}
      </button>
    </form>
  );
}
