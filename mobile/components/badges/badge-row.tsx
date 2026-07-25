import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { BADGE_META } from "@/lib/badges";

type Badge = { code: string; earned_at: string };

export function BadgeRow({ userId }: { userId: string }) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Badge | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("user_badges")
        .select("code, earned_at")
        .eq("user_id", userId)
        .order("earned_at", { ascending: false });
      setBadges(((data ?? []) as Badge[]).filter((b) => !!BADGE_META[b.code]));
      setLoading(false);
    })();
  }, [userId]);

  if (loading || badges.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Ionicons name="ribbon-outline" size={14} color="#fbbf24" />
        <Text style={styles.title}>뱃지 · {badges.length}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
        {badges.map((b) => {
          const meta = BADGE_META[b.code];
          return (
            <Pressable
              key={b.code}
              onPress={() => setDetail(b)}
              style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.emoji}>{meta.emoji}</Text>
              <Text style={styles.chipLabel} numberOfLines={1}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal transparent animationType="fade" visible={!!detail} onRequestClose={() => setDetail(null)}>
        <Pressable style={styles.backdrop} onPress={() => setDetail(null)}>
          <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
            {detail && (
              <>
                <Text style={styles.dialogEmoji}>{BADGE_META[detail.code].emoji}</Text>
                <Text style={styles.dialogLabel}>{BADGE_META[detail.code].label}</Text>
                <Text style={styles.dialogDesc}>{BADGE_META[detail.code].description}</Text>
                <Text style={styles.dialogTime}>{detail.earned_at.slice(0, 10)} 획득</Text>
                <Pressable onPress={() => setDetail(null)} hitSlop={6}>
                  <Text style={styles.close}>닫기</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 12, gap: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12 },
  title: { color: "#a3a3a3", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "600" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#111",
    borderWidth: 1, borderColor: "#262626",
    marginLeft: 12,
  },
  emoji: { fontSize: 15 },
  chipLabel: { color: "#fafafa", fontSize: 12, fontWeight: "500" },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 24 },
  dialog: {
    backgroundColor: "#111", borderWidth: 1, borderColor: "#262626",
    borderRadius: 16, padding: 24, alignItems: "center", gap: 8, minWidth: 240,
  },
  dialogEmoji: { fontSize: 42 },
  dialogLabel: { color: "#fafafa", fontSize: 18, fontWeight: "700" },
  dialogDesc: { color: "#a3a3a3", fontSize: 13, textAlign: "center" },
  dialogTime: { color: "#737373", fontSize: 11, marginTop: 4 },
  close: { color: "#fbbf24", fontSize: 13, marginTop: 12, paddingVertical: 8, paddingHorizontal: 20 },
});
