"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, RefreshCw, Wine } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MAX_LOADED_MESSAGES = 50;

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

  // DB에서 최근 50 turn 로드 (기기 간 동기화)
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("curator_messages")
        .select("role, content, matches")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(MAX_LOADED_MESSAGES);
      if (data) {
        // 최신순 fetch → UI는 오래된 것부터
        const rows = data as unknown as Array<{
          role: "user" | "assistant";
          content: string;
          matches: WhiskyMatch[] | null;
        }>;
        const rev = rows.slice().reverse();
        setMessages(rev.map((r) => ({
          role: r.role,
          content: r.content,
          ...(r.matches ? { matches: r.matches } : {}),
        })));
      }
      setLoaded(true);
    })();
  }, [userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function resetChat() {
    if (messages.length === 0) return;
    if (!confirm("지금까지 나눈 대화를 모두 지울까요?")) return;
    setMessages([]);
    const supabase = createClient();
    await supabase.from("curator_messages").delete().eq("user_id", userId);
  }

  async function send(promptOverride?: string) {
    const q = (promptOverride ?? input).trim();
    if (!q || pending) return;
    const userMsg: Message = { role: "user", content: q };
    const withUser: Message[] = [...messages, userMsg];
    // 유저 bubble + 빈 assistant bubble 즉시 push (스트리밍 자리표시)
    setMessages([...withUser, { role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setPending(true);

    let acc = "";
    let matches: WhiskyMatch[] = [];
    let streamError: string | null = null;

    // 16ms(약 60fps) 간격으로 델타 flush → 델타당 re-render 방지
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flushNow = () => {
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      setMessages((prev) => {
        const copy = prev.slice();
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant" && last.content !== acc) {
          copy[copy.length - 1] = { ...last, content: acc };
        }
        return copy;
      });
    };
    const scheduleFlush = () => {
      if (flushTimer) return;
      flushTimer = setTimeout(flushNow, 16);
    };

    try {
      const res = await fetch("/api/curator", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ messages: withUser }),
      });
      if (!res.ok || !res.body) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = await res.json() as { error?: string };
          if (j.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sepIdx: number;
        while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          let eventName = "message";
          let dataStr = "";
          for (const line of rawEvent.split("\n")) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
          }
          if (!dataStr) continue;
          let payload: unknown;
          try { payload = JSON.parse(dataStr); } catch { continue; }
          if (eventName === "delta") {
            acc += (payload as { text?: string }).text ?? "";
            scheduleFlush();
          } else if (eventName === "matches") {
            matches = (payload as { matches?: WhiskyMatch[] }).matches ?? [];
            flushNow();
            setMessages((prev) => {
              const copy = prev.slice();
              const last = copy[copy.length - 1];
              if (last && last.role === "assistant") {
                copy[copy.length - 1] = { ...last, matches };
              }
              return copy;
            });
          } else if (eventName === "error") {
            streamError = (payload as { error?: string }).error ?? "unknown error";
          }
        }
      }
      flushNow();

      if (streamError) {
        setError(streamError);
        // 실패 시 자리표시 assistant bubble 제거, 유저 bubble만 남김
        setMessages(withUser);
        return;
      }

      // 성공 시 유저·assistant 메시지 DB 저장
      const supabase = createClient();
      await supabase.from("curator_messages").insert([
        { user_id: userId, role: "user", content: q, matches: null },
        {
          user_id: userId,
          role: "assistant",
          content: acc,
          matches: matches.length > 0 ? (matches as unknown as never) : null,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMessages(withUser);
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
        {!loaded ? (
          <div className="flex justify-center py-12">
            <TypingDots />
          </div>
        ) : messages.length === 0 ? (
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
  const isEmptyAssistant = !isUser && message.content.length === 0;
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
          {isEmptyAssistant ? <TypingDots /> : message.content}
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
