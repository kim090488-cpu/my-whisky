import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  loadWrappedMonth,
  parseMonth,
  adjacentMonths,
  currentKstMonth,
  type WrappedMonth,
  type WrappedTopNote,
} from "@/lib/tastings/wrapped";

export const dynamic = "force-dynamic";

type Params = Promise<{ month: string }>;

export default async function WrappedPage({ params }: { params: Params }) {
  const { month } = await params;
  const parsed = parseMonth(month);
  if (!parsed) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/wrapped/${month}`);
  }

  const wrapped = await loadWrappedMonth(supabase, user.id, parsed.month);
  const adj = adjacentMonths(parsed.month);
  const currentMonth = currentKstMonth();
  const isFuture = parsed.month > currentMonth;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <MonthNav month={parsed.month} adj={adj} currentMonth={currentMonth} />

      <header className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          월별 회고
        </p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">{wrapped.monthLabel} 회고</h1>
        <p className="mt-1 text-xs text-muted-foreground/70">{parsed.month}</p>
      </header>

      {isFuture ? (
        <EmptyState message="아직 오지 않은 달이에요." />
      ) : !wrapped.hasData ? (
        <EmptyState
          message={
            parsed.month === currentMonth
              ? "이번 달 아직 노트를 쌓지 않았어요."
              : "이 달에는 노트가 없어요."
          }
        />
      ) : (
        <>
          <StatsGrid wrapped={wrapped} />

          {wrapped.topPick && (
            <HighlightCard
              tag="이 달의 픽"
              accent="amber"
              note={wrapped.topPick}
              subtitle={`${wrapped.topPick.score}점`}
            />
          )}

          {wrapped.mostLiked && wrapped.mostLiked.likeCount > 0 && (
            <HighlightCard
              tag="가장 많은 공감"
              accent="rose"
              note={wrapped.mostLiked}
              subtitle={
                <span className="inline-flex items-center gap-1">
                  <Heart className="size-3 fill-current" /> {wrapped.mostLiked.likeCount}
                </span>
              }
            />
          )}

          {wrapped.flavorTop.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                이 달 향미
              </h2>
              <div className="flex flex-wrap gap-2">
                {wrapped.flavorTop.map((f) => (
                  <div
                    key={f.key}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-1.5"
                  >
                    <span className="text-sm text-amber-200">{f.label}</span>
                    <span className="text-xs tabular-nums text-amber-300/80">{f.avg}/10</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(wrapped.topCasks.length > 0 || wrapped.topCountries.length > 0) && (
            <section className="mt-8 grid gap-4 sm:grid-cols-2">
              {wrapped.topCasks.length > 0 && (
                <DistBox title="자주 만난 캐스크" items={wrapped.topCasks} />
              )}
              {wrapped.topCountries.length > 0 && (
                <DistBox title="자주 만난 국가" items={wrapped.topCountries} />
              )}
            </section>
          )}

          {(wrapped.totalLikes > 0 || wrapped.totalComments > 0) && (
            <section className="mt-8 flex flex-wrap gap-4 rounded-xl border border-border bg-card/40 p-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Heart className="size-4 text-rose-400" />
                받은 좋아요{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {wrapped.totalLikes.toLocaleString()}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="size-4 text-sky-400" />
                받은 댓글{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {wrapped.totalComments.toLocaleString()}
                </span>
              </span>
            </section>
          )}
        </>
      )}

      <MonthNav month={parsed.month} adj={adj} currentMonth={currentMonth} className="mt-10" />
    </main>
  );
}

function MonthNav({
  month,
  adj,
  currentMonth,
  className,
}: {
  month: string;
  adj: { prev: string; next: string };
  currentMonth: string;
  className?: string;
}) {
  const canGoNext = adj.next <= currentMonth;
  return (
    <nav className={`flex items-center justify-between text-xs ${className ?? ""}`}>
      <Link
        href={`/wrapped/${adj.prev}`}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-card/40 px-2.5 py-1.5 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" /> {adj.prev}
      </Link>
      <span className="text-muted-foreground/70 tabular-nums">{month}</span>
      {canGoNext ? (
        <Link
          href={`/wrapped/${adj.next}`}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card/40 px-2.5 py-1.5 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          {adj.next} <ChevronRight className="size-3.5" />
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-md border border-border/50 px-2.5 py-1.5 text-muted-foreground/40">
          {adj.next} <ChevronRight className="size-3.5" />
        </span>
      )}
    </nav>
  );
}

function StatsGrid({ wrapped }: { wrapped: WrappedMonth }) {
  return (
    <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatBox label="노트" value={wrapped.count.toLocaleString()} suffix="잔" />
      <StatBox
        label="평균 점수"
        value={wrapped.avgScore !== null ? wrapped.avgScore.toFixed(1) : "—"}
        accent
      />
      <StatBox
        label="재구매"
        value={wrapped.buybackPct !== null ? String(wrapped.buybackPct) : "—"}
        suffix={wrapped.buybackPct !== null ? "%" : undefined}
      />
      <StatBox
        label="새로 만남"
        value={wrapped.newBottlingCount.toLocaleString()}
        suffix={wrapped.newBottlingCount > 0 ? "종" : undefined}
      />
    </section>
  );
}

function StatBox({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          className={`font-serif text-3xl tabular-nums ${accent ? "text-primary" : "text-foreground"}`}
        >
          {value}
        </span>
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function HighlightCard({
  tag,
  accent,
  note,
  subtitle,
}: {
  tag: string;
  accent: "amber" | "rose";
  note: WrappedTopNote;
  subtitle: React.ReactNode;
}) {
  const accentClass =
    accent === "amber"
      ? "border-amber-400/40 bg-amber-400/5"
      : "border-rose-400/40 bg-rose-400/5";
  const tagClass = accent === "amber" ? "text-amber-300" : "text-rose-300";
  const dist = note.distilleryNameKr || note.distilleryName;
  const bottling = note.bottlingNameKr || note.bottlingName;
  return (
    <section className={`mt-6 rounded-xl border p-5 ${accentClass}`}>
      <div className={`inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] ${tagClass}`}>
        <Sparkles className="size-3.5" />
        {tag}
      </div>
      <Link
        href={`/tastings/${note.tastingId}`}
        className="mt-3 block transition-opacity hover:opacity-80"
      >
        <div className="text-sm text-muted-foreground">{dist}</div>
        <div className="mt-1 font-serif text-2xl tracking-tight">{bottling}</div>
        <div className="mt-2 text-sm text-foreground/80">{subtitle}</div>
      </Link>
    </section>
  );
}

function DistBox({
  title,
  items,
}: {
  title: string;
  items: { key: string; label: string; count: number }[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h3>
      <ul className="mt-3 flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between text-sm">
            <span className="text-foreground/85">{item.label}</span>
            <span className="tabular-nums text-muted-foreground">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-10 rounded-xl border border-dashed border-border bg-card/30 p-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link
        href="/tastings"
        className="mt-3 inline-block text-xs text-primary hover:underline"
      >
        노트 둘러보기 →
      </Link>
    </div>
  );
}
