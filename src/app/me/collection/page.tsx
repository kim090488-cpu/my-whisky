import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COLLECTION_LABEL, COUNTRY_FLAG, formatAge, formatAbv } from "@/lib/format";
import { removeFromCollection as _removeFromCollection } from "@/lib/collection/actions";
import type { WhiskyCountry } from "@/types/database";

const removeFromCollection = _removeFromCollection as unknown as (fd: FormData) => Promise<void>;

export const dynamic = "force-dynamic";

export default async function MyCollectionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: items } = await supabase
    .from("collection_items")
    .select(`
      id, status, quantity, purchase_price, purchase_date, notes,
      bottling:bottlings(
        id, name, name_kr, age_years, abv,
        distillery:distilleries(name, name_kr, country, region)
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/me" className="text-sm text-neutral-500 hover:text-neutral-300">
        ← 내 페이지
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">내 컬렉션</h1>
      <p className="mt-1 text-sm text-neutral-500">{items?.length ?? 0}개</p>

      <ul className="mt-6 space-y-2">
        {items?.map((it) => {
          const b = Array.isArray(it.bottling) ? it.bottling[0] : it.bottling;
          const d = b && (Array.isArray(b.distillery) ? b.distillery[0] : b.distillery);
          return (
            <li
              key={it.id}
              className="flex items-center gap-3 rounded-md border border-neutral-900 bg-neutral-950 p-3"
            >
              <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs">
                {COLLECTION_LABEL[it.status]}
              </span>
              {b && (
                <Link href={`/whiskies/${b.id}`} className="flex-1 hover:text-amber-300">
                  <div className="text-xs text-neutral-500">
                    {d && (
                      <>
                        {COUNTRY_FLAG[d.country as WhiskyCountry]} {d.name_kr ?? d.name} · {d.region ?? ""}
                      </>
                    )}
                  </div>
                  <div className="font-medium">{b.name_kr ?? b.name}</div>
                  {b.name_kr && b.name_kr !== b.name && (
                    <div className="text-[11px] text-neutral-500">{b.name}</div>
                  )}
                  <div className="mt-0.5 text-xs text-neutral-500">
                    {formatAge(b.age_years)} · {formatAbv(b.abv)}
                  </div>
                </Link>
              )}
              {it.purchase_price && (
                <span className="text-sm text-neutral-400">
                  {Number(it.purchase_price).toLocaleString()}원
                </span>
              )}
              <form action={removeFromCollection}>
                <input type="hidden" name="item_id" value={it.id} />
                <button className="text-xs text-neutral-600 hover:text-red-400">삭제</button>
              </form>
            </li>
          );
        })}
        {(!items || items.length === 0) && (
          <li className="rounded-md border border-neutral-800 bg-neutral-900/40 p-8 text-center text-sm text-neutral-500">
            아직 컬렉션이 비어있어요.{" "}
            <Link href="/whiskies" className="text-amber-300 hover:underline">
              카탈로그에서 추가
            </Link>
          </li>
        )}
      </ul>
    </main>
  );
}
