import type { ReportReason, ReportStatus, ReportTarget } from "@/types/database";

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  spam: "스팸·광고",
  abuse: "욕설·괴롭힘",
  false_info: "잘못된 정보",
  copyright: "저작권 침해",
  other: "기타",
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  open: "미처리",
  in_progress: "진행 중",
  resolved: "해결됨",
  dismissed: "기각됨",
};

export const REPORT_TARGET_LABEL: Record<ReportTarget, string> = {
  tasting: "테이스팅 노트",
  comment: "댓글",
  user: "사용자",
  bottling: "위스키",
};
