"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { BOTTLING_IMAGES_BUCKET } from "@/lib/uploads/storage";

export async function recordBottlingImage(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const bottlingId = String(formData.get("bottling_id") ?? "");
  const storagePath = String(formData.get("storage_path") ?? "");
  const caption = (String(formData.get("caption") ?? "")).trim() || null;
  if (!bottlingId || !storagePath) return { error: "필수 정보가 누락됐어요." };

  const { error } = await supabase.from("bottling_images").insert({
    bottling_id: bottlingId,
    storage_path: storagePath,
    caption,
    uploaded_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath(`/whiskies/${bottlingId}`);
  return { ok: true };
}

export async function deleteBottlingImage(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const imageId = String(formData.get("image_id") ?? "");
  if (!imageId) return { error: "이미지 ID 누락." };

  // 본인 행만 가져와서 storage path 확인
  const { data: row, error: fetchErr } = await supabase
    .from("bottling_images")
    .select("storage_path, bottling_id, uploaded_by")
    .eq("id", imageId)
    .maybeSingle();
  if (fetchErr || !row) return { error: "이미지를 찾지 못했어요." };
  if (row.uploaded_by !== user.id) return { error: "본인이 올린 사진만 삭제할 수 있어요." };

  // Storage 객체 먼저 삭제 (실패해도 row는 지움 — orphan은 정기 정리)
  await supabase.storage.from(BOTTLING_IMAGES_BUCKET).remove([row.storage_path]);

  const { error: deleteErr } = await supabase
    .from("bottling_images")
    .delete()
    .eq("id", imageId)
    .eq("uploaded_by", user.id);
  if (deleteErr) return { error: deleteErr.message };

  revalidatePath(`/whiskies/${row.bottling_id}`);
  return { ok: true };
}
