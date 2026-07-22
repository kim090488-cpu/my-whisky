import { View } from "react-native";
import Svg, { Polygon, Line, Circle, G, Text as SvgText } from "react-native-svg";

export type FlavorValues = {
  sweetness: number | null;
  smokiness: number | null;
  fruitiness: number | null;
  spiciness: number | null;
  smoothness: number | null;
  complexity: number | null;
  finish_length: number | null;
};

const AXES = [
  { key: "sweetness",     label: "단맛" },
  { key: "smokiness",     label: "스모키" },
  { key: "fruitiness",    label: "과일맛" },
  { key: "spiciness",     label: "스파이시" },
  { key: "finish_length", label: "여운" },
  { key: "complexity",    label: "복잡도" },
  { key: "smoothness",    label: "부드러움" },
] as const satisfies readonly { key: keyof FlavorValues; label: string }[];

const MAX = 10;
const RINGS = 5;

function polar(cx: number, cy: number, angle: number, r: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function angleFor(i: number) {
  return -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
}

export function FlavorRadar({
  values,
  size = 260,
  showValueLabels = false,
}: {
  values: FlavorValues;
  size?: number;
  showValueLabels?: boolean;
}) {
  const filled = AXES.reduce((n, a) => n + (values[a.key] !== null ? 1 : 0), 0);
  if (filled === 0) return null;

  const padding = showValueLabels ? 40 : 26;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - 2 * padding) / 2;

  const rings = Array.from({ length: RINGS }, (_, ringIdx) => {
    const rr = (r * (ringIdx + 1)) / RINGS;
    return {
      idx: ringIdx,
      points: AXES.map((_, i) => {
        const p = polar(cx, cy, angleFor(i), rr);
        return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      }).join(" "),
    };
  });

  const dataPoints = AXES.map((a, i) => {
    const v = values[a.key];
    const dist = ((v ?? 0) / MAX) * r;
    const p = polar(cx, cy, angleFor(i), dist);
    return { x: p.x, y: p.y, value: v };
  });
  const dataPolygon = dataPoints
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((ring) => (
          <Polygon
            key={ring.idx}
            points={ring.points}
            fill="none"
            stroke="#f5f5f5"
            strokeOpacity={ring.idx === RINGS - 1 ? 0.25 : 0.12}
            strokeWidth={1}
          />
        ))}
        {AXES.map((_, i) => {
          const p = polar(cx, cy, angleFor(i), r);
          return (
            <Line
              key={i}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="#f5f5f5"
              strokeOpacity={0.12}
              strokeWidth={1}
            />
          );
        })}
        <Polygon
          points={dataPolygon}
          fill="rgba(251, 191, 36, 0.18)"
          stroke="rgb(251, 191, 36)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {dataPoints.map((p, i) =>
          p.value !== null ? (
            <Circle key={i} cx={p.x} cy={p.y} r={2.75} fill="rgb(251, 191, 36)" />
          ) : null,
        )}
        {AXES.map((axis, i) => {
          const angle = angleFor(i);
          const labelPos = polar(cx, cy, angle, r + 16);
          const dx = Math.cos(angle);
          const dy = Math.sin(angle);
          const anchor: "start" | "middle" | "end" =
            Math.abs(dx) < 0.2 ? "middle" : dx > 0 ? "start" : "end";
          const dyAdjust =
            Math.abs(dy) < 0.2 ? "0.35em" : dy > 0 ? "0.85em" : "-0.1em";
          const value = values[axis.key];
          const hasValue = value !== null;
          return (
            <G key={axis.key}>
              <SvgText
                x={labelPos.x}
                y={labelPos.y}
                textAnchor={anchor}
                dy={dyAdjust}
                fontSize={11}
                fontWeight={hasValue ? "500" : "400"}
                fill={hasValue ? "#f5f5f5" : "#737373"}
                fillOpacity={hasValue ? 0.8 : 0.5}
              >
                {axis.label}
              </SvgText>
              {showValueLabels && hasValue && (
                <SvgText
                  x={labelPos.x}
                  y={labelPos.y + 13}
                  textAnchor={anchor}
                  dy={dyAdjust}
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
  );
}
