import { View, Text, StyleSheet } from "react-native";
import Svg, { Polygon, Line, Circle, G, Text as SvgText } from "react-native-svg";

export type FlavorProfileData = {
  avg_sweetness: number | null;
  avg_smokiness: number | null;
  avg_fruitiness: number | null;
  avg_spiciness: number | null;
  avg_smoothness: number | null;
  avg_complexity: number | null;
  avg_finish_length: number | null;
};

const AXES = [
  { key: "avg_sweetness",     label: "단맛" },
  { key: "avg_smokiness",     label: "스모키" },
  { key: "avg_fruitiness",    label: "과일맛" },
  { key: "avg_spiciness",     label: "스파이시" },
  { key: "avg_finish_length", label: "여운" },
  { key: "avg_complexity",    label: "복잡도" },
  { key: "avg_smoothness",    label: "부드러움" },
] as const;

const MAX = 10;
const SIZE = 300;
const PADDING = 52;
const RADIUS = (SIZE - PADDING * 2) / 2;
const CENTER = SIZE / 2;
const RINGS = 5;

function polar(angle: number, distance: number): [number, number] {
  return [
    CENTER + distance * Math.cos(angle),
    CENTER + distance * Math.sin(angle),
  ];
}

export function FlavorProfile({ data }: { data: FlavorProfileData }) {
  const values = AXES.map((axis) => data[axis.key]);
  const hasAny = values.some((v) => v !== null);

  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;

  const polyPoints = values
    .map((v, i) => {
      const distance = ((v ?? 0) / MAX) * RADIUS;
      const [x, y] = polar(angleFor(i), distance);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Flavor profile</Text>
      <Text style={styles.subtitle}>
        {hasAny ? "후기 평균 · 1~10" : "후기에서 맛 프로필이 입력되면 채워져요 · 1~10"}
      </Text>

      <View style={styles.chartWrap}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* 동심 폴리곤 그리드 */}
          {Array.from({ length: RINGS }, (_, ringIdx) => {
            const ringRadius = (RADIUS * (ringIdx + 1)) / RINGS;
            const ringPoints = AXES.map((_, i) => {
              const [x, y] = polar(angleFor(i), ringRadius);
              return `${x.toFixed(2)},${y.toFixed(2)}`;
            }).join(" ");
            return (
              <Polygon
                key={ringIdx}
                points={ringPoints}
                fill="none"
                stroke="#fafafa"
                strokeOpacity={ringIdx === RINGS - 1 ? 0.25 : 0.12}
                strokeWidth={1}
              />
            );
          })}

          {/* 중심 → 각 축 라인 */}
          {AXES.map((_, i) => {
            const [x, y] = polar(angleFor(i), RADIUS);
            return (
              <Line
                key={i}
                x1={CENTER}
                y1={CENTER}
                x2={x}
                y2={y}
                stroke="#fafafa"
                strokeOpacity={0.12}
                strokeWidth={1}
              />
            );
          })}

          {/* 데이터 폴리곤 */}
          {hasAny && (
            <Polygon
              points={polyPoints}
              fill="rgba(251, 191, 36, 0.18)"
              stroke="#fbbf24"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          )}

          {/* 데이터 포인트 */}
          {values.map((v, i) => {
            if (v === null) return null;
            const distance = (v / MAX) * RADIUS;
            const [x, y] = polar(angleFor(i), distance);
            return <Circle key={i} cx={x} cy={y} r={3} fill="#fbbf24" />;
          })}

          {/* 축 라벨 */}
          {AXES.map((axis, i) => {
            const angle = angleFor(i);
            const [x, y] = polar(angle, RADIUS + 18);
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            const anchor: "start" | "middle" | "end" =
              Math.abs(dx) < 0.2 ? "middle" : dx > 0 ? "start" : "end";
            const yOffset = Math.abs(dy) < 0.2 ? 4 : dy > 0 ? 10 : -2;
            const value = values[i];
            return (
              <G key={axis.key}>
                <SvgText
                  x={x}
                  y={y + yOffset}
                  textAnchor={anchor}
                  fontSize={11}
                  fontWeight="500"
                  fill="rgba(250, 250, 250, 0.8)"
                >
                  {axis.label}
                </SvgText>
                {value !== null && (
                  <SvgText
                    x={x}
                    y={y + yOffset + 12}
                    textAnchor={anchor}
                    fontSize={10}
                    fill="#fcd34d"
                  >
                    {value.toFixed(1)}
                  </SvgText>
                )}
              </G>
            );
          })}
        </Svg>
      </View>

      {/* 축별 텍스트 요약 */}
      <View style={styles.grid}>
        {AXES.map((axis, i) => {
          const v = values[i];
          return (
            <View key={axis.key} style={styles.row}>
              <Text style={styles.rowLabel}>{axis.label}</Text>
              <Text style={[styles.rowValue, v === null && styles.rowValueEmpty]}>
                {v === null ? "—" : v.toFixed(1)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 16,
    backgroundColor: "rgba(23, 23, 23, 0.4)",
  },
  title: { color: "#fafafa", fontSize: 20, fontWeight: "600", letterSpacing: -0.3 },
  subtitle: { color: "#737373", fontSize: 11, marginTop: 4 },
  chartWrap: { alignItems: "center", marginTop: 12 },
  grid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 6,
  },
  row: {
    width: "50%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingRight: 12,
  },
  rowLabel: { color: "rgba(250, 250, 250, 0.8)", fontSize: 13 },
  rowValue: { color: "#fcd34d", fontSize: 13, fontVariant: ["tabular-nums"] },
  rowValueEmpty: { color: "rgba(115, 115, 115, 0.6)" },
});
