"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleBottlingEditLike(editId: string, bottlingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!editId) return { error: "수정 정보가 누락됐습니다." };

  const { data: existing } = await supabase
    .from("bottling_edit_likes")
    .select("id")
    .eq("edit_id", editId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("bottling_edit_likes")
      .delete()
      .eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath(`/whiskies/${bottlingId}/history`);
    return { ok: true, liked: false };
  }

  const { error } = await supabase
    .from("bottling_edit_likes")
    .insert({ edit_id: editId, user_id: user.id });
  if (error) return { error: error.message };
  revalidatePath(`/whiskies/${bottlingId}/history`);
  return { ok: true, liked: true };
}
