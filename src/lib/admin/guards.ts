import { createClient } from "@/lib/supabase/server";

export type AdminGuardResult = {
  user: { id: string; email?: string | null } | null;
  isAdmin: boolean;
  profile: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

/**
 * 현재 사용자가 admin인지 확인. 페이지/액션 양쪽에서 사용.
 * 페이지에서: 결과로 redirect 분기.
 * 액션에서: !isAdmin 이면 거부.
 */
export async function getAdminGuard(): Promise<AdminGuardResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, isAdmin: false, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, username, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user: { id: user.id, email: user.email },
    isAdmin: profile?.is_admin ?? false,
    profile: profile
      ? { username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url }
      : null,
  };
}
