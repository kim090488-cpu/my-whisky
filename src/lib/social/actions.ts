"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addTastingComment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const tastingId = String(formData.get("tasting_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const parentIdRaw = String(formData.get("parent_id") ?? "").trim();
  const parent_id = parentIdRaw ? parentIdRaw : null;

  if (!tastingId) return { error: "tasting_id 누락" };
  if (!body) return { error: "내용을 입력해주세요." };
  if (body.length > 1000) return { error: "1000자 이내로 작성해주세요." };

  const { data: inserted, error } = await supabase
    .from("tasting_comments")
    .insert({ tasting_id: tastingId, user_id: user.id, body, parent_id })
    .select("id, body, parent_id, user_id, created_at")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, comment: inserted };
}

export async function deleteTastingComment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const commentId = String(formData.get("comment_id") ?? "");
  if (!commentId) return { error: "comment_id 누락" };

  const { error } = await supabase
    .from("tasting_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleFollow(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const followeeId = String(formData.get("followee_id") ?? "");
  if (!followeeId) return { error: "followee_id 누락" };
  if (followeeId === user.id) return { error: "자기 자신은 팔로우할 수 없어요." };

  const { data: existing } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("followee_id", followeeId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("follows").delete().eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { ok: true, following: false };
  } else {
    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: user.id, followee_id: followeeId });
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { ok: true, following: true };
  }
}

export async function togglePostLike(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const postId = String(formData.get("post_id") ?? "");
  if (!postId) return { error: "post_id 누락" };

  const { data: existing } = await supabase
    .from("post_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("post_likes").delete().eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath(`/posts/${postId}`);
    return { ok: true, liked: false };
  } else {
    const { error } = await supabase
      .from("post_likes")
      .insert({ post_id: postId, user_id: user.id });
    if (error) return { error: error.message };
    revalidatePath(`/posts/${postId}`);
    return { ok: true, liked: true };
  }
}

export async function addPostComment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const postId = String(formData.get("post_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!postId) return { error: "post_id 누락" };
  if (!body) return { error: "내용을 입력해주세요." };
  if (body.length > 1000) return { error: "1000자 이내로 작성해주세요." };

  const { error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, user_id: user.id, body });
  if (error) return { error: error.message };

  revalidatePath(`/posts/${postId}`);
  return { ok: true };
}

export async function deletePostComment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const commentId = String(formData.get("comment_id") ?? "");
  const postId = String(formData.get("post_id") ?? "");
  if (!commentId) return { error: "comment_id 누락" };

  const { error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  if (postId) revalidatePath(`/posts/${postId}`);
  return { ok: true };
}

export async function toggleTastingLike(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const tastingId = String(formData.get("tasting_id") ?? "");
  if (!tastingId) return { error: "tasting_id 누락" };

  // 이미 좋아요 했나?
  const { data: existing } = await supabase
    .from("tasting_likes")
    .select("id")
    .eq("tasting_id", tastingId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("tasting_likes")
      .delete()
      .eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { ok: true, liked: false };
  } else {
    const { error } = await supabase
      .from("tasting_likes")
      .insert({ tasting_id: tastingId, user_id: user.id });
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { ok: true, liked: true };
  }
}
