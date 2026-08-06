import * as Linking from "expo-linking";
import { supabase } from "./supabase";

export type OAuthProvider = "google" | "kakao";

type Result =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; error: string };

// Supabase OAuth PKCE. authorization URL을 시스템 브라우저로 열어서
// 카카오톡 앱 딥링크(kakaotalk://)까지 지원. 콜백은 app/auth/callback.tsx가 처리
//   redirect URL: `mywhisky://auth/callback` (하드코딩)
//   Linking.createURL()는 dev 모드에서 exp://<ip>:8081/--/... 로 나가는데
//   chrome이 exp:// 스킴을 처리 못해 Site URL로 fallback → 웹으로 이동. 하드코딩으로 우회.
export async function signInWithProvider(provider: OAuthProvider): Promise<Result> {
  const redirectTo = "mywhisky://auth/callback";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) return { ok: false, error: error.message };
  if (!data?.url) return { ok: false, error: "OAuth URL을 받지 못했어요." };

  // 시스템 브라우저로 열기. 카카오는 kakaotalk 앱으로 스위치할 수 있어서
  // openAuthSessionAsync(in-app browser)로는 세션이 dismiss됨
  const canOpen = await Linking.canOpenURL(data.url);
  if (!canOpen) return { ok: false, error: "브라우저를 열 수 없어요." };
  await Linking.openURL(data.url);

  // 실제 세션 교환은 app/auth/callback.tsx가 딥링크로 앱 복귀 시 처리
  return { ok: true };
}
