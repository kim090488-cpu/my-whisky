import { View, Text, StyleSheet } from "react-native";
import type {
  DistItem,
  ScoreBucket,
  TasteDashboard,
} from "@/lib/tastings/taste-profile";

const MIN_TOTAL = 5;

export function TasteDashboardCard({
  dashboard,
  isSelf,
}: {
  dashboard: TasteDashboard;
  isSelf: boolean;
}) {
  if (dashboard.total < MIN_TOTAL) return null;

  const hasFlavor = dashboard.flavors.some((f) => f.count > 0);
  const hasAny =
    hasFlavor ||
    dashboard.topCountries.length > 0 ||
    dashboard.topCasks.length > 0 ||
    dashboard.topRegions.length > 0 ||
    dashboard.ageBands.length > 0 ||
    dashboard.scoreBuckets.some((b) => b.count > 0) ||
    dashboard.abvBuckets.length > 0;
  if (!hasAny) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>취향 상세</Text>
      <View style={styles.card}>
        {hasFlavor && <FlavorBars flavors={dashboard.flavors} />}
        {dashboard.topCountries.length > 0 && (
          <DistributionRow title="즐겨 마신 국가" items={dashboard.topCountries} />
        )}
        {dashboard.topCasks.length > 0 && (
          <DistributionRow title="캐스크" items={dashboard.topCasks} />
        )}
        {dashboard.topRegions.length > 0 && (
          <DistributionRow title="서브지역" items={dashboard.topRegions} />
        )}
        {dashboard.ageBands.length > 0 && (
          <DistributionRow title="숙성대" items={dashboard.ageBands} />
        )}
        {dashboard.scoreBuckets.some((b) => b.count > 0) && (
          <ScoreDistribution buckets={dashboard.scoreBuckets} />
        )}
        {dashboard.abvBuckets.length > 0 && (
          <DistributionBars title="ABV 분포" items={dashboard.abvBuckets} />
        )}
      </View>
      {isSelf && dashboard.total < 10 && (
        <Text style={styles.hint}>노트가 쌓일수록 세밀해져요 (지금 {dashboard.total}개).</Text>
      )}
    </View>
  );
}

function FlavorBars({ flavors }: { flavors: TasteDashboard["flavors"] }) {
  const visible = flavors.filter((f) => f.count > 0);
  if (visible.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>향미 프로파일</Text>
      {visible.map((f) => {
        const pct = Math.max(0, Math.min(100, (f.avg / 10) * 100));
        return (
          <View key={f.key} style={styles.barRow}>
            <Text style={styles.barLabel}>{f.label}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFillAmber, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.barValue}>{f.avg.toFixed(1)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function DistributionRow({ title, items }: { title: string; items: DistItem[] }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.pillRow}>
        {items.map((item) => (
          <View key={item.key} style={styles.pill}>
            <Text style={styles.pillLabel}>{item.label}</Text>
            <Text style={styles.pillPct}>{item.pct}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function DistributionBars({ title, items }: { title: string; items: DistItem[] }) {
  const max = items.reduce((m, b) => Math.max(m, b.count), 0);
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {items.map((item) => (
        <BucketBar
          key={item.key}
          label={item.label}
          count={item.count}
          pct={max > 0 ? (item.count / max) * 100 : 0}
          highlight={item.count === max}
        />
      ))}
    </View>
  );
}

function ScoreDistribution({ buckets }: { buckets: ScoreBucket[] }) {
  const max = buckets.reduce((m, b) => Math.max(m, b.count), 0);
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>점수 분포</Text>
      {buckets.map((b) => (
        <BucketBar
          key={b.label}
          label={b.label}
          count={b.count}
          pct={max > 0 ? (b.count / max) * 100 : 0}
          highlight={b.count === max && b.count > 0}
        />
      ))}
    </View>
  );
}

function BucketBar({
  label,
  count,
  pct,
  highlight,
}: {
  label: string;
  count: number;
  pct: number;
  highlight: boolean;
}) {
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View
          style={[
            highlight ? styles.barFillAmber : styles.barFillNeutral,
            { width: `${pct}%` },
          ]}
        />
      </View>
      <Text style={styles.barValueSmall}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: "#737373",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 12,
    padding: 14,
    gap: 14,
  },
  hint: {
    color: "#525252",
    fontSize: 11,
    marginTop: 6,
  },
  group: {
    gap: 8,
  },
  groupTitle: {
    color: "#a3a3a3",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  barLabel: {
    width: 56,
    color: "#737373",
    fontSize: 11,
  },
  barTrack: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  barFillAmber: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(251,191,36,0.7)",
  },
  barFillNeutral: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  barValue: {
    width: 32,
    color: "#d4d4d4",
    fontSize: 11,
    textAlign: "right",
  },
  barValueSmall: {
    width: 28,
    color: "#d4d4d4",
    fontSize: 11,
    textAlign: "right",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#262626",
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillLabel: { color: "#d4d4d4", fontSize: 11 },
  pillPct: { color: "#737373", fontSize: 10 },
});
