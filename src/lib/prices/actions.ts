"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { PriceSource } from "@/types/database";

const SOURCES: readonly PriceSource[] = ["retail", "auction", "secondhand", "duty_free"];

export async function submitPriceRecord(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const bottlingId = String(formData.get("bottling_id") ?? "");
  const priceStr = String(formData.get("price") ?? "").trim();
  const currency = (String(formData.get("currency") ?? "KRW")).trim().toUpperCase();
  const sourceRaw = String(formData.get("source") ?? "retail");
  const sourceUrl = (String(formData.get("source_url") ?? "")).trim() || null;
  const place = (String(formData.get("place") ?? "")).trim() || null;
  const recordedAtRaw = String(formData.get("recorded_at") ?? "");

  if (!bottlingId) return { error: "bottling_id 누락" };
  const price = Number(priceStr);
  if (!Number.isFinite(price) || price <= 0) return { error: "가격을 정확히 입력해주세요." };
  if (currency.length !== 3) return { error: "통화 코드는 3자 (예: KRW)" };

  const source = (SOURCES as readonly string[]).includes(sourceRaw)
    ? (sourceRaw as PriceSource)
    : "retail";

  const recorded_at = /^\d{4}-\d{2}-\d{2}$/.test(recordedAtRaw) ? recordedAtRaw : undefined;

  if (sourceUrl) {
    try {
      const u = new URL(sourceUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return { error: "URL은 http/https 만 가능합니다." };
      }
    } catch {
      return { error: "URL 형식이 올바르지 않습니다." };
    }
  }

  const { error } = await supabase.from("price_records").insert({
    bottling_id: bottlingId,
    user_id: user.id,
    price,
    currency,
    source,
    source_url: sourceUrl,
    place,
    ...(recorded_at ? { recorded_at } : {}),
  });
  if (error) return { error: error.message };

  revalidatePath(`/whiskies/${bottlingId}`);
  return { ok: true };
}

export async function deletePriceRecord(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "id 누락" };

  const { data: row } = await supabase
    .from("price_records")
    .select("bottling_id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { error: "기록을 찾을 수 없어요." };
  if (row.user_id !== user.id) return { error: "본인이 제보한 것만 삭제 가능합니다." };

  const { error } = await supabase
    .from("price_records")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath(`/whiskies/${row.bottling_id}`);
  return { ok: true };
}
