import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  BottlingForm,
  type BottlingInitial,
} from "@/app/contribute/bottling/new/bottling-form";
import type { CaskType, BottlerKind } from "@/types/database";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export const metadata = { title: "보틀링 수정 · my-whisky" };

export default async function EditBottlingPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/whiskies/${id}/edit`);

  const { data: b } = await supabase
    .from("bottlings")
    .select(
      "id, distillery_id, name, name_kr, age_years, abv, vintage_year, bottling_year, cask_type, bottler, bottler_name, bottle_size_ml, total_bottles, notes",
    )
    .eq("id", id)
    .maybeSingle();
  if (!b) notFound();

  const { data: distilleries } = await supabase
    .from("distilleries")
    .select("id, name, name_kr, country, region")
    .order("country")
    .order("name");

  const initial: BottlingInitial = {
    distillery_id: b.distillery_id,
    name: b.name,
    name_kr: b.name_kr,
    age_years: b.age_years,
    abv: b.abv,
    vintage_year: b.vintage_year,
    bottling_year: b.bottling_year,
    cask_type: (b.cask_type ?? "unknown") as CaskType,
    bottler: (b.bottler ?? "official") as BottlerKind,
    bottler_name: b.bottler_name,
    bottle_size_ml: b.bottle_size_ml,
    total_bottles: b.total_bottles,
    notes: b.notes,
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <Link
        href={`/whiskies/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        보틀링으로
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">{b.name_kr ?? b.name} · 정보 수정</h1>
      <p className="mt-1 text-sm text-neutral-500">
        잘못된 정보를 발견하면 누구나 고칠 수 있어요. 신중히 작성해주세요.
      </p>
      <div className="mt-8">
        <BottlingForm
          distilleries={distilleries ?? []}
          preselectId=""
          edit={{ bottlingId: id, initial }}
        />
      </div>
    </main>
  );
}
