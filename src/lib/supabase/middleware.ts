import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/api", "/auth", "/whiskies", "/distilleries", "/tastings", "/ranking", "/picks", "/posts", "/profile", "/community", "/privacy", "/terms"];

const isDev = process.env.NODE_ENV !== "production";

function buildCsp(nonce: string): string {
  const supabaseConnect = ["https://*.supabase.co", "wss://*.supabase.co"].join(" ");
  return [
    "default-src 'self'",
    // 'self' + nonce 병기 — Next.js 정적 chunk와 nonce된 인라인 스크립트만 허용.
    // dev에서는 Turbopack HMR을 위해 'unsafe-eval' 추가.
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""}`,
    // style-src: <style> 태그와 <link stylesheet>은 self+nonce만 허용.
    // style-src-attr: React에서 흔한 인라인 style="..." 속성(progress bar width 등)은 별도 허용.
    // 'unsafe-inline'을 style-src 전체에 주지 않고 attr에만 제한해 XSS <style> 주입은 여전히 차단.
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseConnect}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function updateSession(request: NextRequest) {
  // Per-request nonce — Next.js가 x-nonce 헤더를 감지하면 자동으로 서버 컴포넌트에서 생성한
  // 인라인 <script>에 nonce 속성을 붙여준다.
  const nonce = crypto.randomUUID().replace(/-/g, "");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", buildCsp(nonce));

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          response.headers.set("Content-Security-Policy", buildCsp(nonce));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Content-Security-Policy", buildCsp(nonce));
    return redirect;
  }

  return response;
}
