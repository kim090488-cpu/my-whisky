import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  TastingFormFull,
  type FormState,
} from "@/app/whiskies/[id]/tastings/new/tasting-form-full";
import type {
  TastingVisibility,
  RecommendedForKind,
} from "@/types/database";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditTastingPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/tastings/${id}/edit`);

  // select 컬럼이 25+가 되면 postgrest-js parser가 GenericStringError를 반환 — select("*")로 우회.
  const { data: t } = await supabase
    .from("tastings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();
  if (t.user_id !== user.id) redirect(`/tastings/${id}`);

  const { data: b } = await supabase
    .from("bottlings")
    .select("id, name, name_kr")
    .eq("id", t.bottling_id)
    .maybeSingle();

  const initial: Partial<FormState> = {
    score: t.score?.toString() ?? "",
    notes: t.notes ?? "",
    would_buy_again:
      t.would_buy_again === true ? "true" : t.would_buy_again === false ? "false" : "",
    value_for_money: t.value_for_money?.toString() ?? "",
    recommended_for: (t.recommended_for ?? []) as RecommendedForKind[],
    tasted_at: t.tasted_at ?? "",
    color: t.color ?? "",
    visibility: (t.visibility ?? "public") as TastingVisibility,
    photos: t.photos ?? [],
    sweetness: t.sweetness?.toString() ?? "",
    smokiness: t.smokiness?.toString() ?? "",
    fruitiness: t.fruitiness?.toString() ?? "",
    spiciness: t.spiciness?.toString() ?? "",
    smoothness: t.smoothness?.toString() ?? "",
    complexity: t.complexity?.toString() ?? "",
    finish_length: t.finish_length?.toString() ?? "",
    purchase_price: t.purchase_price?.toString() ?? "",
    purchase_currency: t.purchase_currency ?? "KRW",
    purchase_country: t.purchase_country ?? "",
    purchased_at_place: t.purchased_at_place ?? "",
    food_pairing: t.food_pairing ?? "",
    tags: (t.tags ?? []) as string[],
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href={`/tastings/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        노트로
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="font-serif text-3xl tracking-tight">노트 수정</h1>
        {b && (
          <p className="mt-1 text-sm text-muted-foreground">{b.name_kr ?? b.name}</p>
        )}
      </header>

      <TastingFormFull
        bottlingId={t.bottling_id}
        userId={user.id}
        edit={{ tastingId: id, initial }}
      />
    </main>
  );
}
