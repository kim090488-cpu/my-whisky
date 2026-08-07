import { useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth-context";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://mywhisky-kr.vercel.app";
const CONFIRM_WORD = "삭제";

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { session } = useSession();
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = confirm.trim() === CONFIRM_WORD && !!session;

  async function submit() {
    if (!canSubmit || !session) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`${API_BASE}/api/account/delete`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "삭제에 실패했어요.");
      }
      // 서버가 auth user를 지웠으므로 클라이언트 세션도 클리어
      await supabase.auth.signOut();
      Alert.alert("계정이 삭제됐어요.", "이용해주셔서 감사합니다.", [
        { text: "확인", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setPending(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>계정 삭제</Text>
      <Text style={styles.sub}>
        아래 내용을 확인한 뒤 삭제하세요. 삭제는 즉시 반영되며 되돌릴 수 없습니다.
      </Text>

      <View style={styles.dangerCard}>
        <Text style={styles.cardHead}>즉시 삭제되는 데이터</Text>
        <Bullet>프로필 정보 (사용자명·표시명·자기소개·아바타)</Bullet>
        <Bullet>모든 테이스팅 노트·평점·첨부 사진</Bullet>
        <Bullet>컬렉션 항목(소유·오픈·소진·위시리스트)</Bullet>
        <Bullet>커뮤니티 게시글·댓글·좋아요·팔로우 관계</Bullet>
        <Bullet>AI 큐레이터 대화 기록</Bullet>
        <Bullet>푸시 알림 구독 및 알림 내역</Bullet>
        <Bullet>신고·차단 이력</Bullet>
      </View>

      <View style={styles.neutralCard}>
        <Text style={styles.cardHeadNeutral}>보존되는 데이터</Text>
        <Bullet color="#a3a3a3">
          위스키 카탈로그(bottling)에 기여한 편집 이력 — 카탈로그 무결성을 위해
          작성자를 익명 처리하여 유지
        </Bullet>
        <Bullet color="#a3a3a3">
          법령상 보관 의무가 있는 서버 접근 로그 — 위탁 사업자 정책에 따라 보관 후 파기
        </Bullet>
      </View>

      <Text style={styles.label}>
        계속하려면 아래 입력란에 <Text style={styles.labelStrong}>삭제</Text> 두 글자를
        입력하세요.
      </Text>
      <TextInput
        value={confirm}
        onChangeText={setConfirm}
        placeholder="삭제"
        placeholderTextColor="#525252"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Pressable
        onPress={submit}
        disabled={!canSubmit || pending}
        style={({ pressed }) => [
          styles.dangerBtn,
          (!canSubmit || pending) && styles.dangerBtnDisabled,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.dangerBtnText}>
          {pending ? "삭제 중…" : "계정 영구 삭제"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Bullet({ children, color = "#e5e5e5" }: { children: React.ReactNode; color?: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.bulletDot, { color }]}>·</Text>
      <Text style={[styles.bulletText, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#0a0a0a" },
  container: { padding: 20, paddingBottom: 60, gap: 14 },
  title: { fontSize: 24, fontWeight: "700", color: "#fafafa" },
  sub: { fontSize: 13, color: "#a3a3a3", lineHeight: 20 },
  dangerCard: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.35)",
    backgroundColor: "rgba(244,63,94,0.06)",
    gap: 6,
  },
  neutralCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#262626",
    backgroundColor: "#111",
    gap: 6,
  },
  cardHead: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fda4af",
    marginBottom: 4,
  },
  cardHeadNeutral: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fafafa",
    marginBottom: 4,
  },
  bulletRow: { flexDirection: "row", gap: 6 },
  bulletDot: { fontSize: 13, lineHeight: 20 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 20 },
  label: { marginTop: 8, fontSize: 12, color: "#a3a3a3", lineHeight: 18 },
  labelStrong: { color: "#fda4af", fontWeight: "700" },
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
  errorText: {
    color: "#fca5a5",
    fontSize: 12,
    padding: 8,
    backgroundColor: "rgba(244,63,94,0.08)",
    borderRadius: 6,
  },
  dangerBtn: {
    marginTop: 4,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.6)",
    backgroundColor: "rgba(244,63,94,0.12)",
  },
  dangerBtnDisabled: { opacity: 0.4 },
  dangerBtnText: { color: "#fecdd3", fontSize: 14, fontWeight: "700" },
});
