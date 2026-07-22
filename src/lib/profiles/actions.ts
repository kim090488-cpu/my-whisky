"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const USERNAME_RE = /^[a-z0-9_가-힣]{3,30}$/;

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const usernameRaw = String(formData.get("username") ?? "").trim().toLowerCase();
  const displayName = (String(formData.get("display_name") ?? "")).trim() || null;
  const bio = (String(formData.get("bio") ?? "")).trim() || null;

  if (!USERNAME_RE.test(usernameRaw)) {
    return { error: "아이디는 3~30자, 한글·영문 소문자·숫자·언더스코어(_)만 가능합니다." };
  }
  if (displayName && displayName.length > 30) {
    return { error: "닉네임은 30자 이하여야 합니다." };
  }
  if (bio && bio.length > 300) {
    return { error: "소개는 300자 이하여야 합니다." };
  }

  // 중복 체크 (본인 제외)
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", usernameRaw)
    .neq("id", user.id)
    .maybeSingle();
  if (existing) {
    return { error: "이미 사용 중인 username입니다." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ username: usernameRaw, display_name: displayName, bio })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/me");
  revalidatePath("/me/edit");
  revalidatePath(`/profile/${usernameRaw}`);
  return { ok: true, username: usernameRaw };
}
