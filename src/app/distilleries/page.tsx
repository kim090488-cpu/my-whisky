import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { COUNTRY_FLAG, COUNTRY_LABEL } from "@/lib/format";
import type { WhiskyCountry } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DistilleriesPage() {
  const supabase = await createClient();
  const { data: distilleries, error } = await supabase
    .from("distilleries")
    .select("id, name, name_kr, country, region, status, founded_year")
    .order("country")
    .order("region")
    .order("name")
    .limit(500);

  const grouped = new Map<WhiskyCountry, typeof distilleries>();
  for (const d of distilleries ?? []) {
    const arr = grouped.get(d.country) ?? [];
    arr.push(d);
    grouped.set(d.country, arr);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">증류소</h1>
          <p className="mt-1 text-sm text-neutral-500">{distilleries?.length ?? 0}곳</p>
        </div>
        <Link
          href="/contribute/distillery/new"
          className="text-sm text-amber-300 hover:underline"
        >
          + 새 증류소 추가
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
          {error.message}
        </div>
      )}

      {[...grouped.entries()].map(([country, list]) => (
        <section key={country} className="mb-10">
          <h2 className="mb-3 text-sm font-semibold text-neutral-400">
            {COUNTRY_FLAG[country]} {COUNTRY_LABEL[country]}{" "}
            <span className="text-neutral-600">({list!.length})</span>
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {list!.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/distilleries/${d.id}`}
                  className="block rounded-md border border-neutral-800 bg-neutral-900/40 p-3 text-sm transition hover:border-amber-700/60 hover:bg-neutral-900"
                >
                  <div className="font-medium text-neutral-100">{d.name_kr ?? d.name}</div>
                  {d.name_kr && (
                    <div className="text-[10px] text-neutral-600">{d.name}</div>
                  )}
                  <div className="mt-0.5 text-xs text-neutral-500">
                    {d.region ?? "—"}
                    {d.status !== "active" && (
                      <span className="ml-2 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase">
                        {d.status === "closed" ? "폐쇄" : d.status === "silent" ? "침묵" : d.status}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
