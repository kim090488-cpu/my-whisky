"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAdminGuard } from "@/lib/admin/guards";
import type { AdminActionType } from "@/types/database";

async function logAction(
  adminId: string,
  action: AdminActionType,
  target_table: string,
  target_id: string,
  reason: string | null,
  related_report_id?: string | null,
) {
  const supabase = await createClient();
  await supabase.from("admin_actions").insert({
    admin_id: adminId,
    action,
    target_table,
    target_id,
    reason,
    related_report_id: related_report_id ?? null,
  });
}

// ────────────────────────────────────────────────
// 노트 숨김 / 복원
// ────────────────────────────────────────────────
export async function hideTasting(formData: FormData) {
  const { user, isAdmin } = await getAdminGuard();
  if (!user || !isAdmin) return { error: "관리자 권한이 필요합니다." };

  const id = String(formData.get("tasting_id") ?? "");
  const reason = (String(formData.get("reason") ?? "")).trim() || null;
  const reportId = (String(formData.get("report_id") ?? "")).trim() || null;
  if (!id) return { error: "tasting_id 누락" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tastings")
    .update({
      hidden_at: new Date().toISOString(),
      hidden_by: user.id,
      hidden_reason: reason,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAction(user.id, "hide_tasting", "tasting", id, reason, reportId);

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function unhideTasting(formData: FormData) {
  const { user, isAdmin } = await getAdminGuard();
  if (!user || !isAdmin) return { error: "관리자 권한이 필요합니다." };

  const id = String(formData.get("tasting_id") ?? "");
  if (!id) return { error: "tasting_id 누락" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tastings")
    .update({ hidden_at: null, hidden_by: null, hidden_reason: null })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAction(user.id, "unhide_tasting", "tasting", id, null);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ────────────────────────────────────────────────
// 댓글 숨김 / 복원
// ────────────────────────────────────────────────
export async function hideComment(formData: FormData) {
  const { user, isAdmin } = await getAdminGuard();
  if (!user || !isAdmin) return { error: "관리자 권한이 필요합니다." };

  const id = String(formData.get("comment_id") ?? "");
  const reason = (String(formData.get("reason") ?? "")).trim() || null;
  const reportId = (String(formData.get("report_id") ?? "")).trim() || null;
  if (!id) return { error: "comment_id 누락" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasting_comments")
    .update({
      hidden_at: new Date().toISOString(),
      hidden_by: user.id,
      hidden_reason: reason,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAction(user.id, "hide_comment", "comment", id, reason, reportId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function unhideComment(formData: FormData) {
  const { user, isAdmin } = await getAdminGuard();
  if (!user || !isAdmin) return { error: "관리자 권한이 필요합니다." };

  const id = String(formData.get("comment_id") ?? "");
  if (!id) return { error: "comment_id 누락" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasting_comments")
    .update({ hidden_at: null, hidden_by: null, hidden_reason: null })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAction(user.id, "unhide_comment", "comment", id, null);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ────────────────────────────────────────────────
// 사용자 정지 / 해제
// ────────────────────────────────────────────────
export async function suspendUser(formData: FormData) {
  const { user, isAdmin } = await getAdminGuard();
  if (!user || !isAdmin) return { error: "관리자 권한이 필요합니다." };

  const userId = String(formData.get("user_id") ?? "");
  const daysStr = String(formData.get("days") ?? "7");
  const reason = (String(formData.get("reason") ?? "")).trim() || null;
  const reportId = (String(formData.get("report_id") ?? "")).trim() || null;

  if (!userId) return { error: "user_id 누락" };
  if (userId === user.id) return { error: "본인을 정지할 수 없어요." };
  const days = Number(daysStr);
  if (!Number.isFinite(days) || days < 1 || days > 365)
    return { error: "정지 기간은 1~365일." };

  const now = new Date();
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      suspended_at: now.toISOString(),
      suspended_until: until.toISOString(),
      suspension_reason: reason,
    })
    .eq("id", userId);
  if (error) return { error: error.message };

  await logAction(user.id, "suspend_user", "user", userId, reason, reportId);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function unsuspendUser(formData: FormData) {
  const { user, isAdmin } = await getAdminGuard();
  if (!user || !isAdmin) return { error: "관리자 권한이 필요합니다." };

  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { error: "user_id 누락" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      suspended_at: null,
      suspended_until: null,
      suspension_reason: null,
    })
    .eq("id", userId);
  if (error) return { error: error.message };

  await logAction(user.id, "unsuspend_user", "user", userId, null);
  revalidatePath("/admin", "layout");
  return { ok: true };
}
