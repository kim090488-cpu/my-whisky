import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USER_STORAGE_BUCKETS = ["tasting-photos", "post-photos"] as const;

async function resolveUserId(request: NextRequest): Promise<string | null> {
  // 1) 웹: 세션 쿠키
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user.id;

  // 2) 모바일: Authorization Bearer 토큰
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const admin = createAdminClient();
  const { data } = await admin.auth.getUser(token);
  return data.user?.id ?? null;
}

async function purgeUserStorage(userId: string) {
  const admin = createAdminClient();
  for (const bucket of USER_STORAGE_BUCKETS) {
    // 각 버킷에서 user_id/ 프리픽스의 모든 오브젝트 나열 → 삭제
    const { data: files, error } = await admin.storage
      .from(bucket)
      .list(userId, { limit: 1000 });
    if (error || !files || files.length === 0) continue;

    const paths = files
      .filter((f) => f.name && !f.name.endsWith("/"))
      .map((f) => `${userId}/${f.name}`);
    if (paths.length === 0) continue;

    await admin.storage.from(bucket).remove(paths);
  }
}

export async function POST(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await purgeUserStorage(userId);
  } catch {
    // 스토리지 실패는 계정 삭제를 막지 않음(파일은 고아로 남을 뿐 노출은 안 됨).
  }

  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // 웹 세션 쿠키 클리어 (모바일은 무해)
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
