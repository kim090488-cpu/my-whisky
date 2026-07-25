import { supabase } from "./supabase";

// 로그인 유저가 차단한 유저 ID 목록. 캐시 없이 매 호출마다 조회 (규모 작을 것)
export async function loadBlockedUserIds(userId: string | undefined | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", userId);
  return new Set(((data ?? []) as Array<{ blocked_id: string }>).map((r) => r.blocked_id));
}
