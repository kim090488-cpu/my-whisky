import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

const CATEGORIES = [
  { v: "question", label: "질문" },
  { v: "recommendation", label: "추천" },
  { v: "tip", label: "팁" },
  { v: "free", label: "잡담" },
] as const;
type Category = (typeof CATEGORIES)[number]["v"];

export default function CommunityNew() {
  const { edit: editId } = useLocalSearchParams<{ edit?: string }>();
  const isEdit = !!editId;
  const router = useRouter();
  const { session } = useSession();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Category>("free");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editId || !session) return;
    (async () => {
      const { data } = await supabase
        .from("community_posts")
        .select("id, user_id, category, title, body")
        .eq("id", editId)
        .maybeSingle();
      const p = data as unknown as { id: string; user_id: string; category: Category; title: string; body: string } | null;
      if (!p || p.user_id !== session.user.id) {
        Alert.alert("접근 불가", "본인이 작성한 글만 수정할 수 있어요.");
        router.back();
        return;
      }
      setCategory(p.category);
      setTitle(p.title);
      setBody(p.body);
      setLoading(false);
    })();
  }, [editId, session, router]);

  async function submit() {
    if (!session || saving) return;
    setError(null);
    const t = title.trim();
    const b = body.trim();
    if (t.length < 1) { setError("제목을 입력해주세요."); return; }
    if (t.length > 200) { setError("제목은 200자 이내."); return; }
    if (b.length < 1) { setError("본문을 입력해주세요."); return; }
    if (b.length > 10000) { setError("본문은 10000자 이내."); return; }

    setSaving(true);
    if (isEdit && editId) {
      const { error: updateError } = await supabase
        .from("community_posts")
        .update({ category, title: t, body: b } as never)
        .eq("id", editId)
        .eq("user_id", session.user.id);
      setSaving(false);
      if (updateError) { setError(updateError.message); return; }
      router.replace(`/community/${editId}` as never);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("community_posts")
      .insert({ user_id: session.user.id, category, title: t, body: b } as never)
      .select("id")
      .single();
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    const newId = (data as unknown as { id: string } | null)?.id;
    if (newId) router.replace(`/community/${newId}` as never);
    else router.replace("/community" as never);
  }

  if (!session) {
    return <View style={styles.center}><Text style={styles.muted}>로그인 후 이용 가능합니다.</Text></View>;
  }
  if (loading) return <View style={styles.center}><ActivityIndicator color="#fbbf24" /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#0a0a0a" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: isEdit ? "게시글 수정" : "새 게시글" }} />
      <KeyboardAwareScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" enableOnAndroid extraScrollHeight={80}>
        <Text style={styles.lead}>위스키 관련 무엇이든 자유롭게 남겨보세요.</Text>

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>카테고리</Text>
          <View style={styles.catRow}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.v}
                onPress={() => setCategory(c.v)}
                style={({ pressed }) => [styles.catPill, category === c.v && styles.catPillActive, pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.catText, category === c.v && styles.catTextActive]}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>제목 *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={200}
            placeholder="예: 5만원대 입문 위스키 추천 부탁드립니다"
            placeholderTextColor="#525252"
            style={styles.input}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>본문 * ({body.length}/10000)</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={10000}
            placeholder="자유롭게 작성해주세요"
            placeholderTextColor="#525252"
            style={[styles.input, styles.textareaTall]}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={saving || !title.trim() || !body.trim()}
          style={({ pressed }) => [
            styles.submitBtn,
            (saving || !title.trim() || !body.trim()) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.submitText}>{saving ? "저장 중…" : isEdit ? "수정 저장" : "게시"}</Text>
        </Pressable>

        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancelText}>취소</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a", padding: 24 },
  muted: { color: "#737373", textAlign: "center" },
  container: { padding: 16, gap: 14, paddingBottom: 40 },
  lead: { color: "#a3a3a3", fontSize: 12, lineHeight: 18 },
  label: { color: "#a3a3a3", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    color: "#fafafa",
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 8, fontSize: 14,
  },
  textareaTall: { minHeight: 200, textAlignVertical: "top" },
  catRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  catPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: "#262626", backgroundColor: "#171717" },
  catPillActive: { borderColor: "#fbbf24", backgroundColor: "rgba(251, 191, 36, 0.1)" },
  catText: { color: "#a3a3a3", fontSize: 12 },
  catTextActive: { color: "#fbbf24", fontWeight: "600" },
  error: { color: "#fca5a5", fontSize: 12 },
  submitBtn: {
    backgroundColor: "#fbbf24",
    paddingVertical: 13, borderRadius: 8, alignItems: "center", marginTop: 8,
  },
  submitText: { color: "#0a0a0a", fontWeight: "700", fontSize: 15 },
  cancelText: { color: "#737373", textAlign: "center", padding: 12 },
});
