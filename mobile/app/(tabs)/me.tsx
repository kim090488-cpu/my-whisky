import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, Image,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
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
      <KeyboardAwareScrollView
        contentContainerStyle={styles.formContainer}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={80}
      >
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
      </KeyboardAwareScrollView>
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
        : res.reason === "expo_go_limit" ? "Expo Go에서는 실제 푸시 알림을 받을 수 없어요.\n정식 앱 빌드가 준비되면 활성화됩니다."
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
    <ScrollView style={styles.meScroll} contentContainerStyle={styles.meContainer}>
      {/* 헤더 카드 */}
      <View style={styles.headerCard}>
        <View style={styles.avatarWrap}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
        </View>
        <Text style={styles.meName}>
          {profile?.display_name ?? profile?.username ?? "사용자"}
        </Text>
        {profile?.username && <Text style={styles.meHandle}>@{profile.username}</Text>}
        <Text style={styles.meEmail}>{session!.user.email}</Text>

        {profile?.username && (
          <Pressable
            onPress={() => router.push(`/profile/${profile.username}`)}
            style={({ pressed }) => [styles.profileCta, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.profileCtaText}>내 공개 프로필 보기</Text>
            <Ionicons name="chevron-forward" size={14} color="#fbbf24" />
          </Pressable>
        )}
      </View>

      {/* Stats 2×2 */}
      <View style={styles.statsGrid}>
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
        <Stat
          label="내 노트"
          value={counts.tastings}
          onPress={profile?.username ? () => router.push(`/profile/${profile.username}`) : undefined}
        />
        <Stat
          label="컬렉션"
          value={counts.collection}
          onPress={() => router.push("/(tabs)/collection" as never)}
        />
      </View>

      {/* 메뉴 리스트 */}
      <View style={styles.menuCard}>
        <MenuItem
          icon="camera-outline"
          label="내 모먼트"
          onPress={() => router.push("/posts?mine=1" as never)}
        />
        <MenuDivider />
        <MenuItem
          icon="sparkles-outline"
          label="AI 큐레이터"
          onPress={() => router.push("/curator" as never)}
        />
        <MenuDivider />
        <MenuItem
          icon="notifications-outline"
          label="알림"
          onPress={() => router.push("/notifications")}
        />
        <MenuDivider />
        <MenuItem
          icon="settings-outline"
          label="알림 설정"
          onPress={() => router.push("/notification-settings")}
        />
      </View>

      {/* 푸시 카드 */}
      <View style={styles.pushBox}>
        <View style={styles.pushHead}>
          <Ionicons name="phone-portrait-outline" size={16} color="#a3a3a3" />
          <Text style={styles.pushTitle}>푸시 알림</Text>
        </View>
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
        <Ionicons name="log-out-outline" size={16} color="#f43f5e" />
        <Text style={styles.signOutText}>{signingOut ? "로그아웃 중…" : "로그아웃"}</Text>
      </Pressable>
    </ScrollView>
  );
}

function MenuItem({
  icon, label, onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: "#1f1f1f" }]}
    >
      <Ionicons name={icon} size={18} color="#a3a3a3" />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#525252" />
    </Pressable>
  );
}

function MenuDivider() {
  return <View style={styles.menuDivider} />;
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
  meScroll: { flex: 1, backgroundColor: "#0a0a0a" },
  meContainer: { padding: 20, paddingTop: 40, paddingBottom: 40, gap: 16, backgroundColor: "#0a0a0a" },

  // 헤더 카드
  headerCard: {
    padding: 24, borderRadius: 16,
    backgroundColor: "#111",
    borderWidth: 1, borderColor: "#262626",
    alignItems: "center",
  },
  avatarWrap: {
    width: 96, height: 96, borderRadius: 48,
    padding: 3,
    backgroundColor: "#0a0a0a",
    borderWidth: 2, borderColor: "#404040",
    alignItems: "center", justifyContent: "center",
  },
  avatar: {
    width: "100%", height: "100%", borderRadius: 44,
    backgroundColor: "#1f1f1f",
    alignItems: "center", justifyContent: "center",
  },
  avatarImg: {
    width: "100%", height: "100%", borderRadius: 44,
  },
  avatarText: { color: "#fbbf24", fontSize: 36, fontWeight: "700" },
  meName: { marginTop: 14, fontSize: 22, fontWeight: "700", color: "#fafafa" },
  meHandle: { marginTop: 2, fontSize: 13, color: "#a3a3a3" },
  meEmail: { marginTop: 6, fontSize: 11, color: "#525252" },
  profileCta: {
    marginTop: 16, flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1, borderColor: "rgba(251,191,36,0.4)",
    backgroundColor: "rgba(251,191,36,0.06)",
  },
  profileCtaText: { color: "#fbbf24", fontSize: 12, fontWeight: "600" },

  // Stats 2×2
  statsGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
  },
  statBox: {
    flexBasis: "48%", flexGrow: 1,
    paddingVertical: 16, paddingHorizontal: 14,
    backgroundColor: "#111",
    borderRadius: 12,
    borderWidth: 1, borderColor: "#262626",
  },
  statLabel: { fontSize: 10, color: "#737373", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "600" },
  statValue: { marginTop: 6, fontSize: 24, fontWeight: "700", color: "#fafafa" },

  // 메뉴 리스트
  menuCard: {
    borderRadius: 12,
    backgroundColor: "#111",
    borderWidth: 1, borderColor: "#262626",
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  menuLabel: { flex: 1, color: "#fafafa", fontSize: 14 },
  menuDivider: { height: 1, backgroundColor: "#1f1f1f", marginLeft: 46 },

  // 푸시 카드
  pushBox: {
    padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: "#262626", backgroundColor: "#111",
  },
  pushHead: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginBottom: 12,
  },
  pushTitle: { color: "#a3a3a3", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "600" },
  pushBtn: { backgroundColor: "#fbbf24", paddingVertical: 11, borderRadius: 8, alignItems: "center" },
  pushBtnText: { color: "#0a0a0a", fontWeight: "700", fontSize: 13 },
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

  // 로그아웃
  signOutButton: {
    marginTop: 4,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 13, borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(244,63,94,0.25)",
    backgroundColor: "rgba(244,63,94,0.04)",
  },
  signOutText: { color: "#f43f5e", fontSize: 14, fontWeight: "600" },
});
