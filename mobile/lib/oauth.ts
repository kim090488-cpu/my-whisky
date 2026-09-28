import * as Linking from "expo-linking";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";
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

// Apple은 iOS 네이티브 API. identityToken을 받아 supabase.auth.signInWithIdToken으로
// 바로 세션 교환 (브라우저 라운드트립 없음). App Store Guideline 4.8 대응.
// Android/웹은 Apple provider의 브라우저 OAuth 폴백을 쓸 수도 있지만 UX가 나빠서 iOS 전용
export async function signInWithApple(): Promise<Result> {
  if (Platform.OS !== "ios") {
    return { ok: false, error: "Apple 로그인은 iOS 기기에서만 지원해요." };
  }
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      return { ok: false, error: "Apple ID 토큰을 받지 못했어요." };
    }
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: unknown) {
    // 사용자가 시트를 닫은 경우
    if (e && typeof e === "object" && "code" in e && e.code === "ERR_REQUEST_CANCELED") {
      return { ok: false, cancelled: true };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Apple 로그인 실패" };
  }
}
