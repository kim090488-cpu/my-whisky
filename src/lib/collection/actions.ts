"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CollectionStatus } from "@/types/database";

const STATUS: readonly CollectionStatus[] = ["owned", "opened", "finished", "wishlist"];

export async function addToCollection(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const bottlingId = String(formData.get("bottling_id") ?? "");
  if (!bottlingId) return { error: "보틀링 정보가 누락됐습니다." };

  const statusRaw = String(formData.get("status") ?? "owned");
  const status = (STATUS as readonly string[]).includes(statusRaw)
    ? (statusRaw as CollectionStatus)
    : "owned";

  const priceStr = String(formData.get("purchase_price") ?? "").trim();
  const purchase_price = priceStr ? Number(priceStr) : null;
  if (purchase_price !== null && Number.isNaN(purchase_price)) {
    return { error: "가격은 숫자여야 합니다." };
  }

  const { error } = await supabase
    .from("collection_items")
    .upsert(
      {
        user_id: user.id,
        bottling_id: bottlingId,
        status,
        purchase_price,
        notes: trimOrNull(formData.get("notes")),
      },
      { onConflict: "user_id,bottling_id" },
    );
  if (error) return { error: error.message };

  revalidatePath(`/whiskies/${bottlingId}`);
  revalidatePath("/me/collection");
  return { ok: true };
}

export async function removeFromCollection(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const itemId = String(formData.get("item_id") ?? "");
  const { error } = await supabase
    .from("collection_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/me/collection");
  return { ok: true };
}

function trimOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}
