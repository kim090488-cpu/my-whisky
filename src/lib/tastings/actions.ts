"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { TastingVisibility, RecommendedForKind } from "@/types/database";

const VIS: readonly TastingVisibility[] = ["public", "followers", "private"];
const RECOMMENDED_FOR: readonly RecommendedForKind[] = [
  "beginner", "intermediate", "expert", "gift",
];

type ParsedFields = {
  score: number;
  notes: string;
  would_buy_again: boolean;
  value_for_money: number;
  recommended_for: RecommendedForKind[];
  sweetness: number | null;
  smokiness: number | null;
  fruitiness: number | null;
  spiciness: number | null;
  smoothness: number | null;
  complexity: number | null;
  finish_length: number | null;
  purchase_price: number | null;
  purchase_currency: string | null;
  purchase_country: string | null;
  purchased_at_place: string | null;
  food_pairing: string | null;
  color: string | null;
  visibility: TastingVisibility;
  tasted_at: string | undefined;
  photos: string[];
  bottle_owned_verified: boolean;
};

function parseTastingFields(
  formData: FormData,
): { error: string; data: null } | { error: null; data: ParsedFields } {
  const score = parseIntInRange(formData.get("score"), 0, 100);
  if (score === null) return { error: "종합 점수(0~100)를 입력해주세요.", data: null };

  const notes = trimOrNull(formData.get("notes"));
  if (!notes) return { error: "한 줄이라도 후기를 적어주세요.", data: null };

  const would_buy_again = parseBool(formData.get("would_buy_again"));
  if (would_buy_again === null) return { error: "다시 살지 여부를 선택해주세요.", data: null };

  const value_for_money = parseIntInRange(formData.get("value_for_money"), 1, 5);
  if (value_for_money === null) return { error: "가성비(1~5)를 선택해주세요.", data: null };

  const recommended_for = parseEnumArray(formData.getAll("recommended_for"), RECOMMENDED_FOR);

  const ccRaw = String(formData.get("purchase_currency") ?? "").trim().toUpperCase();
  const purchase_currency = /^[A-Z]{3}$/.test(ccRaw) ? ccRaw : null;

  const visRaw = String(formData.get("visibility") ?? "public");
  const visibility = (VIS as readonly string[]).includes(visRaw)
    ? (visRaw as TastingVisibility)
    : "public";

  const tastedAtRaw = String(formData.get("tasted_at") ?? "");
  const tasted_at = /^\d{4}-\d{2}-\d{2}$/.test(tastedAtRaw) ? tastedAtRaw : undefined;

  const photosRaw = String(formData.get("photos") ?? "[]");
  let photos: string[] = [];
  try {
    const parsed = JSON.parse(photosRaw);
    if (Array.isArray(parsed)) {
      photos = parsed.filter((p): p is string => typeof p === "string");
    }
  } catch {
    // ignore
  }

  return {
    error: null,
    data: {
      score,
      notes,
      would_buy_again,
      value_for_money,
      recommended_for,
      sweetness: parseIntInRange(formData.get("sweetness"), 1, 10),
      smokiness: parseIntInRange(formData.get("smokiness"), 1, 10),
      fruitiness: parseIntInRange(formData.get("fruitiness"), 1, 10),
      spiciness: parseIntInRange(formData.get("spiciness"), 1, 10),
      smoothness: parseIntInRange(formData.get("smoothness"), 1, 10),
      complexity: parseIntInRange(formData.get("complexity"), 1, 10),
      finish_length: parseIntInRange(formData.get("finish_length"), 1, 10),
      purchase_price: parseDecimal(formData.get("purchase_price")),
      purchase_currency,
      purchase_country: trimOrNull(formData.get("purchase_country")),
      purchased_at_place: trimOrNull(formData.get("purchased_at_place")),
      food_pairing: trimOrNull(formData.get("food_pairing")),
      color: trimOrNull(formData.get("color")),
      visibility,
      tasted_at,
      photos,
      bottle_owned_verified: parseBool(formData.get("bottle_owned_verified")) === true,
    },
  };
}

export async function createTasting(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const bottlingId = String(formData.get("bottling_id") ?? "");
  if (!bottlingId) return { error: "보틀링 정보가 누락됐습니다." };

  const parsed = parseTastingFields(formData);
  if (parsed.error) return { error: parsed.error };
  const f = parsed.data;

  const { tasted_at, ...rest } = f;
  const { data: inserted, error } = await supabase
    .from("tastings")
    .insert({
      user_id: user.id,
      bottling_id: bottlingId,
      ...rest,
      ...(tasted_at ? { tasted_at } : {}),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath(`/whiskies/${bottlingId}`);
  revalidatePath("/me/tastings");
  return { ok: true, id: inserted.id };
}

export async function updateTasting(tastingId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!tastingId) return { error: "노트 정보가 누락됐습니다." };

  const { data: existing } = await supabase
    .from("tastings")
    .select("id, user_id, bottling_id")
    .eq("id", tastingId)
    .maybeSingle();
  if (!existing) return { error: "노트를 찾을 수 없습니다." };
  if (existing.user_id !== user.id) {
    return { error: "본인의 노트만 수정할 수 있습니다." };
  }

  const parsed = parseTastingFields(formData);
  if (parsed.error) return { error: parsed.error };
  const f = parsed.data;

  const { tasted_at, ...rest } = f;
  const { error } = await supabase
    .from("tastings")
    .update({
      ...rest,
      ...(tasted_at ? { tasted_at } : {}),
    })
    .eq("id", tastingId);
  if (error) return { error: error.message };

  revalidatePath(`/whiskies/${existing.bottling_id}`);
  revalidatePath(`/tastings/${tastingId}`);
  revalidatePath("/me/tastings");
  return { ok: true, id: tastingId };
}

export async function deleteTasting(tastingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!tastingId) return { error: "노트 정보가 누락됐습니다." };

  const { data: existing } = await supabase
    .from("tastings")
    .select("id, user_id, bottling_id")
    .eq("id", tastingId)
    .maybeSingle();
  if (!existing) return { error: "노트를 찾을 수 없습니다." };
  if (existing.user_id !== user.id) {
    return { error: "본인의 노트만 삭제할 수 있습니다." };
  }

  const { error } = await supabase.from("tastings").delete().eq("id", tastingId);
  if (error) return { error: error.message };

  revalidatePath(`/whiskies/${existing.bottling_id}`);
  revalidatePath("/tastings");
  revalidatePath("/me/tastings");
  return { ok: true, bottlingId: existing.bottling_id };
}

// ── helpers ───────────────────────────────────────────────────────

function trimOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function parseIntInRange(
  v: FormDataEntryValue | null,
  min: number,
  max: number,
): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < min || i > max) return null;
  return i;
}

function parseDecimal(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parseBool(v: FormDataEntryValue | null): boolean | null {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "yes" || s === "1") return true;
  if (s === "false" || s === "no" || s === "0") return false;
  return null;
}

function parseEnumArray<T extends string>(
  raw: FormDataEntryValue[],
  allowed: readonly T[],
): T[] {
  const allowedSet = new Set<string>(allowed);
  const out: T[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    if (allowedSet.has(v) && !out.includes(v as T)) out.push(v as T);
  }
  return out;
}
