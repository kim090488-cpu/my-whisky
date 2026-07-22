"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/profiles/actions";

type Initial = { username: string; display_name: string; bio: string };

export function ProfileEditForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof Initial>(k: K, v: string) =>
    setState((s) => ({ ...s, [k]: v }));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);

    const fd = new FormData();
    fd.set("username", state.username);
    fd.set("display_name", state.display_name);
    fd.set("bio", state.bio);

    startTransition(async () => {
      const res = await updateProfile(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOkMsg("저장됐어요.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="아이디" hint="3~30자, 한글·영문 소문자·숫자·언더스코어(_) — 공개 URL이 됨">
        <input
          name="username"
          value={state.username}
          onChange={(e) => set("username", e.target.value.toLowerCase())}
          required
          className={fieldCls}
        />
      </Field>

      <Field label="닉네임" hint="다른 사용자에게 보여지는 이름 (선택)">
        <input
          name="display_name"
          value={state.display_name}
          onChange={(e) => set("display_name", e.target.value)}
          maxLength={30}
          className={fieldCls}
        />
      </Field>

      <Field label="소개" hint="300자 이내">
        <textarea
          name="bio"
          rows={4}
          value={state.bio}
          onChange={(e) => set("bio", e.target.value)}
          maxLength={300}
          className={fieldCls}
        />
        <div className="mt-1 text-right text-[10px] text-neutral-600">{state.bio.length}/300</div>
      </Field>

      {error && <p className="text-sm text-red-300">{error}</p>}
      {okMsg && <p className="text-sm text-emerald-300">{okMsg}</p>}

      <div className="flex gap-3 border-t border-neutral-900 pt-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-amber-400 px-5 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-300 disabled:opacity-50"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
        {state.username && (
          <Link
            href={`/profile/${encodeURIComponent(state.username)}`}
            className="rounded-md border border-neutral-700 px-5 py-2 text-sm hover:border-neutral-500"
          >
            내 공개 프로필 보기 →
          </Link>
        )}
      </div>
    </form>
  );
}

const fieldCls =
  "w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none";

function Field({
  label, hint, children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</span>
        {hint && <span className="text-[10px] text-neutral-600">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
