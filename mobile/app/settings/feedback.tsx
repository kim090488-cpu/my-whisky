import { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, Platform,
  KeyboardAvoidingView,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useRouter, Stack } from "expo-router";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth-context";

type Category = "bug" | "suggestion" | "question" | "other";

const CATEGORIES: { key: Category; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "bug",        label: "버그 신고",  icon: "bug-outline" },
  { key: "suggestion", label: "기능 건의",  icon: "bulb-outline" },
  { key: "question",   label: "질문",        icon: "help-circle-outline" },
  { key: "other",      label: "기타",        icon: "chatbubble-outline" },
];

export default function FeedbackScreen() {
  const router = useRouter();
  const { session } = useSession();
  const [category, setCategory] = useState<Category>("suggestion");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!session || pending) return;
    setError(null);

    const s = subject.trim();
    const b = body.trim();
    if (!s) { setError("제목을 입력해주세요."); return; }
    if (!b) { setError("내용을 입력해주세요."); return; }
    if (s.length > 200) { setError("제목은 200자 이내로 입력해주세요."); return; }
    if (b.length > 5000) { setError("내용은 5000자 이내로 입력해주세요."); return; }

    setPending(true);
    const { error: insErr } = await supabase
      .from("feedback")
      .insert({
        user_id: session.user.id,
        category,
        subject: s,
        body: b,
        app_version: Constants.expoConfig?.version ?? null,
        platform: Platform.OS,
      } as never);
    setPending(false);

    if (insErr) {
      setError(insErr.message);
      return;
    }
    Alert.alert(
      "접수됐어요.",
      "소중한 의견 감사합니다. 검토 후 반영할게요.",
      [{ text: "확인", onPress: () => router.back() }],
    );
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>로그인 후 이용 가능합니다.</Text>
      </View>
    );
  }

  const canSubmit = !!subject.trim() && !!body.trim() && !pending;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0a0a0a" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "문의·건의" }} />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={80}
      >
        <View style={styles.introCard}>
          <Ionicons name="mail-outline" size={16} color="#fbbf24" />
          <Text style={styles.introText}>
            앱 사용 중 불편한 점이나 기능 아이디어를 자유롭게 알려주세요.
            버그 신고에는 재현 방법과 기기 정보를 함께 적어주시면 큰 도움이 돼요.
          </Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>종류</Text>
          <View style={styles.pillWrap}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.key}
                onPress={() => setCategory(c.key)}
                style={({ pressed }) => [
                  styles.pill,
                  category === c.key && styles.pillActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons
                  name={c.icon}
                  size={13}
                  color={category === c.key ? "#fbbf24" : "#a3a3a3"}
                />
                <Text style={[styles.pillText, category === c.key && styles.pillTextActive]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>제목 *</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            maxLength={200}
            placeholder="예: 위스키 검색 시 자동완성이 느려요"
            placeholderTextColor="#525252"
            style={styles.input}
          />
          <Text style={styles.counter}>{subject.length}/200</Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>내용 *</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            maxLength={5000}
            placeholder="자세한 상황·재현 방법·원하는 개선점을 자유롭게 적어주세요"
            placeholderTextColor="#525252"
            multiline
            numberOfLines={8}
            style={[styles.input, styles.textarea]}
          />
          <Text style={styles.counter}>{body.length}/5000</Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.submit,
            !canSubmit && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.submitText}>{pending ? "전송 중…" : "관리자에게 보내기"}</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} disabled={pending}>
          <Text style={styles.cancel}>취소</Text>
        </Pressable>

        <Text style={styles.footNote}>
          접수된 문의는 관리자만 확인할 수 있어요. 답변이 필요한 경우 프로필 이메일로 회신드립니다.
        </Text>
      </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#0a0a0a", padding: 24,
  },
  muted: { color: "#737373", textAlign: "center" },

  container: { padding: 16, gap: 16, paddingBottom: 40 },

  introCard: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(251,191,36,0.06)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.25)",
  },
  introText: {
    flex: 1,
    color: "#d4d4d4",
    fontSize: 12,
    lineHeight: 18,
  },

  label: {
    color: "#a3a3a3",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#262626",
    color: "#fafafa",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
  },
  textarea: { minHeight: 160, textAlignVertical: "top", paddingTop: 12 },
  counter: { alignSelf: "flex-end", fontSize: 10, color: "#525252" },

  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#262626",
    backgroundColor: "#171717",
  },
  pillActive: { borderColor: "#fbbf24", backgroundColor: "rgba(251,191,36,0.1)" },
  pillText: { color: "#a3a3a3", fontSize: 12 },
  pillTextActive: { color: "#fbbf24", fontWeight: "600" },

  error: {
    color: "#fca5a5",
    fontSize: 12,
    padding: 10,
    borderRadius: 6,
    backgroundColor: "rgba(244,63,94,0.08)",
  },

  submit: {
    backgroundColor: "#fbbf24",
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  submitText: { color: "#0a0a0a", fontWeight: "700", fontSize: 15 },
  cancel: { color: "#737373", textAlign: "center", padding: 12 },

  footNote: {
    color: "#525252",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
});
