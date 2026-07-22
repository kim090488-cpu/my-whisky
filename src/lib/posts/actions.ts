"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostVisibility } from "@/types/database";

const VIS: readonly PostVisibility[] = ["public", "followers", "private"];

export async function createPost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

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
  if (photos.length === 0) return { error: "사진을 한 장 이상 올려주세요." };
  if (photos.length > 10) return { error: "사진은 최대 10장까지 가능합니다." };

  const body = trimOrNull(formData.get("body"));
  if (body && body.length > 2000) return { error: "캡션은 2000자 이내로 작성해주세요." };

  const visRaw = String(formData.get("visibility") ?? "public");
  const visibility = (VIS as readonly string[]).includes(visRaw)
    ? (visRaw as PostVisibility)
    : "public";

  const bottlingIdRaw = String(formData.get("bottling_id") ?? "").trim();
  const bottling_id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    bottlingIdRaw,
  )
    ? bottlingIdRaw
    : null;

  const location_name = trimOrNull(formData.get("location_name"));
  if (location_name && location_name.length > 100)
    return { error: "장소명은 100자 이내로 작성해주세요." };

  const { data: inserted, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      body,
      photos,
      visibility,
      bottling_id,
      location_name,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/me");
  revalidatePath(`/profile/`);
  if (bottling_id) revalidatePath(`/whiskies/${bottling_id}`);
  redirect(`/posts/${inserted.id}`);
}

export async function deletePost(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: post } = await supabase
    .from("posts")
    .select("user_id, photos, bottling_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return { error: "포스트를 찾을 수 없어요." };
  if (post.user_id !== user.id) return { error: "권한이 없어요." };

  // storage 정리 (best-effort)
  if (post.photos.length > 0) {
    try {
      await supabase.storage.from("post-photos").remove(post.photos);
    } catch {
      // ignore — orphan 정기 정리
    }
  }

  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) return { error: error.message };

  revalidatePath("/me");
  if (post.bottling_id) revalidatePath(`/whiskies/${post.bottling_id}`);
  return { ok: true };
}

function trimOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}
