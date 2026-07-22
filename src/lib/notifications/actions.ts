"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type UpdateInput = {
  notify_like: boolean;
  notify_comment: boolean;
  notify_follow: boolean;
};

export async function updateNotificationSettings(
  input: UpdateInput,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("profiles")
    .update({
      notify_like: input.notify_like,
      notify_comment: input.notify_comment,
      notify_follow: input.notify_follow,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/me/notifications");
  return { ok: true };
}
