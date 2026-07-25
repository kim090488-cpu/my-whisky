"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { BOTTLING_IMAGES_BUCKET } from "@/lib/uploads/storage";
import { rateLimit } from "@/lib/auth/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recordBottlingImage(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const limit = rateLimit(`upload:${user.id}`, { max: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return { error: `너무 빠른 요청이에요. ${Math.ceil(limit.retryAfterMs / 1000)}초 후 다시 시도해주세요.` };
  }

  const bottlingId = String(formData.get("bottling_id") ?? "");
  const storagePath = String(formData.get("storage_path") ?? "");
  const caption = (String(formData.get("caption") ?? "")).trim() || null;
  if (!bottlingId || !storagePath) return { error: "필수 정보가 누락됐어요." };
  // bottling_id UUID 검증
  if (!UUID_RE.test(bottlingId)) return { error: "잘못된 위스키 ID입니다." };
  // storage_path 소유권 검증 — 다른 유저 폴더 경로 삽입 차단
  const expectedPrefix = `${bottlingId}/`;
  if (!storagePath.startsWith(expectedPrefix) || storagePath.includes("..")) {
    return { error: "잘못된 사진 경로입니다." };
  }
  // bottling 존재 확인
  const { data: bottling } = await supabase
    .from("bottlings")
    .select("id")
    .eq("id", bottlingId)
    .maybeSingle();
  if (!bottling) return { error: "위스키를 찾을 수 없어요." };

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
