"use client";

import { useState, useTransition } from "react";
import { Heart, MessageCircle, UserPlus } from "lucide-react";
import { updateNotificationSettings } from "@/lib/notifications/actions";

type Settings = {
  notify_like: boolean;
  notify_comment: boolean;
  notify_follow: boolean;
};

const ITEMS: {
  key: keyof Settings;
  label: string;
  desc: string;
  Icon: typeof Heart;
  tint: string;
}[] = [
  {
    key: "notify_like",
    label: "좋아요",
    desc: "내 노트를 누가 좋아요 했을 때",
    Icon: Heart,
    tint: "bg-rose-500",
  },
  {
    key: "notify_comment",
    label: "댓글",
    desc: "내 노트나 내 댓글에 답이 달렸을 때",
    Icon: MessageCircle,
    tint: "bg-sky-500",
  },
  {
    key: "notify_follow",
    label: "팔로우",
    desc: "누가 나를 팔로우했을 때",
    Icon: UserPlus,
    tint: "bg-emerald-500",
  },
];

export function NotificationSettingsForm({ initial }: { initial: Settings }) {
  const [state, setState] = useState<Settings>(initial);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(key: keyof Settings) {
    setState((s) => ({ ...s, [key]: !s[key] }));
    setOkMsg(null);
  }

  function handleSave() {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      const res = await updateNotificationSettings(state);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOkMsg("저장됐어요.");
    });
  }

  const dirty =
    state.notify_like !== initial.notify_like ||
    state.notify_comment !== initial.notify_comment ||
    state.notify_follow !== initial.notify_follow;

  return (
    <div className="space-y-5">
      <ul className="divide-y divide-border/60 rounded-2xl border border-border bg-card/40">
        {ITEMS.map(({ key, label, desc, Icon, tint }) => {
          const on = state[key];
          return (
            <li key={key} className="flex items-center gap-4 p-4">
              <div className="shrink-0">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${tint}`}
                >
                  <Icon className="h-4 w-4 text-white" strokeWidth={2.4} />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => toggle(key)}
                className={
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors " +
                  (on ? "bg-amber-500" : "bg-foreground/15")
                }
              >
                <span
                  className={
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform " +
                    (on ? "translate-x-5" : "translate-x-0.5")
                  }
                />
              </button>
            </li>
          );
        })}
      </ul>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {okMsg && <p className="text-sm text-emerald-300">{okMsg}</p>}

      <div className="flex items-center justify-between border-t border-border/60 pt-4">
        <p className="text-xs text-muted-foreground">
          변경사항은 저장 후 새 알림부터 반영돼요.
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || !dirty}
          className="rounded-md bg-amber-400 px-5 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-300 disabled:opacity-50"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}
