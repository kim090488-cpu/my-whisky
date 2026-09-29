import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth-context";

const USERNAME_RE = /^[a-z0-9_가-힣]{3,30}$/;

export default function ProfileEditScreen() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, display_name, bio")
        .eq("id", session.user.id)
        .maybeSingle();
      setUsername(data?.username ?? "");
      setDisplayName(data?.display_name ?? "");
      setBio(data?.bio ?? "");
      setLoading(false);
    })();
  }, [session]);

  async function submit() {
    if (!session) return;
    setError(null);
    setOkMsg(null);

    const usernameRaw = username.trim().toLowerCase();
    const displayTrimmed = displayName.trim();
    const bioTrimmed = bio.trim();

    if (!USERNAME_RE.test(usernameRaw)) {
      setError("아이디는 3~30자, 한글·영문 소문자·숫자·언더스코어(_)만 가능합니다.");
      return;
    }
    if (displayTrimmed && displayTrimmed.length > 30) {
      setError("닉네임은 30자 이하여야 합니다.");
      return;
    }
    if (bioTrimmed && bioTrimmed.length > 300) {
      setError("소개는 300자 이하여야 합니다.");
      return;
    }

    setPending(true);
    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", usernameRaw)
        .neq("id", session.user.id)
        .maybeSingle();
      if (existing) {
        setError("이미 사용 중인 아이디입니다.");
        setPending(false);
        return;
      }

      const { error: upErr } = await supabase
        .from("profiles")
        .update({
          username: usernameRaw,
          display_name: displayTrimmed || null,
          bio: bioTrimmed || null,
        })
        .eq("id", session.user.id);
      if (upErr) {
        // race condition: 중복 체크와 update 사이 다른 유저가 같은 username 등록
        if (/unique|duplicate|profiles_username/i.test(upErr.message)) {
          setError("이미 사용 중인 아이디입니다.");
          setPending(false);
          return;
        }
        // CHECK 제약(길이·형식) 위반
        if (/check constraint|check_constraint/i.test(upErr.message)) {
          setError("입력값 형식이 올바르지 않습니다.");
          setPending(false);
          return;
        }
        throw upErr;
      }

      setUsername(usernameRaw);
      setDisplayName(displayTrimmed);
      setBio(bioTrimmed);
      setOkMsg("저장됐어요.");
      setTimeout(() => router.back(), 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요.");
    } finally {
      setPending(false);
    }
  }

  if (sessionLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fbbf24" />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>로그인이 필요해요.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0a0a0a" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <KeyboardAwareScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={80}
      >
        <Text style={styles.hint}>
          아이디는 공개 프로필 URL에 사용돼요 (예:{" "}
          <Text style={styles.hintCode}>/profile/{username || "<아이디>"}</Text>).
        </Text>

        <Field
          label="아이디"
          hint="3~30자, 한글·영문 소문자·숫자·언더스코어(_)"
        >
          <TextInput
            value={username}
            onChangeText={(v) => setUsername(v.toLowerCase())}
            placeholder="myhandle"
            placeholderTextColor="#525252"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </Field>

        <Field label="닉네임" hint="다른 사용자에게 보여지는 이름 (선택)">
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="예: 위스키 탐험가"
            placeholderTextColor="#525252"
            maxLength={30}
            style={styles.input}
          />
          <Text style={styles.counter}>{displayName.length}/30</Text>
        </Field>

        <Field label="소개" hint="300자 이내">
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="자기소개를 적어주세요"
            placeholderTextColor="#525252"
            multiline
            numberOfLines={4}
            maxLength={300}
            style={[styles.input, styles.textarea]}
          />
          <Text style={styles.counter}>{bio.length}/300</Text>
        </Field>

        {error && <Text style={styles.errorText}>{error}</Text>}
        {okMsg && <Text style={styles.okText}>{okMsg}</Text>}

        <Pressable
          onPress={submit}
          disabled={pending}
          style={({ pressed }) => [
            styles.primaryBtn,
            pending && styles.primaryBtnDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.primaryBtnText}>{pending ? "저장 중…" : "저장"}</Text>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          disabled={pending}
          style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.cancelBtnText}>취소</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, hint, children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {hint && <Text style={styles.fieldHint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#0a0a0a",
  },
  emptyText: { color: "#a3a3a3", fontSize: 14 },
  container: { padding: 20, paddingBottom: 40, gap: 18 },
  hint: {
    fontSize: 12, color: "#a3a3a3", lineHeight: 18,
    padding: 12, borderRadius: 8,
    backgroundColor: "#111", borderWidth: 1, borderColor: "#262626",
  },
  hintCode: { color: "#e5e5e5" },

  field: { gap: 6 },
  fieldHead: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  fieldLabel: {
    fontSize: 11, color: "#a3a3a3",
    textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "600",
  },
  fieldHint: { fontSize: 10, color: "#525252" },

  input: {
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    color: "#fafafa",
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 8, fontSize: 15,
  },
  textarea: { minHeight: 100, textAlignVertical: "top", paddingTop: 12 },
  counter: { alignSelf: "flex-end", fontSize: 10, color: "#525252" },

  errorText: {
    color: "#fca5a5", fontSize: 12,
    padding: 10, borderRadius: 6,
    backgroundColor: "rgba(244,63,94,0.08)",
  },
  okText: {
    color: "#6ee7b7", fontSize: 12,
    padding: 10, borderRadius: 6,
    backgroundColor: "rgba(16,185,129,0.08)",
  },

  primaryBtn: {
    marginTop: 4,
    backgroundColor: "#fbbf24",
    paddingVertical: 13, borderRadius: 10, alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: "#0a0a0a", fontSize: 15, fontWeight: "700" },

  cancelBtn: {
    paddingVertical: 12, borderRadius: 10, alignItems: "center",
    borderWidth: 1, borderColor: "#262626",
  },
  cancelBtnText: { color: "#a3a3a3", fontSize: 14 },
});
