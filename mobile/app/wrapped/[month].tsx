import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  loadWrappedMonth,
  parseMonth,
  adjacentMonths,
  currentKstMonth,
  type WrappedMonth,
  type WrappedTopNote,
} from "@/lib/tastings/wrapped";

export default function WrappedScreen() {
  const { month: monthRaw } = useLocalSearchParams<{ month: string }>();
  const router = useRouter();
  const { session } = useSession();
  const [wrapped, setWrapped] = useState<WrappedMonth | null>(null);
  const [loading, setLoading] = useState(true);

  const parsed = monthRaw ? parseMonth(monthRaw) : null;

  useEffect(() => {
    if (!session || !parsed) return;
    (async () => {
      setLoading(true);
      const data = await loadWrappedMonth(supabase, session.user.id, parsed.month);
      setWrapped(data);
      setLoading(false);
    })();
  }, [session, parsed?.month]);

  if (!session) return <Redirect href="/(tabs)/me" />;
  if (!parsed) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "회고" }} />
        <Text style={styles.muted}>잘못된 월 형식이에요.</Text>
      </View>
    );
  }
  if (loading || !wrapped) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: `${parsed.month} 회고` }} />
        <ActivityIndicator color="#fbbf24" />
      </View>
    );
  }

  const adj = adjacentMonths(parsed.month);
  const currentMonth = currentKstMonth();
  const isFuture = parsed.month > currentMonth;
  const canGoNext = adj.next <= currentMonth;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ title: `${wrapped.monthLabel} 회고` }} />

      <MonthNav
        month={parsed.month}
        adj={adj}
        canGoNext={canGoNext}
        onGo={(m) => router.replace(`/wrapped/${m}` as never)}
      />

      <View style={styles.header}>
        <Text style={styles.tag}>월별 회고</Text>
        <Text style={styles.title}>{wrapped.monthLabel} 회고</Text>
        <Text style={styles.sub}>{parsed.month}</Text>
      </View>

      {isFuture ? (
        <EmptyState message="아직 오지 않은 달이에요." />
      ) : !wrapped.hasData ? (
        <EmptyState
          message={
            parsed.month === currentMonth
              ? "이번 달 아직 노트를 쌓지 않았어요."
              : "이 달에는 노트가 없어요."
          }
        />
      ) : (
        <>
          <View style={styles.statsGrid}>
            <StatBox label="노트" value={String(wrapped.count)} suffix="잔" />
            <StatBox
              label="평균 점수"
              value={wrapped.avgScore !== null ? wrapped.avgScore.toFixed(1) : "—"}
              accent
            />
            <StatBox
              label="재구매"
              value={wrapped.buybackPct !== null ? String(wrapped.buybackPct) : "—"}
              suffix={wrapped.buybackPct !== null ? "%" : undefined}
            />
            <StatBox
              label="새로 만남"
              value={String(wrapped.newBottlingCount)}
              suffix={wrapped.newBottlingCount > 0 ? "종" : undefined}
            />
          </View>

          {wrapped.topPick && (
            <HighlightCard
              tag="이 달의 픽"
              accent="amber"
              note={wrapped.topPick}
              subtitle={`${wrapped.topPick.score}점`}
              onPress={() => router.push(`/tastings/${wrapped.topPick!.tastingId}`)}
            />
          )}

          {wrapped.mostLiked && wrapped.mostLiked.likeCount > 0 && (
            <HighlightCard
              tag="가장 많은 공감"
              accent="rose"
              note={wrapped.mostLiked}
              subtitle={`♥ ${wrapped.mostLiked.likeCount}`}
              onPress={() => router.push(`/tastings/${wrapped.mostLiked!.tastingId}`)}
            />
          )}

          {wrapped.flavorTop.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>이 달 향미</Text>
              <View style={styles.flavorRow}>
                {wrapped.flavorTop.map((f) => (
                  <View key={f.key} style={styles.flavorPill}>
                    <Text style={styles.flavorLabel}>{f.label}</Text>
                    <Text style={styles.flavorAvg}>{f.avg}/10</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {(wrapped.topCasks.length > 0 || wrapped.topCountries.length > 0) && (
            <View style={styles.distGrid}>
              {wrapped.topCasks.length > 0 && (
                <DistBox title="자주 만난 캐스크" items={wrapped.topCasks} />
              )}
              {wrapped.topCountries.length > 0 && (
                <DistBox title="자주 만난 국가" items={wrapped.topCountries} />
              )}
            </View>
          )}

          {(wrapped.totalLikes > 0 || wrapped.totalComments > 0) && (
            <View style={styles.socialCard}>
              <View style={styles.socialItem}>
                <Ionicons name="heart" size={16} color="#fda4af" />
                <Text style={styles.socialText}>
                  받은 좋아요 <Text style={styles.socialNum}>{wrapped.totalLikes}</Text>
                </Text>
              </View>
              <View style={styles.socialItem}>
                <Ionicons name="chatbubble" size={14} color="#7dd3fc" />
                <Text style={styles.socialText}>
                  받은 댓글 <Text style={styles.socialNum}>{wrapped.totalComments}</Text>
                </Text>
              </View>
            </View>
          )}
        </>
      )}

      <MonthNav
        month={parsed.month}
        adj={adj}
        canGoNext={canGoNext}
        onGo={(m) => router.replace(`/wrapped/${m}` as never)}
        style={{ marginTop: 30 }}
      />
    </ScrollView>
  );
}

function MonthNav({
  month,
  adj,
  canGoNext,
  onGo,
  style,
}: {
  month: string;
  adj: { prev: string; next: string };
  canGoNext: boolean;
  onGo: (m: string) => void;
  style?: object;
}) {
  return (
    <View style={[styles.nav, style]}>
      <Pressable onPress={() => onGo(adj.prev)} style={styles.navBtn}>
        <Ionicons name="chevron-back" size={12} color="#a3a3a3" />
        <Text style={styles.navText}>{adj.prev}</Text>
      </Pressable>
      <Text style={styles.navCurrent}>{month}</Text>
      <Pressable
        onPress={() => canGoNext && onGo(adj.next)}
        disabled={!canGoNext}
        style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]}
      >
        <Text style={[styles.navText, !canGoNext && styles.navTextDisabled]}>{adj.next}</Text>
        <Ionicons name="chevron-forward" size={12} color={canGoNext ? "#a3a3a3" : "#404040"} />
      </Pressable>
    </View>
  );
}

function StatBox({
  label, value, suffix, accent,
}: { label: string; value: string; suffix?: string; accent?: boolean }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
        {suffix && <Text style={styles.statSuffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

function HighlightCard({
  tag, accent, note, subtitle, onPress,
}: {
  tag: string;
  accent: "amber" | "rose";
  note: WrappedTopNote;
  subtitle: string;
  onPress: () => void;
}) {
  const dist = note.distilleryNameKr || note.distilleryName;
  const bottling = note.bottlingNameKr || note.bottlingName;
  const border = accent === "amber" ? "rgba(251,191,36,0.4)" : "rgba(251,113,133,0.4)";
  const bg = accent === "amber" ? "rgba(251,191,36,0.05)" : "rgba(251,113,133,0.05)";
  const tagColor = accent === "amber" ? "#fcd34d" : "#fda4af";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.highlight,
        { borderColor: border, backgroundColor: bg },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.highlightTag}>
        <Ionicons name="sparkles" size={12} color={tagColor} />
        <Text style={[styles.highlightTagText, { color: tagColor }]}>{tag}</Text>
      </View>
      <Text style={styles.highlightDist} numberOfLines={1}>{dist}</Text>
      <Text style={styles.highlightBottling}>{bottling}</Text>
      <Text style={styles.highlightSub}>{subtitle}</Text>
    </Pressable>
  );
}

function DistBox({ title, items }: { title: string; items: { key: string; label: string; count: number }[] }) {
  return (
    <View style={styles.distBox}>
      <Text style={styles.distTitle}>{title}</Text>
      {items.map((item) => (
        <View key={item.key} style={styles.distRow}>
          <Text style={styles.distLabel}>{item.label}</Text>
          <Text style={styles.distCount}>{item.count}</Text>
        </View>
      ))}
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  const router = useRouter();
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyMsg}>{message}</Text>
      <Pressable onPress={() => router.push("/tastings")}>
        <Text style={styles.emptyLink}>노트 둘러보기 →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a" },
  muted: { color: "#737373", fontSize: 14 },

  nav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 12, gap: 8,
  },
  navBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: "#262626",
    backgroundColor: "#171717",
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6,
  },
  navBtnDisabled: { borderColor: "#171717", backgroundColor: "transparent" },
  navText: { color: "#a3a3a3", fontSize: 11 },
  navTextDisabled: { color: "#404040" },
  navCurrent: { color: "#737373", fontSize: 11 },

  header: { paddingHorizontal: 16, paddingTop: 20 },
  tag: {
    color: "#737373", fontSize: 10, letterSpacing: 1, textTransform: "uppercase",
  },
  title: { color: "#fafafa", fontSize: 30, fontWeight: "700", marginTop: 6, letterSpacing: -0.5 },
  sub: { color: "#525252", fontSize: 11, marginTop: 4 },

  statsGrid: {
    flexDirection: "row", flexWrap: "wrap",
    gap: 8, paddingHorizontal: 16, marginTop: 20,
  },
  statBox: {
    width: "47%",
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 10, padding: 12,
  },
  statLabel: {
    color: "#737373", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5,
  },
  statValueRow: { flexDirection: "row", alignItems: "baseline", gap: 3, marginTop: 6 },
  statValue: { color: "#fafafa", fontSize: 22, fontWeight: "700" },
  statValueAccent: { color: "#fbbf24" },
  statSuffix: { color: "#a3a3a3", fontSize: 13 },

  highlight: {
    marginHorizontal: 16, marginTop: 16,
    borderWidth: 1, borderRadius: 12, padding: 16,
  },
  highlightTag: {
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  highlightTagText: {
    fontSize: 10, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase",
  },
  highlightDist: { color: "#a3a3a3", fontSize: 12, marginTop: 8 },
  highlightBottling: { color: "#fafafa", fontSize: 18, fontWeight: "700", marginTop: 3, letterSpacing: -0.2 },
  highlightSub: { color: "#d4d4d4", fontSize: 12, marginTop: 6 },

  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionLabel: {
    color: "#737373", fontSize: 10, textTransform: "uppercase", letterSpacing: 1,
    marginBottom: 10,
  },
  flavorRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  flavorPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: "rgba(251,191,36,0.3)",
    backgroundColor: "rgba(251,191,36,0.05)",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  flavorLabel: { color: "#fde68a", fontSize: 13 },
  flavorAvg: { color: "#fcd34d", fontSize: 11 },

  distGrid: {
    flexDirection: "row", gap: 10,
    paddingHorizontal: 16, marginTop: 20,
  },
  distBox: {
    flex: 1,
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 10, padding: 12,
  },
  distTitle: {
    color: "#737373", fontSize: 10, textTransform: "uppercase",
    letterSpacing: 0.5, marginBottom: 8,
  },
  distRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 4,
  },
  distLabel: { color: "#d4d4d4", fontSize: 13 },
  distCount: { color: "#737373", fontSize: 13 },

  socialCard: {
    marginHorizontal: 16, marginTop: 20,
    flexDirection: "row", gap: 20,
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 10, padding: 14,
  },
  socialItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  socialText: { color: "#a3a3a3", fontSize: 12 },
  socialNum: { color: "#fafafa", fontWeight: "600" },

  empty: {
    marginHorizontal: 16, marginTop: 30,
    borderWidth: 1, borderColor: "#262626", borderStyle: "dashed",
    borderRadius: 12, padding: 30, alignItems: "center",
  },
  emptyMsg: { color: "#a3a3a3", fontSize: 13 },
  emptyLink: { color: "#fcd34d", fontSize: 11, marginTop: 10 },
});
