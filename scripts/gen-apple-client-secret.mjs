// Apple Sign in with Apple 용 client_secret JWT 생성
// Supabase Dashboard > Auth > Providers > Apple > Secret Key (for OAuth) 에 붙일 값
//
// 사용: node scripts/gen-apple-client-secret.mjs
// 결과: 표준출력에 JWT 출력 (자동으로 클립보드에도 복사 시도)
//
// ⚠️ Apple JWT는 최대 6개월 유효. 만료되면 이 스크립트 다시 돌려서
//    Supabase Dashboard에 새 값으로 교체해야 함.

import { readFileSync } from "node:fs";
import { sign } from "node:crypto";
import { execSync } from "node:child_process";

const TEAM_ID = "4MWK4CA6JP";
const KEY_ID = "9X37L23558";
const SERVICE_ID = "com.mywhisky.app.web"; // web OAuth flow의 client_id
const P8_PATH = new URL("../AuthKey_9X37L23558.p8", import.meta.url);

const now = Math.floor(Date.now() / 1000);
const exp = now + 60 * 60 * 24 * 180; // 6개월 (Apple 최대치)

const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp,
  aud: "https://appleid.apple.com",
  sub: SERVICE_ID,
};

const b64url = (input) => {
  const buf = Buffer.isBuffer(input)
    ? input
    : Buffer.from(typeof input === "string" ? input : JSON.stringify(input));
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};

const signInput = `${b64url(header)}.${b64url(payload)}`;
const p8 = readFileSync(P8_PATH, "utf8");

// ES256 서명: JWT/JOSE는 raw R||S 포맷 필요 (DER 아님)
const signature = sign("SHA256", Buffer.from(signInput), {
  key: p8,
  dsaEncoding: "ieee-p1363",
});

const jwt = `${signInput}.${b64url(signature)}`;

console.log("\n=== Apple client_secret JWT ===");
console.log(jwt);
console.log("\n=== 만료일 ===");
console.log(new Date(exp * 1000).toISOString(), `(${new Date(exp * 1000).toLocaleDateString("ko-KR")})`);

// 클립보드 복사 시도 (Windows)
try {
  execSync("clip", { input: jwt });
  console.log("\n✓ 클립보드에 복사됨 — Supabase Dashboard에 Ctrl+V로 붙여넣기");
} catch {
  console.log("\n(클립보드 복사 실패 — 위 JWT를 수동으로 복사하세요)");
}
