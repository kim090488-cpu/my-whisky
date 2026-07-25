// ────────────────────────────────────────────────
// send-push — notifications.INSERT 웹훅 받아서 Expo Push 발송
//
// Webhook payload (Supabase Database Webhook):
//   {
//     type: "INSERT",
//     table: "notifications",
//     record: { id, user_id, kind, actor_id, target_table, target_id, payload, ... },
//     schema: "public",
//     old_record: null
//   }
//
// 흐름:
//   1. payload 검증 (notifications INSERT 만)
//   2. user_id의 enabled push_subscriptions 모두 조회
//   3. actor profile 가져와서 알림 문구 생성
//   4. Expo Push API 호출 (배치)
//   5. notifications.sent_at + error 업데이트
//
// 배포:
//   supabase functions deploy send-push --no-verify-jwt
//   (Webhook 자체 인증을 쓰므로 JWT 검증 끔. 대신 SEND_PUSH_SECRET 헤더 검증으로 보호)
//
// 필수 env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (Supabase가 자동 주입)
//   SEND_PUSH_SECRET                        (직접 설정. Database Webhook의
//                                            Authorization 헤더 값과 일치해야 함)
// ────────────────────────────────────────────────

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.byteLength !== bb.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < ba.byteLength; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

type NotificationRecord = {
  id: string;
  user_id: string;
  kind: "like" | "comment" | "follow";
  actor_id: string | null;
  target_table: string | null;
  target_id: string | null;
  payload: Record<string, unknown> | null;
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: NotificationRecord | null;
  old_record: NotificationRecord | null;
};

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const expectedSecret = Deno.env.get("SEND_PUSH_SECRET");
  if (!expectedSecret) {
    return new Response("server misconfigured: SEND_PUSH_SECRET missing", { status: 500 });
  }
  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const provided = auth.replace(/^Bearer\s+/i, "").trim();
  if (!provided || !timingSafeEqual(provided, expectedSecret)) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  if (
    payload.type !== "INSERT" ||
    payload.table !== "notifications" ||
    !payload.record
  ) {
    return new Response("ignored", { status: 200 });
  }

  const notif = payload.record;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // 웹훅 재시도로 인한 중복 발송 방지: 이미 sent_at이 세팅됐으면 조기 반환
  const { data: existing } = await supabase
    .from("notifications")
    .select("sent_at")
    .eq("id", notif.id)
    .maybeSingle();

  if (existing?.sent_at) {
    return new Response(
      JSON.stringify({ ok: true, skipped: "already_sent" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // 1. 받는 사람 enabled 토큰
  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("expo_push_token")
    .eq("user_id", notif.user_id)
    .eq("enabled", true);

  if (subsErr) {
    await markFailed(supabase, notif.id, `subs query: ${subsErr.message}`);
    return new Response("subs error", { status: 500 });
  }

  if (!subs || subs.length === 0) {
    await markFailed(supabase, notif.id, "no_subscriptions");
    return new Response("no subscriptions", { status: 200 });
  }

  // 2. 알림 문구
  const { title, body } = await buildMessage(supabase, notif);

  // 3. Expo Push API 배치
  const messages = subs.map((s) => ({
    to: s.expo_push_token,
    title,
    body,
    data: {
      notification_id: notif.id,
      kind: notif.kind,
      target_table: notif.target_table,
      target_id: notif.target_id,
    },
    sound: "default",
    priority: "default",
    channelId: "default",
  }));

  let expoResult: unknown;
  try {
    const expoRes = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    expoResult = await expoRes.json();
    if (!expoRes.ok) {
      await markFailed(supabase, notif.id, `expo ${expoRes.status}`);
      return new Response(
        JSON.stringify({ error: "expo_send_failed", status: expoRes.status }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }
  } catch (e) {
    await markFailed(supabase, notif.id, e instanceof Error ? e.message : String(e));
    return new Response("expo fetch failed", { status: 500 });
  }

  await supabase
    .from("notifications")
    .update({ sent_at: new Date().toISOString(), error: null })
    .eq("id", notif.id);

  return new Response(
    JSON.stringify({ ok: true, sent: messages.length, expo: expoResult }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});

async function buildMessage(
  supabase: SupabaseClient,
  notif: NotificationRecord,
): Promise<{ title: string; body: string }> {
  let actorName = "누군가";
  if (notif.actor_id) {
    const { data: actor } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", notif.actor_id)
      .maybeSingle();
    if (actor) actorName = actor.display_name ?? actor.username ?? "사용자";
  }

  switch (notif.kind) {
    case "like":
      return { title: actorName, body: "회원님 노트에 좋아요를 눌렀어요" };
    case "comment": {
      const snippet = (notif.payload?.body as string | undefined)?.trim();
      return {
        title: actorName,
        body: snippet ? `: ${snippet}` : "댓글을 달았어요",
      };
    }
    case "follow":
      return { title: actorName, body: "회원님을 팔로우하기 시작했어요" };
    default:
      return { title: "my-whisky", body: "새 알림" };
  }
}

async function markFailed(
  supabase: SupabaseClient,
  id: string,
  error: string,
) {
  await supabase
    .from("notifications")
    .update({ sent_at: new Date().toISOString(), error })
    .eq("id", id);
}
