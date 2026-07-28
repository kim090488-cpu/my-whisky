"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { rateLimit } from "@/lib/auth/rate-limit";

export type CommunityCategory = "question" | "recommendation" | "tip" | "free";

const CATEGORIES: readonly CommunityCategory[] = ["question", "recommendation", "tip", "free"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseCategory(raw: FormDataEntryValue | null): CommunityCategory {
  const v = String(raw ?? "free");
  return (CATEGORIES as readonly string[]).includes(v) ? (v as CommunityCategory) : "free";
}

export async function createCommunityPost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const limit = rateLimit(`community-post:${user.id}`, { max: 10, windowMs: 60_000 });
  if (!limit.ok) {
    return { error: `너무 빠른 요청이에요. ${Math.ceil(limit.retryAfterMs / 1000)}초 후 다시 시도해주세요.` };
  }

  const category = parseCategory(formData.get("category"));
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (title.length < 1) return { error: "제목을 입력해주세요." };
  if (title.length > 200) return { error: "제목은 200자 이내로 작성해주세요." };
  if (body.length < 1) return { error: "본문을 입력해주세요." };
  if (body.length > 10000) return { error: "본문은 10000자 이내로 작성해주세요." };

  const { data: inserted, error } = await supabase
    .from("community_posts")
    .insert({ user_id: user.id, category, title, body } as never)
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/community");
  const newId = (inserted as unknown as { id: string } | null)?.id;
  if (newId) redirect(`/community/${newId}`);
  redirect("/community");
}

export async function updateCommunityPost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const postId = String(formData.get("post_id") ?? "").trim();
  if (!UUID_RE.test(postId)) return { error: "잘못된 게시글." };

  const category = parseCategory(formData.get("category"));
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (title.length < 1 || title.length > 200) return { error: "제목 길이가 올바르지 않아요." };
  if (body.length < 1 || body.length > 10000) return { error: "본문 길이가 올바르지 않아요." };

  const { error } = await supabase
    .from("community_posts")
    .update({ category, title, body } as never)
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/community");
  revalidatePath(`/community/${postId}`);
  redirect(`/community/${postId}`);
}

export async function deleteCommunityPost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const postId = String(formData.get("post_id") ?? "").trim();
  if (!UUID_RE.test(postId)) return { error: "잘못된 게시글." };

  const { error } = await supabase
    .from("community_posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/community");
  redirect("/community");
}

export async function toggleCommunityLike(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const limit = rateLimit(`community-like:${user.id}`, { max: 60, windowMs: 60_000 });
  if (!limit.ok) {
    return { error: `너무 빠른 요청이에요. ${Math.ceil(limit.retryAfterMs / 1000)}초 후 다시 시도해주세요.` };
  }

  const postId = String(formData.get("post_id") ?? "").trim();
  if (!UUID_RE.test(postId)) return { error: "잘못된 게시글." };

  const { data: existing } = await supabase
    .from("community_post_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("community_post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
    return { ok: true, liked: false };
  }

  const { error } = await supabase
    .from("community_post_likes")
    .insert({ post_id: postId, user_id: user.id } as never);
  if (error) return { error: error.message };
  return { ok: true, liked: true };
}

export async function addCommunityComment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const limit = rateLimit(`community-comment:${user.id}`, { max: 30, windowMs: 60_000 });
  if (!limit.ok) {
    return { error: `너무 빠른 요청이에요. ${Math.ceil(limit.retryAfterMs / 1000)}초 후 다시 시도해주세요.` };
  }

  const postId = String(formData.get("post_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!UUID_RE.test(postId)) return { error: "잘못된 게시글." };
  if (body.length < 1) return { error: "내용을 입력해주세요." };
  if (body.length > 2000) return { error: "2000자 이내로 작성해주세요." };

  const { error } = await supabase
    .from("community_post_comments")
    .insert({ post_id: postId, user_id: user.id, body } as never);
  if (error) return { error: error.message };

  revalidatePath(`/community/${postId}`);
  return { ok: true };
}

export async function deleteCommunityComment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const commentId = String(formData.get("comment_id") ?? "").trim();
  const postId = String(formData.get("post_id") ?? "").trim();
  if (!UUID_RE.test(commentId)) return { error: "잘못된 댓글." };

  const { error } = await supabase
    .from("community_post_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  if (UUID_RE.test(postId)) revalidatePath(`/community/${postId}`);
  return { ok: true };
}
