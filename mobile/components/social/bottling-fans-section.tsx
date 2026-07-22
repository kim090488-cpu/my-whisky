import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import type { BottlingFan } from "@/lib/social/bottling-fans";
import type { TasteTagTone } from "@/lib/tastings/taste-profile";

const TONE_STYLES: Record<TasteTagTone, { border: string; bg: string; text: string }> = {
  amber:   { border: "rgba(251,191,36,0.4)",  bg: "rgba(251,191,36,0.1)",  text: "#fcd34d" },
  emerald: { border: "rgba(52,211,153,0.4)",  bg: "rgba(52,211,153,0.1)",  text: "#6ee7b7" },
  rose:    { border: "rgba(251,113,133,0.4)", bg: "rgba(251,113,133,0.1)", text: "#fda4af" },
  sky:     { border: "rgba(56,189,248,0.4)",  bg: "rgba(56,189,248,0.1)",  text: "#7dd3fc" },
};

const MAX_TAGS_PER_CARD = 4;

export function BottlingFansSection({ fans }: { fans: BottlingFan[] }) {
  const router = useRouter();
  if (fans.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.title}>이 위스키를 좋아한 사람들</Text>
      <Text style={styles.sub}>85점 이상 준 유저의 취향을 함께 살펴보세요</Text>
      <View style={styles.grid}>
        {fans.map((f) => {
          const name = f.displayName || f.username;
          const initial = name.trim().charAt(0).toUpperCase();
          const visibleTags = f.tags.slice(0, MAX_TAGS_PER_CARD);
          const extra = f.tags.length - visibleTags.length;
          return (
            <Pressable
              key={f.userId}
              onPress={() => router.push(`/tastings/${f.tastingId}`)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.headRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={styles.headText}>
                  <Text style={styles.name} numberOfLines={1}>{name}</Text>
                  <Text style={styles.handle} numberOfLines={1}>@{f.username}</Text>
                </View>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreText}>{f.tastingScore}</Text>
                </View>
              </View>
              {visibleTags.length > 0 && (
                <View style={styles.tagRow}>
                  {visibleTags.map((tag) => {
                    const tone = TONE_STYLES[tag.tone];
                    return (
                      <View
                        key={tag.key}
                        style={[
                          styles.tagPill,
                          { borderColor: tone.border, backgroundColor: tone.bg },
                        ]}
                      >
                        <Text style={[styles.tagText, { color: tone.text }]}>{tag.label}</Text>
                      </View>
                    );
                  })}
                  {extra > 0 && (
                    <View style={[styles.tagPill, styles.tagPillNeutral]}>
                      <Text style={styles.tagTextNeutral}>+{extra}</Text>
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 20,
    marginHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#171717",
  },
  title: { color: "#fafafa", fontSize: 16, fontWeight: "600" },
  sub: { color: "#737373", fontSize: 11, marginTop: 3 },
  grid: {
    marginTop: 12,
    gap: 8,
  },
  card: {
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  headRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(180,83,9,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fde68a", fontSize: 14, fontWeight: "600" },
  headText: { flex: 1, minWidth: 0 },
  name: { color: "#fafafa", fontSize: 13, fontWeight: "600" },
  handle: { color: "#737373", fontSize: 10, marginTop: 1 },
  scoreBadge: {
    backgroundColor: "rgba(251,191,36,0.1)",
    borderRadius: 5,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  scoreText: { color: "#fcd34d", fontSize: 12, fontWeight: "700" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  tagPill: {
    borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  tagText: { fontSize: 10, fontWeight: "500" },
  tagPillNeutral: {
    borderColor: "#404040",
    backgroundColor: "transparent",
  },
  tagTextNeutral: { color: "#a3a3a3", fontSize: 10 },
});
