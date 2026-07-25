import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  registerForPushNotifications, setPushEnabled, sendTestPush,
} from "@/lib/push";
import { signInWithProvider, type OAuthProvider } from "@/lib/oauth";

export default function MeScreen() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fbbf24" />
      </View>
    );
  }

  return session ? <LoggedIn /> : <LoggedOut />;
}

// ───────────────────────── 비로그인: 로그인/가입 폼 ─────────────────────────
function LoggedOut() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState<OAuthProvider | null>(null);

  async function submit() {
    setError(null);
    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    setPending(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했어요.");
    } finally {
      setPending(false);
    }
  }

  async function oauth(provider: OAuthProvider) {
    setError(null);
    setOauthPending(provider);
    try {
      const res = await signInWithProvider(provider);
      if (!res.ok && !("cancelled" in res && res.cancelled)) {
        setError("error" in res ? res.error : "로그인에 실패했어요.");
      }
    } finally {
      setOauthPending(null);
    }
  }

  const busy = pending || oauthPending !== null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0a0a0a" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>my-whisky</Text>
        <Text style={styles.formTitle}>{mode === "login" ? "로그인" : "가입"}</Text>

        <Pressable
          onPress={() => oauth("google")}
          disabled={busy}
          style={({ pressed }) => [
            styles.oauthButton,
            styles.oauthGoogle,
            busy && styles.oauthButtonDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.oauthGoogleText}>
            {oauthPending === "google" ? "Google로 이동 중…" : "Google로 계속하기"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => oauth("kakao")}
          disabled={busy}
          style={({ pressed }) => [
            styles.oauthButton,
            styles.oauthKakao,
            busy && styles.oauthButtonDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.oauthKakaoText}>
            {oauthPending === "kakao" ? "카카오로 이동 중…" : "카카오로 계속하기"}
          </Text>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>또는 이메일</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="이메일"
          placeholderTextColor="#525252"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={mode === "signup" ? "비밀번호 (8자 이상)" : "비밀번호"}
          placeholderTextColor="#525252"
          secureTextEntry
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          style={styles.input}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={busy || !email || !password}
          style={({ pressed }) => [
            styles.primaryButton,
            (busy || !email || !password) && styles.primaryButtonDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {pending ? "잠시만요…" : mode === "login" ? "로그인" : "가입"}
          </Text>
        </Pressable>

        <Pressable onPress={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}>
          <Text style={styles.toggleText}>
            {mode === "login" ? "계정이 없으신가요? 가입" : "이미 계정이 있나요? 로그인"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ───────────────────────── 로그인: 프로필 + 로그아웃 ─────────────────────────
type Profile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number;
  following_count: number;
};

function LoggedIn() {
  const router = useRouter();
  const { session } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [counts, setCounts] = useState({ tastings: 0, collection: 0 });
  const [signingOut, setSigningOut] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushEnabled, setPushEnabledState] = useState<boolean>(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const [pRes, tRes, cRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, display_name, avatar_url, follower_count, following_count")
          .eq("id", session.user.id)
          .maybeSingle(),
        supabase.from("tastings").select("*", { count: "exact", head: true }).eq("user_id", session.user.id),
        supabase.from("collection_items").select("*", { count: "exact", head: true }).eq("user_id", session.user.id),
      ]);
      setProfile(pRes.data);
      setCounts({ tastings: tRes.count ?? 0, collection: cRes.count ?? 0 });

      // 본인의 푸시 구독 (가장 최근 1건)
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("expo_push_token, enabled")
        .eq("user_id", session.user.id)
        .order("last_seen_at", { ascending: false })
        .limit(1);
      const sub = subs?.[0];
      if (sub) {
        setPushToken(sub.expo_push_token);
        setPushEnabledState(sub.enabled);
      }
    })();
  }, [session]);

  async function enablePush() {
    if (!session) return;
    setPushBusy(true);
    const res = await registerForPushNotifications(session.user.id);
    setPushBusy(false);
    if (!res.ok) {
      const msg =
        res.reason === "not_device" ? "실기기에서만 푸시 알림이 동작해요."
        : res.reason === "permission_denied" ? "알림 권한이 거부됐어요. 설정에서 허용해주세요."
        : res.message ?? "푸시 등록 실패";
      return alert(msg);
    }
    setPushToken(res.token);
    setPushEnabledState(true);
  }

  async function togglePush() {
    if (!session || !pushToken) return;
    setPushBusy(true);
    try {
      await setPushEnabled(session.user.id, pushToken, !pushEnabled);
      setPushEnabledState(!pushEnabled);
    } catch (e) {
      alert(e instanceof Error ? e.message : "실패");
    } finally {
      setPushBusy(false);
    }
  }

  async function testPush() {
    if (!pushToken) return;
    try {
      await sendTestPush(pushToken, "my-whisky 테스트", "푸시 알림이 정상적으로 동작합니다 🥃");
      alert("Expo에 발송됨 — 잠시 후 알림 뜸 (앱이 백그라운드일 때 더 잘 보임)");
    } catch (e) {
      alert(e instanceof Error ? e.message : "실패");
    }
  }

  async function signOut() {
    setSigningOut(true);
    // 이 기기의 푸시 구독 비활성화 (다른 계정으로 로그인 시 이전 계정에 도달 방지)
    if (session && pushToken) {
      await supabase
        .from("push_subscriptions")
        .update({ enabled: false })
        .eq("user_id", session.user.id)
        .eq("expo_push_token", pushToken);
    }
    await supabase.auth.signOut();
    setSigningOut(false);
  }

  const initial = (profile?.display_name ?? profile?.username ?? session!.user.email ?? "?")
    .trim().charAt(0).toUpperCase();

  return (
    <ScrollView contentContainerStyle={styles.meContainer}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>

      <Text style={styles.meName}>
        {profile?.display_name ?? profile?.username ?? "사용자"}
      </Text>
      {profile?.username && <Text style={styles.meHandle}>@{profile.username}</Text>}
      <Text style={styles.meEmail}>{session!.user.email}</Text>

      <View style={styles.statsRow}>
        <Stat
          label="팔로워"
          value={profile?.follower_count ?? 0}
          onPress={profile?.username ? () => router.push(`/profile/${profile.username}/followers`) : undefined}
        />
        <Stat
          label="팔로잉"
          value={profile?.following_count ?? 0}
          onPress={profile?.username ? () => router.push(`/profile/${profile.username}/following`) : undefined}
        />
        <Stat label="내 노트" value={counts.tastings} />
        <Stat label="컬렉션" value={counts.collection} />
      </View>

      {profile?.username && (
        <Pressable
          onPress={() => router.push(`/profile/${profile.username}`)}
          style={({ pressed }) => [styles.profileLink, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.profileLinkText}>내 공개 프로필 보기 →</Text>
        </Pressable>
      )}

      <Pressable
        onPress={() => router.push("/posts")}
        style={({ pressed }) => [styles.profileLink, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.profileLinkText}>모먼트 →</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/notifications")}
        style={({ pressed }) => [styles.profileLink, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.profileLinkText}>알림 →</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/notification-settings")}
        style={({ pressed }) => [styles.profileLink, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.profileLinkText}>알림 설정 →</Text>
      </Pressable>

      <View style={styles.pushBox}>
        <Text style={styles.pushTitle}>푸시 알림</Text>
        {!pushToken ? (
          <Pressable
            onPress={enablePush}
            disabled={pushBusy}
            style={({ pressed }) => [styles.pushBtn, pressed && { opacity: 0.85 }, pushBusy && { opacity: 0.5 }]}
          >
            <Text style={styles.pushBtnText}>{pushBusy ? "등록 중…" : "푸시 알림 받기"}</Text>
          </Pressable>
        ) : (
          <>
            <View style={styles.pushRow}>
              <Pressable
                onPress={togglePush}
                disabled={pushBusy}
                style={({ pressed }) => [
                  styles.pushToggle,
                  pushEnabled && styles.pushToggleOn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[styles.pushToggleText, pushEnabled && styles.pushToggleTextOn]}>
                  {pushEnabled ? "ON" : "OFF"}
                </Text>
              </Pressable>
              <Pressable onPress={testPush}>
                <Text style={styles.pushTest}>테스트 발송</Text>
              </Pressable>
            </View>
            <Text style={styles.pushHint} numberOfLines={1}>
              {pushToken.slice(0, 30)}…
            </Text>
          </>
        )}
      </View>

      <Pressable
        onPress={signOut}
        disabled={signingOut}
        style={({ pressed }) => [
          styles.signOutButton,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.signOutText}>{signingOut ? "로그아웃 중…" : "로그아웃"}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({
  label, value, onPress,
}: {
  label: string;
  value: number;
  onPress?: () => void;
}) {
  const inner = (
    <>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.statBox, pressed && { opacity: 0.7 }]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={styles.statBox}>{inner}</View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a" },

  // 폼 (비로그인)
  formContainer: { padding: 24, paddingTop: 48, gap: 14 },
  brand: { fontSize: 28, fontWeight: "700", color: "#fbbf24", letterSpacing: -0.5 },
  formTitle: { fontSize: 22, fontWeight: "600", color: "#fafafa", marginTop: 16, marginBottom: 8 },
  input: {
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#262626",
    color: "#fafafa",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 15,
  },
  error: { color: "#fca5a5", fontSize: 13 },
  primaryButton: {
    backgroundColor: "#fbbf24",
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: "#0a0a0a", fontWeight: "600", fontSize: 15 },
  toggleText: { color: "#a3a3a3", textAlign: "center", marginTop: 16, fontSize: 13 },
  oauthButton: {
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  oauthButtonDisabled: { opacity: 0.5 },
  oauthGoogle: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d4d4d4",
  },
  oauthGoogleText: { color: "#171717", fontWeight: "600", fontSize: 15 },
  oauthKakao: { backgroundColor: "#FEE500" },
  oauthKakaoText: { color: "#191919", fontWeight: "600", fontSize: 15 },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#262626" },
  dividerText: { color: "#737373", fontSize: 12 },

  // 로그인 상태 (Me)
  meContainer: { padding: 24, paddingTop: 48, alignItems: "center" },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "rgba(180, 83, 9, 0.3)",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fde68a", fontSize: 36, fontWeight: "600" },
  meName: { marginTop: 16, fontSize: 22, fontWeight: "700", color: "#fafafa" },
  meHandle: { marginTop: 2, fontSize: 14, color: "#a3a3a3" },
  meEmail: { marginTop: 2, fontSize: 12, color: "#737373" },

  statsRow: { marginTop: 28, flexDirection: "row", gap: 8, alignSelf: "stretch" },
  statBox: {
    flex: 1, padding: 12,
    backgroundColor: "#171717",
    borderRadius: 8,
    borderWidth: 1, borderColor: "#262626",
    alignItems: "center",
  },
  statLabel: { fontSize: 10, color: "#737373", textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { marginTop: 3, fontSize: 18, fontWeight: "700", color: "#fafafa" },

  profileLink: { marginTop: 28 },
  profileLinkText: { color: "#fbbf24", fontSize: 14, fontWeight: "500" },

  pushBox: {
    marginTop: 24, padding: 16, borderRadius: 10,
    borderWidth: 1, borderColor: "#262626", backgroundColor: "#171717",
    width: "100%",
  },
  pushTitle: { color: "#a3a3a3", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  pushBtn: { backgroundColor: "#fbbf24", paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  pushBtnText: { color: "#0a0a0a", fontWeight: "600", fontSize: 13 },
  pushRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  pushToggle: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 6, borderWidth: 1, borderColor: "#404040",
  },
  pushToggleOn: { borderColor: "#fbbf24", backgroundColor: "rgba(251, 191, 36, 0.15)" },
  pushToggleText: { color: "#a3a3a3", fontSize: 12, fontWeight: "600" },
  pushToggleTextOn: { color: "#fde68a" },
  pushTest: { color: "#fbbf24", fontSize: 12 },
  pushHint: { color: "#525252", fontSize: 10, marginTop: 8 },

  signOutButton: {
    marginTop: 20,
    paddingHorizontal: 24, paddingVertical: 11,
    borderWidth: 1, borderColor: "#404040", borderRadius: 8,
  },
  signOutText: { color: "#a3a3a3", fontSize: 14, fontWeight: "500" },
});
