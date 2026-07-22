import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Foreground 알림 표시 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushRegisterResult =
  | { ok: true; token: string }
  | { ok: false; reason: "not_device" | "permission_denied" | "no_project_id" | "error"; message?: string };

/**
 * 권한 요청 + Expo Push Token 발급 + Supabase 저장.
 * Expo Go 에서도 동작 (Expo가 projectId로 발급).
 */
export async function registerForPushNotifications(userId: string): Promise<PushRegisterResult> {
  if (!Device.isDevice) {
    return { ok: false, reason: "not_device", message: "실기기에서만 푸시 알림이 동작해요." };
  }

  // Android: 채널 설정 필요
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#fbbf24",
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted;
  }
  if (!granted) {
    return { ok: false, reason: "permission_denied" };
  }

  // Expo Push Token — projectId 필요 (eas.json 또는 app.config 의 extra.eas.projectId)
  try {
    const projectId =
      (await import("expo-constants")).default.expoConfig?.extra?.eas?.projectId
        ?? (await import("expo-constants")).default.easConfig?.projectId;

    const tokenResp = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    const token = tokenResp.data;

    // Supabase 저장 (upsert)
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          expo_push_token: token,
          platform: Platform.OS as "ios" | "android" | "web",
          device_label: Device.modelName ?? null,
          enabled: true,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,expo_push_token" },
      );
    if (error) return { ok: false, reason: "error", message: error.message };

    return { ok: true, token };
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export async function setPushEnabled(userId: string, token: string, enabled: boolean) {
  const { error } = await supabase
    .from("push_subscriptions")
    .update({ enabled, last_seen_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("expo_push_token", token);
  if (error) throw new Error(error.message);
}

/** 본인에게 테스트 알림을 Expo Push API로 직접 발송 */
export async function sendTestPush(token: string, title: string, body: string) {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: token, title, body, sound: null, priority: "default" }),
  });
  if (!res.ok) throw new Error(`Push 실패: ${res.status}`);
  return await res.json();
}
