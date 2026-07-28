import { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

const MAX_LOADED_MESSAGES = 50;

type WhiskyMatch = { id: string; name: string; name_kr: string | null };
type Message = { role: "user" | "assistant"; content: string; matches?: WhiskyMatch[] };

const SUGGESTED_PROMPTS = [
  "10만원 이하 입문 스카치 3개 추천",
  "선물용 위스키 추천 (30만원대)",
  "피트 강한 아일라 스타일 추천",
  "가성비 좋은 셰리 캐스크",
  "위스키 초보인데 뭘로 시작할까요?",
];

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://mywhisky-kr.vercel.app";

export default function CuratorScreen() {
  const router = useRouter();
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 12);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const userId = session?.user.id ?? null;

  // 대화 히스토리 로드 (Supabase — 기기 간 동기화)
  useEffect(() => {
    if (!userId) { setLoaded(true); return; }
    (async () => {
      const { data } = await supabase
        .from("curator_messages")
        .select("role, content, matches")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(MAX_LOADED_MESSAGES);
      const rows = (data ?? []) as unknown as Array<{
        role: "user" | "assistant";
        content: string;
        matches: WhiskyMatch[] | null;
      }>;
      const rev = rows.slice().reverse();
      setMessages(rev.map((r) => ({
        role: r.role,
        content: r.content,
        ...(r.matches ? { matches: r.matches } : {}),
      })));
      setLoaded(true);
    })();
  }, [userId]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  function resetChat() {
    if (messages.length === 0 || !userId) return;
    Alert.alert("대화 초기화", "지금까지 나눈 대화를 모두 지울까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "초기화", style: "destructive", onPress: async () => {
          setMessages([]);
          await supabase.from("curator_messages").delete().eq("user_id", userId);
        },
      },
    ]);
  }

  async function send(promptOverride?: string) {
    if (!session) {
      Alert.alert("로그인 필요", "AI 큐레이터는 로그인 후 이용 가능해요.");
      return;
    }
    const q = (promptOverride ?? input).trim();
    if (!q || pending) return;
    const next: Message[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setPending(true);

    try {
      const { data: { session: current } } = await supabase.auth.getSession();
      const token = current?.access_token;
      const res = await fetch(`${API_BASE}/api/curator`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
        },
        body: JSON.stringify({ messages: next }),
      });
      const json = await res.json() as { reply?: string; error?: string; matches?: WhiskyMatch[] };
      if (!res.ok || json.error) {
        Alert.alert("요청 실패", json.error ?? `HTTP ${res.status}`);
        setMessages(next);
        return;
      }
      const assistantMsg: Message = {
        role: "assistant",
        content: json.reply ?? "",
        matches: json.matches ?? [],
      };
      setMessages([...next, assistantMsg]);

      // 성공 시 유저·assistant 메시지 DB 저장 (기기 간 동기화)
      if (userId) {
        await supabase.from("curator_messages").insert([
          { user_id: userId, role: "user", content: q, matches: null },
          {
            user_id: userId,
            role: "assistant",
            content: assistantMsg.content,
            matches: assistantMsg.matches && assistantMsg.matches.length > 0
              ? (assistantMsg.matches as unknown as never)
              : null,
          },
        ] as never);
      }
    } catch (e) {
      Alert.alert("네트워크 오류", e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "AI 큐레이터" }} />
        <Ionicons name="wine-outline" size={40} color="#525252" />
        <Text style={styles.muted}>로그인 후 이용 가능합니다.</Text>
        <Pressable onPress={() => router.push("/(tabs)/me" as never)}>
          <Text style={styles.link}>로그인하러 가기 →</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#0a0a0a" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen
        options={{
          title: "AI 큐레이터",
          headerRight: () => messages.length > 0 ? (
            <Pressable onPress={resetChat} hitSlop={8} style={{ paddingRight: 12 }}>
              <Ionicons name="refresh-outline" size={20} color="#fbbf24" />
            </Pressable>
          ) : null,
        }}
      />
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.chatContainer}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={styles.intro}>
            <Text style={styles.introEmoji}>🥃</Text>
            <Text style={styles.introTitle}>위스키 큐레이터에게 물어보세요</Text>
            <Text style={styles.introSub}>예산·취향·용도를 알려주면 맞춤 추천을 도와드려요.</Text>
            <View style={styles.promptGrid}>
              {SUGGESTED_PROMPTS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => send(p)}
                  style={({ pressed }) => [styles.promptPill, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.promptText}>{p}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          messages.map((m, i) => (
            <View key={i} style={[styles.bubbleWrap, m.role === "user" ? styles.userWrap : styles.botWrap]}>
              <View style={{ flex: 1, alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                <View style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.botBubble]}>
                  <Text style={[styles.bubbleText, m.role === "user" ? styles.userText : styles.botText]}>
                    {m.content}
                  </Text>
                </View>
                {m.role === "assistant" && m.matches && m.matches.length > 0 && (
                  <View style={styles.matchesWrap}>
                    <Text style={styles.matchesTitle}>언급된 위스키 · 탭하면 상세로</Text>
                    <View style={styles.matchesRow}>
                      {m.matches.map((w) => (
                        <Pressable
                          key={w.id}
                          onPress={() => {
                            // curator에서 상세로 갈 때 tab의 stack이 [index, [id]]로 build되도록 두 단계
                            router.dismissAll?.();
                            router.push("/(tabs)/whiskies" as never);
                            setTimeout(() => router.push(`/(tabs)/whiskies/${w.id}` as never), 50);
                          }}
                          style={({ pressed }) => [styles.matchChip, pressed && { opacity: 0.7 }]}
                        >
                          <Ionicons name="wine-outline" size={12} color="#fbbf24" />
                          <Text style={styles.matchText} numberOfLines={1}>
                            {w.name_kr ?? w.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
        {pending && (
          <View style={[styles.bubbleWrap, styles.botWrap]}>
            <View style={[styles.bubble, styles.botBubble]}>
              <ActivityIndicator color="#fbbf24" size="small" />
            </View>
          </View>
        )}
      </ScrollView>
      <View style={[styles.inputRow, { paddingBottom: bottomPadding }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          placeholder="예: 아일라 스타일 추천"
          placeholderTextColor="#525252"
          style={styles.input}
        />
        <Pressable
          onPress={() => send()}
          disabled={pending || !input.trim()}
          style={({ pressed }) => [
            styles.sendBtn,
            (pending || !input.trim()) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="arrow-up" size={20} color="#0a0a0a" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a", padding: 24, gap: 10 },
  muted: { color: "#a3a3a3", fontSize: 14 },
  link: { color: "#fbbf24", fontSize: 13, fontWeight: "600" },

  chatContainer: { padding: 16, gap: 10, paddingBottom: 24 },
  intro: { alignItems: "center", paddingVertical: 40, gap: 8 },
  introEmoji: { fontSize: 48 },
  introTitle: { color: "#fafafa", fontSize: 18, fontWeight: "700" },
  introSub: { color: "#a3a3a3", fontSize: 13, textAlign: "center", marginBottom: 12 },
  promptGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 20 },
  promptPill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(251, 191, 36, 0.35)",
    backgroundColor: "rgba(251, 191, 36, 0.06)",
  },
  promptText: { color: "#fbbf24", fontSize: 12 },

  bubbleWrap: { flexDirection: "row" },
  userWrap: { justifyContent: "flex-end" },
  botWrap: { justifyContent: "flex-start" },
  bubble: { maxWidth: "80%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  userBubble: { backgroundColor: "#fbbf24", borderTopRightRadius: 4 },
  botBubble: { backgroundColor: "#171717", borderTopLeftRadius: 4, borderWidth: 1, borderColor: "#262626" },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userText: { color: "#0a0a0a", fontWeight: "500" },
  botText: { color: "#e5e5e5" },
  matchesWrap: { marginTop: 6, maxWidth: "85%", gap: 4 },
  matchesTitle: { color: "#737373", fontSize: 10 },
  matchesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  matchChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(251, 191, 36, 0.08)",
    borderWidth: 1, borderColor: "rgba(251, 191, 36, 0.4)",
  },
  matchText: { color: "#fbbf24", fontSize: 12, fontWeight: "500", maxWidth: 180 },

  inputRow: {
    flexDirection: "row", gap: 8, alignItems: "flex-end",
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: "#171717",
    backgroundColor: "#0a0a0a",
  },
  input: {
    flex: 1,
    backgroundColor: "#171717", borderWidth: 1, borderColor: "#262626",
    color: "#fafafa", paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 20, fontSize: 14, maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#fbbf24",
    alignItems: "center", justifyContent: "center",
  },
});
