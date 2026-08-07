import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// 서비스 롤 클라이언트 — auth.admin·스토리지 관리 등 서버 사이드 전용.
// 절대 클라이언트 번들에 노출되면 안 됨 (route.ts·server action에서만 사용).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경변수 미설정");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
