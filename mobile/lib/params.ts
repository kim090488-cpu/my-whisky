// 딥링크/route params 검증. 외부에서 들어온 값을 supabase 쿼리에 넣기 전 필터.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USERNAME_RE = /^[a-z0-9_]{3,32}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export function isValidUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export function isValidUsername(v: unknown): v is string {
  return typeof v === "string" && USERNAME_RE.test(v.toLowerCase());
}

export function isValidMonth(v: unknown): v is string {
  return typeof v === "string" && MONTH_RE.test(v);
}
