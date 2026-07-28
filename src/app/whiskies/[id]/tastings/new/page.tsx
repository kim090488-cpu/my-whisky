import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COUNTRY_FLAG } from "@/lib/format";
import { TastingFormFull } from "./tasting-form-full";
import type { WhiskyCountry } from "@/types/database";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function NewTastingPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/whiskies/${id}/tastings/new`);

  const { data: b } = await supabase
    .from("bottlings")
    .select("id, name, name_kr, age_years, abv, distillery:distilleries(id, name, name_kr, country, region)")
    .eq("id", id)
    .maybeSingle();
  if (!b) notFound();

  const d = Array.isArray(b.distillery) ? b.distillery[0] : b.distillery;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href={`/whiskies/${b.id}`} className="text-sm text-neutral-500 hover:text-neutral-300">
        ← 보틀링으로
      </Link>

      <div className="mt-4 mb-8">
        {d && (
          <div className="text-sm text-neutral-400">
            {COUNTRY_FLAG[d.country as WhiskyCountry]} {d.name_kr ?? d.name}
            {d.region && ` · ${d.region}`}
          </div>
        )}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{b.name_kr ?? b.name}</h1>
        {b.name_kr && b.name_kr !== b.name && (
          <p className="mt-0.5 text-xs text-neutral-500">{b.name}</p>
        )}
        <p className="mt-1 text-xs text-neutral-500">테이스팅 노트 작성</p>
      </div>

      <TastingFormFull bottlingId={b.id} userId={user.id} />
    </main>
  );
}
