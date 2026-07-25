import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/me";
  // 오픈 리다이렉트 방어: 상대경로만 허용 (`/`로 시작 + 두 번째 문자가 `/`나 `\`가 아님)
  // 차단 대상: `//evil.com`, `/\evil.com`, `https://evil.com`
  const safeNext = /^\/[^/\\]/.test(nextParam) ? nextParam : "/me";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth_no_code", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  return NextResponse.redirect(new URL(safeNext, url.origin));
}
