"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, RefreshCw, Wine } from "lucide-react";

const STORAGE_KEY_PREFIX = "curator:v1:";
const MAX_STORED_MESSAGES = 50;

type WhiskyMatch = { id: string; name: string; name_kr: string | null };
type Message = { role: "user" | "assistant"; content: string; matches?: WhiskyMatch[] };

const SUGGESTED_PROMPTS = [
  "10만원 이하 입문 스카치 3개 추천",
  "선물용 위스키 추천 (30만원대)",
  "피트 강한 아일라 스타일 추천",
  "가성비 좋은 셰리 캐스크",
  "위스키 초보인데 뭘로 시작할까요?",
];

export function CuratorChat({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    const toStore = messages.slice(-MAX_STORED_MESSAGES);
    try {
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch {
      /* ignore quota */
    }
  }, [messages, storageKey, loaded]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  function resetChat() {
    if (messages.length === 0) return;
    if (!confirm("지금까지 나눈 대화를 모두 지울까요?")) return;
    setMessages([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }

  async function send(promptOverride?: string) {
    const q = (promptOverride ?? input).trim();
    if (!q || pending) return;
    const next: Message[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setError(null);
    setPending(true);

    try {
      const res = await fetch("/api/curator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const json = (await res.json()) as {
        reply?: string;
        error?: string;
        matches?: WhiskyMatch[];
      };
      if (!res.ok || json.error) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setMessages([
        ...next,
        { role: "assistant", content: json.reply ?? "", matches: json.matches ?? [] },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <div className="text-5xl">🥃</div>
            <h2 className="mt-2 font-serif text-lg text-foreground">
              위스키 큐레이터에게 물어보세요
            </h2>
            <p className="text-xs text-muted-foreground">
              예산·취향·용도를 알려주면 맞춤 추천을 도와드려요.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => void send(p)}
                  disabled={pending}
                  className="rounded-full border border-primary/35 bg-primary/5 px-3.5 py-2 text-xs text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => <Bubble key={i} message={m} />)
        )}
        {pending && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5">
              <TypingDots />
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="flex items-end gap-2 border-t border-border/60 py-3"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={2000}
          placeholder="예: 아일라 스타일 추천"
          disabled={pending}
          className="max-h-32 flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary/50 disabled:opacity-50"
        />
        {messages.length > 0 && (
          <button
            type="button"
            onClick={resetChat}
            aria-label="대화 초기화"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <RefreshCw className="size-4" />
          </button>
        )}
        <button
          type="submit"
          disabled={pending || !input.trim()}
          aria-label="보내기"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-40"
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={"flex " + (isUser ? "justify-end" : "justify-start")}>
      <div className={"flex max-w-[80%] flex-col gap-1.5 " + (isUser ? "items-end" : "items-start")}>
        <div
          className={
            "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed " +
            (isUser
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm border border-border bg-card text-foreground")
          }
        >
          {message.content}
        </div>
        {!isUser && message.matches && message.matches.length > 0 && (
          <div className="flex max-w-full flex-col gap-1">
            <p className="text-[10px] text-muted-foreground">언급된 위스키 · 클릭하면 상세로</p>
            <div className="flex flex-wrap gap-1.5">
              {message.matches.map((w) => (
                <Link
                  key={w.id}
                  href={`/whiskies/${w.id}`}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <Wine className="size-3" />
                  <span className="max-w-40 truncate">{w.name_kr ?? w.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <span className="size-1.5 animate-pulse rounded-full bg-primary/60 [animation-delay:0ms]" />
      <span className="size-1.5 animate-pulse rounded-full bg-primary/60 [animation-delay:150ms]" />
      <span className="size-1.5 animate-pulse rounded-full bg-primary/60 [animation-delay:300ms]" />
    </span>
  );
}
