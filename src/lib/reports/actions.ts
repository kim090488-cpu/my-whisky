"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAdminGuard } from "@/lib/admin/guards";
import { rateLimit } from "@/lib/auth/rate-limit";
import type { ReportReason, ReportStatus, ReportTarget } from "@/types/database";

const TARGETS: readonly ReportTarget[] = ["tasting", "comment", "user"];
const REASONS: readonly ReportReason[] = ["spam", "abuse", "false_info", "copyright", "other"];
const STATUSES: readonly ReportStatus[] = ["open", "in_progress", "resolved", "dismissed"];

export async function submitReport(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const limit = rateLimit(`report:${user.id}`, { max: 10, windowMs: 60_000 });
  if (!limit.ok) {
    return { error: `너무 빠른 요청이에요. ${Math.ceil(limit.retryAfterMs / 1000)}초 후 다시 시도해주세요.` };
  }

  const targetRaw = String(formData.get("target_table") ?? "");
  const target_id = String(formData.get("target_id") ?? "").trim();
  const reasonRaw = String(formData.get("reason") ?? "");
  const body = (String(formData.get("body") ?? "")).trim() || null;

  if (!(TARGETS as readonly string[]).includes(targetRaw))
    return { error: "잘못된 신고 대상입니다." };
  if (!target_id) return { error: "신고 대상 ID가 누락됐어요." };
  if (!(REASONS as readonly string[]).includes(reasonRaw))
    return { error: "신고 사유를 선택해주세요." };
  if (body && body.length > 1000) return { error: "설명은 1000자 이내." };

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_table: targetRaw as ReportTarget,
    target_id,
    reason: reasonRaw as ReportReason,
    body,
  });
  if (error) {
    if (error.code === "23505") return { error: "이미 신고하신 항목이에요." };
    return { error: error.message };
  }

  return { ok: true };
}

export async function updateReportStatus(formData: FormData) {
  const { user, isAdmin } = await getAdminGuard();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!isAdmin) return { error: "관리자 권한이 필요합니다." };

  const reportId = String(formData.get("report_id") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "");
  const note = (String(formData.get("resolution_note") ?? "")).trim() || null;

  if (!reportId) return { error: "report_id 누락" };
  if (!(STATUSES as readonly string[]).includes(statusRaw))
    return { error: "잘못된 상태값." };

  const status = statusRaw as ReportStatus;
  const isFinal = status === "resolved" || status === "dismissed";

  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({
      status,
      resolution_note: note,
      resolved_by: isFinal ? user.id : null,
      resolved_at: isFinal ? new Date().toISOString() : null,
    })
    .eq("id", reportId);
  if (error) return { error: error.message };

  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  return { ok: true };
}
