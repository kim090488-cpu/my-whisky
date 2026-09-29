"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAdminGuard } from "@/lib/admin/guards";

export type FeedbackCategory = "bug" | "suggestion" | "question" | "other";
export type FeedbackStatus = "open" | "in_progress" | "resolved";

const CATEGORIES: readonly FeedbackCategory[] = ["bug", "suggestion", "question", "other"];
const STATUSES: readonly FeedbackStatus[] = ["open", "in_progress", "resolved"];

export async function submitFeedback(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const categoryRaw = String(formData.get("category") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!(CATEGORIES as readonly string[]).includes(categoryRaw)) {
    return { error: "잘못된 카테고리입니다." };
  }
  if (!subject) return { error: "제목을 입력해주세요." };
  if (subject.length > 200) return { error: "제목은 200자 이내로 입력해주세요." };
  if (!body) return { error: "내용을 입력해주세요." };
  if (body.length > 5000) return { error: "내용은 5000자 이내로 입력해주세요." };

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    category: categoryRaw as FeedbackCategory,
    subject,
    body,
    platform: "web",
  });
  if (error) {
    if (/rate|시간당|54000/.test(error.message)) {
      return { error: "요청이 너무 잦아요. 잠시 후 다시 시도해주세요." };
    }
    return { error: error.message };
  }

  revalidatePath("/me/settings/feedback");
  return { ok: true };
}

export async function updateFeedbackStatus(formData: FormData) {
  const { user, isAdmin } = await getAdminGuard();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!isAdmin) return { error: "관리자 권한이 필요합니다." };

  const feedbackId = String(formData.get("feedback_id") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "");
  const note = (String(formData.get("admin_note") ?? "")).trim() || null;

  if (!feedbackId) return { error: "feedback_id 누락" };
  if (!(STATUSES as readonly string[]).includes(statusRaw)) {
    return { error: "잘못된 상태값." };
  }
  if (note && note.length > 2000) {
    return { error: "관리자 메모는 2000자 이내." };
  }

  const status = statusRaw as FeedbackStatus;

  const supabase = await createClient();
  const { error } = await supabase
    .from("feedback")
    .update({
      status,
      admin_note: note,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
    })
    .eq("id", feedbackId);

  if (error) return { error: error.message };

  revalidatePath("/admin/feedback");
  revalidatePath("/admin");
  return { ok: true };
}
