"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAdminGuard } from "@/lib/admin/guards";

export type FeedbackStatus = "open" | "in_progress" | "resolved";

const STATUSES: readonly FeedbackStatus[] = ["open", "in_progress", "resolved"];

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
