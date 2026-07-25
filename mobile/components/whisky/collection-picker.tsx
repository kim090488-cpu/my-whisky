import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth-context";
import type { CollectionStatus } from "@/types/database";

const STATUSES: { v: CollectionStatus; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { v: "wishlist", label: "위시리스트", icon: "bookmark-outline" },
  { v: "owned",    label: "소장",       icon: "cube-outline" },
  { v: "opened",   label: "오픈됨",     icon: "wine-outline" },
  { v: "finished", label: "비움",       icon: "checkmark-done-outline" },
];

export function CollectionPicker({ bottlingId }: { bottlingId: string }) {
  const { session } = useSession();
  const [current, setCurrent] = useState<CollectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<CollectionStatus | "delete" | null>(null);

  const load = useCallback(async () => {
    if (!session) { setCurrent(null); setLoading(false); return; }
    const { data } = await supabase
      .from("collection_items")
      .select("status")
      .eq("user_id", session.user.id)
      .eq("bottling_id", bottlingId)
      .maybeSingle();
    setCurrent(((data as unknown as { status: CollectionStatus } | null)?.status) ?? null);
    setLoading(false);
  }, [session, bottlingId]);

  useEffect(() => { void load(); }, [load]);

  async function setStatus(next: CollectionStatus) {
    if (!session || pending) return;
    // 같은 상태 다시 탭 = 제거
    if (next === current) {
      setPending("delete");
      const { error } = await supabase
        .from("collection_items")
        .delete()
        .eq("user_id", session.user.id)
        .eq("bottling_id", bottlingId);
      setPending(null);
      if (error) return Alert.alert("삭제 실패", error.message);
      setCurrent(null);
      return;
    }
    setPending(next);
    const { error } = await supabase
      .from("collection_items")
      .upsert(
        { user_id: session.user.id, bottling_id: bottlingId, status: next },
        { onConflict: "user_id,bottling_id" },
      );
    setPending(null);
    if (error) return Alert.alert("저장 실패", error.message);
    setCurrent(next);
  }

  if (!session) return null;
  if (loading) return null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="bookmark" size={14} color="#fbbf24" />
        <Text style={styles.title}>내 컬렉션</Text>
        {current && <Text style={styles.currentHint}>· 다시 탭하면 제거</Text>}
      </View>
      <View style={styles.pillRow}>
        {STATUSES.map((s) => {
          const active = s.v === current;
          const busy = pending === s.v;
          return (
            <Pressable
              key={s.v}
              onPress={() => setStatus(s.v)}
              disabled={!!pending}
              style={({ pressed }) => [
                styles.pill,
                active && styles.pillActive,
                pressed && { opacity: 0.7 },
                busy && { opacity: 0.5 },
              ]}
            >
              <Ionicons
                name={s.icon}
                size={14}
                color={active ? "#0a0a0a" : "#a3a3a3"}
              />
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 12, padding: 14,
    marginHorizontal: 16, marginTop: 14,
    gap: 10,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { color: "#a3a3a3", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "600" },
  currentHint: { color: "#525252", fontSize: 10 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1, borderColor: "#404040",
    backgroundColor: "#1f1f1f",
  },
  pillActive: {
    borderColor: "#fbbf24", backgroundColor: "#fbbf24",
  },
  pillText: { color: "#a3a3a3", fontSize: 12, fontWeight: "500" },
  pillTextActive: { color: "#0a0a0a", fontWeight: "700" },
});
