import * as Linking from "expo-linking";
import { supabase } from "./supabase";

export type OAuthProvider = "google" | "kakao";

type Result =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; error: string };

// Supabase OAuth PKCE. authorization URL을 시스템 브라우저로 열어서
// 카카오톡 앱 딥링크(kakaotalk://)까지 지원. 콜백은 app/auth/callback.tsx가 처리
//   redirect URL: production `mywhisky://auth/callback`, dev `exp://<ip>:8081/--/auth/callback`
//   Supabase URL Configuration의 Redirect URLs에 두 형태 모두 등록 필요
export async function signInWithProvider(provider: OAuthProvider): Promise<Result> {
  const redirectTo = Linking.createURL("auth/callback");
  console.log("[oauth] provider:", provider, "redirectTo:", redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) return { ok: false, error: error.message };
  if (!data?.url) return { ok: false, error: "OAuth URL을 받지 못했어요." };
  console.log("[oauth] auth url:", data.url);

  // 시스템 브라우저로 열기. 카카오는 kakaotalk 앱으로 스위치할 수 있어서
  // openAuthSessionAsync(in-app browser)로는 세션이 dismiss됨
  const canOpen = await Linking.canOpenURL(data.url);
  if (!canOpen) return { ok: false, error: "브라우저를 열 수 없어요." };
  await Linking.openURL(data.url);

  // 실제 세션 교환은 app/auth/callback.tsx가 딥링크로 앱 복귀 시 처리
  return { ok: true };
}
