import type { ReportReason } from "@/types/database";

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  spam: "스팸·광고",
  abuse: "욕설·괴롭힘",
  false_info: "잘못된 정보",
  copyright: "저작권 침해",
  other: "기타",
};

export const REPORT_REASONS: readonly ReportReason[] = [
  "spam", "abuse", "false_info", "copyright", "other",
];
