"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { rateLimit } from "./rate-limit";

const MIN_PASSWORD_LEN = 8;

// 일반/유출 빈도 상위에서 추린 거절 목록.
// 완벽한 방어는 아니지만 가장 약한 패턴은 거른다. 더 강한 검사는 zxcvbn 또는 HIBP API.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd",
  "qwerty", "qwerty123", "qwertyuiop",
  "123456", "1234567", "12345678", "123456789", "1234567890",
  "111111", "000000", "abc123",
  "letmein", "iloveyou", "admin", "admin123", "root", "toor",
  "welcome", "welcome1", "monkey", "dragon", "master",
  "test1234", "qweasd123", "asdf1234",
]);

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (m.includes("email not confirmed")) return "이메일 인증이 아직 완료되지 않았어요. 받은 메일에서 인증 링크를 눌러주세요.";
  if (m.includes("user already registered") || m.includes("already been registered")) return "이미 가입된 이메일이에요. 로그인 해주세요.";
  if (m.includes("password should be at least")) return `비밀번호는 ${MIN_PASSWORD_LEN}자 이상이어야 해요.`;
  if (m.includes("password is known to be weak") || m.includes("pwned")) return "유출된 적이 있는 비밀번호예요. 다른 걸로 바꿔주세요.";
  if (m.includes("invalid format") && m.includes("email")) return "이메일 형식이 올바르지 않아요.";
  if (m.includes("unable to validate email")) return "이메일 형식이 올바르지 않아요.";
  if (m.includes("email rate limit")) return "이메일 발송 한도를 초과했어요. 잠시 후 다시 시도해주세요.";
  if (m.includes("for security purposes, you can only request this after")) {
    const sec = msg.match(/after (\d+) seconds?/i)?.[1];
    return sec ? `보안을 위해 ${sec}초 후에 다시 시도해주세요.` : "보안을 위해 잠시 후 다시 시도해주세요.";
  }
  if (m.includes("signup is disabled") || m.includes("signups not allowed")) return "현재 신규 가입이 비활성화되어 있어요.";
  if (m.includes("user not found")) return "등록된 계정이 없어요.";
  if (m.includes("token has expired") || m.includes("invalid token")) return "인증 링크가 만료됐어요. 다시 시도해주세요.";
  if (m.includes("network")) return "네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.";
  return "로그인 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.";
}

function passwordTooWeak(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LEN) return `비밀번호는 ${MIN_PASSWORD_LEN}자 이상이어야 해요.`;
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) return "너무 흔한 비밀번호예요. 다른 걸로 바꿔주세요.";
  // 같은 문자만 반복(예: aaaaaaaaaaaa) 차단
  if (/^(.)\1+$/.test(pw)) return "더 다양한 문자를 사용해 주세요.";
  return null;
}

async function clientFingerprint(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return ip;
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "이메일/비밀번호를 입력해주세요." };

  const ip = await clientFingerprint();
  // IP+이메일 조합: 분당 5회, 시간당 20회
  const ipMin = rateLimit(`login:ip:${ip}:1m`, { max: 5, windowMs: 60_000 });
  const ipHour = rateLimit(`login:ip:${ip}:1h`, { max: 20, windowMs: 60 * 60_000 });
  const emailMin = rateLimit(`login:email:${email}:1m`, { max: 5, windowMs: 60_000 });
  if (!ipMin.ok || !ipHour.ok || !emailMin.ok) {
    return { error: "로그인 시도가 너무 많아요. 잠시 후 다시 시도해 주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: translateAuthError(error.message) };

  redirect("/me");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "이메일/비밀번호를 입력해주세요." };

  const weakness = passwordTooWeak(password);
  if (weakness) return { error: weakness };

  const ip = await clientFingerprint();
  // 가입은 더 보수적으로: 분당 3회, 시간당 10회
  const ipMin = rateLimit(`signup:ip:${ip}:1m`, { max: 3, windowMs: 60_000 });
  const ipHour = rateLimit(`signup:ip:${ip}:1h`, { max: 10, windowMs: 60 * 60_000 });
  if (!ipMin.ok || !ipHour.ok) {
    return { error: "가입 시도가 너무 많아요. 잠시 후 다시 시도해 주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: translateAuthError(error.message) };

  redirect("/me");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function signInWithProvider(provider: "google" | "kakao") {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data?.url) {
    return { error: translateAuthError(error?.message ?? "") };
  }
  redirect(data.url);
}
