import { useCallback, useEffect, useState } from "react";
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth-context";

const FIELD_LABEL: Record<string, string> = {
  distillery_id: "증류소",
  name: "영문 이름",
  name_kr: "한글 이름",
  age_years: "숙성",
  abv: "ABV",
  vintage_year: "빈티지",
  bottling_year: "병입 연도",
  cask_type: "캐스크",
  bottler: "병입자",
  bottler_name: "병입자 이름",
  bottle_size_ml: "병 용량",
  total_bottles: "총 병수",
  notes: "노트",
};
const TRACKED = Object.keys(FIELD_LABEL);
const STRONG_SIGNAL = 3;
const REPORT_THRESHOLD = 3;

type Editor = { username: string; display_name: string | null; avatar_url: string | null };
type EditRow = {
  id: string;
  edited_at: string;
  editor: Editor | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  like_count: number;
  liked: boolean;
  report_count: number;
  reported: boolean;
};
type Sort = "recent" | "liked";

function formatVal(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "string") return v.length > 80 ? v.slice(0, 80) + "…" : v;
  return String(v);
}

export default function BottlingHistory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();

  const [rows, setRows] = useState<EditRow[]>([]);
  const [bottlingName, setBottlingName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<Sort>("recent");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    // 보틀링 현재 값 (마지막 편집의 after)
    const { data: bRaw } = await supabase
      .from("bottlings")
      .select("id, name, name_kr, distillery_id, age_years, abv, vintage_year, bottling_year, cask_type, bottler, bottler_name, bottle_size_ml, total_bottles, notes")
      .eq("id", id)
      .maybeSingle();
    const bottling = bRaw as unknown as (Record<string, unknown> & { name?: string; name_kr?: string | null }) | null;
    if (bottling) setBottlingName((bottling.name_kr as string) ?? (bottling.name as string) ?? "");

    const { data: eRaw } = await supabase
      .from("bottling_edits")
      .select("id, edited_by, edited_at, before, like_count, report_count")
      .eq("bottling_id", id)
      .order("edited_at", { ascending: false })
      .limit(100);
    const items = (eRaw ?? []) as Array<{
      id: string; edited_by: string | null; edited_at: string;
      before: Record<string, unknown>; like_count: number; report_count: number;
    }>;

    const editorIds = Array.from(new Set(items.map((e) => e.edited_by).filter((v): v is string => !!v)));
    const editorsById = new Map<string, Editor>();
    if (editorIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", editorIds);
      for (const p of (profs ?? []) as Array<Editor & { id: string }>) editorsById.set(p.id, p);
    }

    const myLiked = new Set<string>();
    const myReported = new Set<string>();
    if (session && items.length > 0) {
      const editIds = items.map((e) => e.id);
      const [likesRes, reportsRes] = await Promise.all([
        supabase.from("bottling_edit_likes").select("edit_id").eq("user_id", session.user.id).in("edit_id", editIds),
        supabase.from("bottling_edit_reports").select("edit_id").eq("user_id", session.user.id).in("edit_id", editIds),
      ]);
      for (const l of (likesRes.data ?? []) as Array<{ edit_id: string }>) myLiked.add(l.edit_id);
      for (const r of (reportsRes.data ?? []) as Array<{ edit_id: string }>) myReported.add(r.edit_id);
    }

    // items[i]의 after = i===0 ? bottling 현재 : items[i-1].before
    const mapped: EditRow[] = items.map((e, i) => ({
      id: e.id,
      edited_at: e.edited_at,
      editor: e.edited_by ? editorsById.get(e.edited_by) ?? null : null,
      before: e.before,
      after: i === 0 ? (bottling as Record<string, unknown>) : items[i - 1].before,
      like_count: e.like_count ?? 0,
      liked: myLiked.has(e.id),
      report_count: e.report_count ?? 0,
      reported: myReported.has(e.id),
    }));
    setRows(mapped);
    setLoading(false);
  }, [id, session]);

  useEffect(() => { void load(); }, [load]);

  async function toggleLike(row: EditRow) {
    if (!session) { router.push("/(tabs)/me" as never); return; }
    const prev = { liked: row.liked, count: row.like_count };
    setRows((rs) => rs.map((r) => r.id === row.id
      ? { ...r, liked: !prev.liked, like_count: prev.liked ? Math.max(0, prev.count - 1) : prev.count + 1 }
      : r));
    if (prev.liked) {
      const { error } = await supabase
        .from("bottling_edit_likes")
        .delete()
        .eq("edit_id", row.id)
        .eq("user_id", session.user.id);
      if (error) setRows((rs) => rs.map((r) => r.id === row.id ? { ...r, liked: prev.liked, like_count: prev.count } : r));
    } else {
      const { error } = await supabase
        .from("bottling_edit_likes")
        .insert({ edit_id: row.id, user_id: session.user.id });
      if (error) setRows((rs) => rs.map((r) => r.id === row.id ? { ...r, liked: prev.liked, like_count: prev.count } : r));
    }
  }

  async function toggleReport(row: EditRow) {
    if (!session) { router.push("/(tabs)/me" as never); return; }
    const prev = { reported: row.reported, count: row.report_count };
    setRows((rs) => rs.map((r) => r.id === row.id
      ? { ...r, reported: !prev.reported, report_count: prev.reported ? Math.max(0, prev.count - 1) : prev.count + 1 }
      : r));
    if (prev.reported) {
      const { error } = await supabase
        .from("bottling_edit_reports")
        .delete()
        .eq("edit_id", row.id)
        .eq("user_id", session.user.id);
      if (error) setRows((rs) => rs.map((r) => r.id === row.id ? { ...r, reported: prev.reported, report_count: prev.count } : r));
    } else {
      const { error } = await supabase
        .from("bottling_edit_reports")
        .insert({ edit_id: row.id, user_id: session.user.id });
      if (error) setRows((rs) => rs.map((r) => r.id === row.id ? { ...r, reported: prev.reported, report_count: prev.count } : r));
    }
  }

  async function revertToBefore(row: EditRow) {
    if (!session || !id) return;
    Alert.alert(
      "이 편집 전으로 되돌리기",
      "이 편집 이전 상태로 위스키 정보를 복원합니다. 새 편집 이력이 남아요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "되돌리기",
          style: "destructive",
          onPress: async () => {
            const before = row.before;
            const payload: Record<string, unknown> = {};
            for (const f of TRACKED) payload[f] = before[f] ?? null;
            const { error } = await supabase
              .from("bottlings")
              .update(payload as never)
              .eq("id", id);
            if (error) return Alert.alert("복원 실패", error.message);
            await load();
          },
        },
      ],
    );
  }

  const sorted = sort === "liked"
    ? [...rows].sort((a, b) => (b.like_count - a.like_count) || (a.edited_at < b.edited_at ? 1 : -1))
    : rows;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "수정 이력" }} />
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>{bottlingName || "위스키"}</Text>
        <Text style={styles.headerSub}>총 {rows.length}건 · 정확한 정정에 추천을 눌러주세요</Text>
      </View>
      <View style={styles.sortRow}>
        {(["recent", "liked"] as Sort[]).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSort(s)}
            style={({ pressed }) => [styles.sortPill, sort === s && styles.sortPillActive, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.sortText, sort === s && styles.sortTextActive]}>
              {s === "recent" ? "최근" : "추천순"}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#fbbf24" /></View>
      ) : sorted.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="document-text-outline" size={40} color="#525252" />
          <Text style={styles.empty}>아직 수정 이력이 없어요.</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor="#fbbf24" />
          }
          renderItem={({ item: r }) => {
            const changes = TRACKED.filter((f) => JSON.stringify(r.before[f] ?? null) !== JSON.stringify(r.after[f] ?? null));
            const isOpen = expanded.has(r.id);
            const strong = r.like_count >= STRONG_SIGNAL;
            const flagged = r.report_count >= REPORT_THRESHOLD;
            const name = r.editor?.display_name ?? r.editor?.username ?? "익명";
            const time = r.edited_at.replace("T", " ").slice(0, 16);
            return (
              <View style={[styles.card, flagged ? styles.cardFlagged : strong && styles.cardStrong]}>
                {flagged && (
                  <View style={styles.warningBar}>
                    <Ionicons name="warning-outline" size={14} color="#f43f5e" />
                    <Text style={styles.warningText}>
                      신고 {r.report_count}건 — 잘못된 수정일 수 있어요
                    </Text>
                  </View>
                )}
                <View style={styles.cardHead}>
                  <Pressable
                    onPress={() => r.editor?.username && router.push(`/profile/${r.editor.username}` as never)}
                    style={styles.avatar}
                    hitSlop={4}
                  >
                    <Text style={styles.avatarText}>{name.trim().charAt(0).toUpperCase()}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
                        return next;
                      });
                    }}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <View style={styles.headRow}>
                      <Text style={styles.editorName} numberOfLines={1}>{name}</Text>
                      <Text style={styles.time}>{time}</Text>
                    </View>
                    <View style={styles.chipRow}>
                      {changes.length === 0 ? (
                        <Text style={styles.chipMuted}>변경 없음</Text>
                      ) : (
                        <>
                          {changes.slice(0, 4).map((f) => (
                            <View key={f} style={styles.chip}>
                              <Text style={styles.chipText}>{FIELD_LABEL[f] ?? f}</Text>
                            </View>
                          ))}
                          {changes.length > 4 && (
                            <Text style={styles.chipMuted}>+{changes.length - 4}</Text>
                          )}
                        </>
                      )}
                    </View>
                  </Pressable>
                  <View style={styles.actionCol}>
                    <Pressable
                      onPress={() => toggleLike(r)}
                      hitSlop={4}
                      style={({ pressed }) => [
                        styles.actionBtn,
                        r.liked && styles.likeBtnActive,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Ionicons
                        name={r.liked ? "thumbs-up" : "thumbs-up-outline"}
                        size={12}
                        color={r.liked ? "#fbbf24" : "#a3a3a3"}
                      />
                      <Text style={[styles.actionText, r.liked && styles.likeTextActive]}>
                        {r.like_count}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => toggleReport(r)}
                      hitSlop={4}
                      style={({ pressed }) => [
                        styles.actionBtn,
                        r.reported && styles.reportBtnActive,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Ionicons
                        name={r.reported ? "thumbs-down" : "thumbs-down-outline"}
                        size={12}
                        color={r.reported ? "#f43f5e" : "#a3a3a3"}
                      />
                      <Text style={[styles.actionText, r.reported && styles.reportTextActive]}>
                        {r.report_count}
                      </Text>
                    </Pressable>
                  </View>
                </View>
                {flagged && session && (
                  <Pressable
                    onPress={() => revertToBefore(r)}
                    style={({ pressed }) => [styles.revertBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="arrow-undo-outline" size={14} color="#f43f5e" />
                    <Text style={styles.revertBtnText}>이 편집 전으로 되돌리기</Text>
                  </Pressable>
                )}

                {isOpen && changes.length > 0 && (
                  <View style={styles.diffBlock}>
                    {changes.map((f) => (
                      <View key={f} style={styles.diffRow}>
                        <Text style={styles.diffLabel}>{FIELD_LABEL[f] ?? f}</Text>
                        <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4, alignItems: "baseline" }}>
                          <Text style={styles.diffBefore}>{formatVal(r.before[f])}</Text>
                          <Text style={styles.diffArrow}>→</Text>
                          <Text style={styles.diffAfter}>{formatVal(r.after[f])}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  empty: { color: "#737373", fontSize: 13 },

  header: { padding: 16, paddingBottom: 8 },
  headerTitle: { color: "#fafafa", fontSize: 20, fontWeight: "700" },
  headerSub: { color: "#737373", fontSize: 11, marginTop: 2 },

  sortRow: { flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  sortPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: "#262626", backgroundColor: "#171717" },
  sortPillActive: { borderColor: "#fbbf24", backgroundColor: "rgba(251, 191, 36, 0.1)" },
  sortText: { color: "#a3a3a3", fontSize: 11 },
  sortTextActive: { color: "#fbbf24", fontWeight: "600" },

  card: {
    backgroundColor: "#111",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 10, overflow: "hidden",
  },
  cardStrong: {
    borderColor: "rgba(251, 191, 36, 0.4)",
    backgroundColor: "rgba(251, 191, 36, 0.04)",
  },
  cardFlagged: {
    borderColor: "rgba(244, 63, 94, 0.4)",
    backgroundColor: "rgba(244, 63, 94, 0.04)",
  },
  warningBar: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: "rgba(244, 63, 94, 0.25)",
  },
  warningText: { color: "#f43f5e", fontSize: 11, fontWeight: "600", flex: 1 },
  actionCol: { flexDirection: "row", gap: 4 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 6, borderWidth: 1, borderColor: "#404040",
  },
  actionText: { color: "#a3a3a3", fontSize: 11, fontWeight: "600" },
  reportBtnActive: { borderColor: "#f43f5e", backgroundColor: "rgba(244, 63, 94, 0.1)" },
  reportTextActive: { color: "#f43f5e" },
  revertBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, paddingHorizontal: 12,
    borderTopWidth: 1, borderTopColor: "rgba(244, 63, 94, 0.25)",
  },
  revertBtnText: { color: "#f43f5e", fontSize: 12, fontWeight: "600" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#1f1f1f",
    borderWidth: 1, borderColor: "#404040",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fbbf24", fontSize: 12, fontWeight: "700" },
  headRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  editorName: { color: "#fafafa", fontSize: 13, fontWeight: "500", flex: 1 },
  time: { color: "#737373", fontSize: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  chip: { backgroundColor: "#1f1f1f", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  chipText: { color: "#a3a3a3", fontSize: 10 },
  chipMuted: { color: "#525252", fontSize: 10 },
  likeBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 6, borderWidth: 1, borderColor: "#404040",
  },
  likeBtnActive: { borderColor: "#fbbf24", backgroundColor: "rgba(251, 191, 36, 0.1)" },
  likeText: { color: "#a3a3a3", fontSize: 11, fontWeight: "600" },
  likeTextActive: { color: "#fbbf24" },

  diffBlock: {
    borderTopWidth: 1, borderTopColor: "#262626",
    padding: 12, gap: 8, backgroundColor: "#0d0d0d",
  },
  diffRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  diffLabel: { color: "#737373", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, width: 70 },
  diffBefore: { color: "#525252", fontSize: 12, textDecorationLine: "line-through" },
  diffArrow: { color: "#525252", fontSize: 11 },
  diffAfter: { color: "#e5e5e5", fontSize: 12 },
});
