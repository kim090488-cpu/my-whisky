import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/search?q=<term>&limit=8
//   증류소·보틀링 통합 빠른 검색. 자동완성용.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // 길이 상한 60자 — 긴 wildcard 페이로드 반복 호출로 DB fan-out DoS 차단.
  const q = (searchParams.get("q") ?? "").trim().slice(0, 60);
  const limit = Math.min(10, Math.max(1, Number(searchParams.get("limit")) || 6));

  if (q.length < 1) {
    return NextResponse.json({ distilleries: [], bottlings: [], users: [] });
  }

  // 사용자가 % _ 같은 LIKE wildcard를 직접 넣어도 escape (literal로 처리)
  const safe = q.replace(/[%_\\]/g, (m) => `\\${m}`);

  const supabase = await createClient();
  // 유저 열거 방어: users 검색은 로그인 필수. distilleries/bottlings는 unauth OK.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [distilleriesRes, bottlingsRes, usersRes] = await Promise.all([
    supabase
      .from("distilleries")
      .select("id, name, name_kr, country, region")
      .or(`name.ilike.%${safe}%,name_kr.ilike.%${safe}%`)
      .order("name")
      .limit(limit),
    supabase
      .from("bottling_card_stats")
      .select("id, name, name_kr, age_years, abv, distillery_name, distillery_name_kr, country, region, avg_score, tasting_count")
      .or(`name.ilike.%${safe}%,name_kr.ilike.%${safe}%`)
      .order("tasting_count", { ascending: false })
      .order("name")
      .limit(limit),
    user
      ? supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, follower_count")
          .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`)
          .order("follower_count", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  return NextResponse.json(
    {
      distilleries: distilleriesRes.data ?? [],
      bottlings: bottlingsRes.data ?? [],
      users: usersRes.data ?? [],
    },
    {
      headers: {
        // 짧은 캐시 (브라우저만). 사용자 RLS 다르니 CDN 캐시 X.
        "Cache-Control": "private, max-age=10",
      },
    },
  );
}
