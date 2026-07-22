import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/notifications/unread-count
//   로그인 유저의 미읽음 알림 개수. RLS 로 user_id = auth.uid() 자동 필터.
//   벨 UI 폴링용 — 페이로드 최소.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) {
    return NextResponse.json({ count: 0, error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { count: count ?? 0 },
    {
      headers: {
        "Cache-Control": "private, max-age=0, no-store",
      },
    },
  );
}
