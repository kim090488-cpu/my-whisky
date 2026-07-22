import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COUNTRY_FLAG, COUNTRY_LABEL, CASK_LABEL, formatAge, formatAbv } from "@/lib/format";
import { AuctionStatsCard } from "./_auction-stats-card";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function DistilleryDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: d } = await supabase
    .from("distilleries")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!d) notFound();

  const [bottlingsRes, auctionRes] = await Promise.all([
    supabase
      .from("bottlings")
      .select("id, name, name_kr, age_years, abv, cask_type")
      .eq("distillery_id", id)
      .order("age_years", { ascending: true, nullsFirst: false })
      .order("name"),
    supabase
      .from("distillery_auction_stats")
      .select("dt, winning_bid_mean, winning_bid_min, winning_bid_max, lots_count")
      .eq("distillery_id", id)
      .eq("source", "whiskyhunter")
      .order("dt", { ascending: false })
      .limit(12),
  ]);
  const bottlings = bottlingsRes.data;
  const auctionStats = auctionRes.data ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/distilleries" className="text-sm text-neutral-500 hover:text-neutral-300">
        ← 증류소 목록
      </Link>

      <div className="mt-3 flex items-baseline gap-2 text-sm text-neutral-400">
        <span>{COUNTRY_FLAG[d.country]}</span>
        <span>{COUNTRY_LABEL[d.country]}</span>
        {d.region && (
          <>
            <span>·</span>
            <span>{d.region}</span>
          </>
        )}
      </div>

      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{d.name_kr ?? d.name}</h1>
      {d.name_kr && (
        <p className="text-sm text-neutral-500">{d.name}</p>
      )}

      <dl className="mt-6 grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">설립</dt>
          <dd className="mt-0.5">{d.founded_year ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">상태</dt>
          <dd className="mt-0.5">
            {d.status === "active" ? "가동 중" : d.status === "silent" ? "침묵" : d.status === "closed" ? "폐쇄" : d.status}
            {d.closed_year && ` (${d.closed_year})`}
          </dd>
        </div>
        {d.website && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">웹사이트</dt>
            <dd className="mt-0.5">
              <a href={d.website} target="_blank" rel="noopener" className="text-amber-300 hover:underline">
                ↗
              </a>
            </dd>
          </div>
        )}
      </dl>

      {d.description && (
        <p className="mt-6 whitespace-pre-wrap text-sm text-neutral-300">{d.description}</p>
      )}

      {auctionStats.length > 0 && (
        <AuctionStatsCard stats={auctionStats} whiskyhunterSlug={d.whiskyhunter_slug} />
      )}

      <section className="mt-10 border-t border-neutral-900 pt-6">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">
            보틀링 <span className="text-sm text-neutral-500">({bottlings?.length ?? 0})</span>
          </h2>
          <Link
            href={`/contribute/bottling/new?distillery_id=${d.id}`}
            className="text-sm text-amber-300 hover:underline"
          >
            + 이 증류소에 보틀링 추가
          </Link>
        </div>
        {bottlings && bottlings.length > 0 ? (
          <ul className="space-y-2">
            {bottlings.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/whiskies/${b.id}`}
                  className="flex items-baseline justify-between rounded-md border border-neutral-900 bg-neutral-950 px-4 py-3 hover:border-amber-700/60"
                >
                  <span className="font-medium">{b.name_kr ?? b.name}</span>
                  <span className="text-xs text-neutral-500">
                    {formatAge(b.age_years)} · {formatAbv(b.abv)}
                    {b.cask_type && ` · ${CASK_LABEL[b.cask_type]}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">등록된 보틀링이 아직 없습니다.</p>
        )}
      </section>
    </main>
  );
}
