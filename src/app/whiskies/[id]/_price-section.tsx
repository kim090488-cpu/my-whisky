import Link from "next/link";
import { PRICE_SOURCE_LABEL, formatPrice } from "@/lib/format";
import { deletePriceRecord } from "@/lib/prices/actions";
import { PriceForm } from "./_price-form";
import type { PriceSource } from "@/types/database";

type PriceRecord = {
  id: string;
  price: number;
  currency: string;
  source: PriceSource;
  source_url: string | null;
  place: string | null;
  recorded_at: string;
  user_id: string | null;
  profile?: { username: string; display_name: string | null } | null;
};

type Props = {
  bottlingId: string;
  records: PriceRecord[];
  currentUserId: string | null;
};

export function PriceSection({ bottlingId, records, currentUserId }: Props) {
  // KRW만 통계에 사용 (혼합 통화 평균은 의미없음)
  const krw = records.filter((r) => r.currency === "KRW").map((r) => Number(r.price));
  const stats =
    krw.length > 0
      ? {
          min: Math.min(...krw),
          max: Math.max(...krw),
          avg: krw.reduce((s, p) => s + p, 0) / krw.length,
          count: krw.length,
        }
      : null;

  return (
    <section className="mt-12 border-t border-neutral-900 pt-6">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">시세</h2>
        {currentUserId ? (
          <PriceForm bottlingId={bottlingId} />
        ) : (
          <Link
            href={`/login?next=/whiskies/${bottlingId}`}
            className="text-sm text-amber-300 hover:underline"
          >
            로그인하고 제보
          </Link>
        )}
      </div>

      {stats ? (
        <div className="grid grid-cols-3 gap-3 text-center">
          <StatBox label="최저" value={formatPrice(stats.min)} />
          <StatBox label="평균" value={formatPrice(stats.avg)} accent />
          <StatBox label="최고" value={formatPrice(stats.max)} />
        </div>
      ) : (
        <p className="rounded-md border border-neutral-800 bg-neutral-900/40 p-4 text-center text-sm text-neutral-500">
          아직 시세 제보가 없어요.
        </p>
      )}

      {records.length > 0 && (
        <ul className="mt-4 space-y-2">
          {records.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-md border border-neutral-900 bg-neutral-950 px-3 py-2 text-sm"
            >
              <span className="w-20 shrink-0 text-xs text-neutral-500">{r.recorded_at}</span>
              <span className="w-24 shrink-0 text-right font-medium tabular-nums">
                {formatPrice(Number(r.price), r.currency)}
              </span>
              <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
                {PRICE_SOURCE_LABEL[r.source]}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-neutral-400">
                {r.place ?? "—"}
                {r.profile?.username && (
                  <>
                    {" · "}
                    <Link
                      href={`/profile/${r.profile.username}`}
                      className="hover:text-amber-300"
                    >
                      {r.profile.display_name ?? r.profile.username}
                    </Link>
                  </>
                )}
              </span>
              {r.source_url && (
                <a
                  href={r.source_url}
                  target="_blank"
                  rel="noopener"
                  className="text-xs text-amber-300 hover:underline"
                >
                  ↗
                </a>
              )}
              {currentUserId && r.user_id === currentUserId && (
                <form action={deletePriceRecord}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="text-[10px] text-neutral-600 hover:text-red-400">삭제</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {stats && (
        <p className="mt-2 text-right text-[10px] text-neutral-600">
          KRW {stats.count}건 기준 (사용자 제보 — 참고용)
        </p>
      )}
    </section>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={"mt-1 font-semibold " + (accent ? "text-amber-300" : "text-neutral-100")}>
        {value}
      </div>
    </div>
  );
}
