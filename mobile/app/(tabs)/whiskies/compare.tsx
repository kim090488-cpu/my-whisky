import { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { COUNTRY_FLAG, CASK_LABEL, BOTTLER_LABEL, formatAge, formatAbv } from "@/lib/format";
import { BottlingSearchPicker, type PickedBottling } from "@/components/whisky/bottling-search-picker";
import type { WhiskyCountry, CaskType, BottlerKind } from "@/types/database";

type BottlingFull = {
  id: string;
  name: string;
  name_kr: string | null;
  age_years: number | null;
  abv: number | null;
  cask_type: CaskType;
  bottler: BottlerKind;
  bottler_name: string | null;
  bottle_size_ml: number | null;
  vintage_year: number | null;
  bottling_year: number | null;
  distillery: { name: string; name_kr: string | null; country: WhiskyCountry } | null;
  avg_score: number | null;
  tasting_count: number;
  flavor: FlavorAgg | null;
};

type FlavorAgg = {
  sweetness: number | null; smokiness: number | null; fruitiness: number | null;
  spiciness: number | null; smoothness: number | null; complexity: number | null;
  finish_length: number | null;
};

const FLAVOR_AXES: Array<{ k: keyof FlavorAgg; label: string }> = [
  { k: "sweetness", label: "단맛" },
  { k: "smokiness", label: "스모크" },
  { k: "fruitiness", label: "과일" },
  { k: "spiciness", label: "스파이스" },
  { k: "smoothness", label: "부드러움" },
  { k: "complexity", label: "복합미" },
  { k: "finish_length", label: "여운" },
];

export default function CompareBottlings() {
  const router = useRouter();
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const [a, setA] = useState<BottlingFull | null>(null);
  const [b, setB] = useState<BottlingFull | null>(null);
  const [pickerFor, setPickerFor] = useState<"a" | "b" | null>(null);

  const loadOne = useCallback(async (id: string | null): Promise<BottlingFull | null> => {
    if (!id) return null;
    const [bRes, tRes] = await Promise.all([
      supabase
        .from("bottlings")
        .select("id, name, name_kr, age_years, abv, cask_type, bottler, bottler_name, bottle_size_ml, vintage_year, bottling_year, distillery:distilleries(name, name_kr, country)")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("tastings")
        .select("score, sweetness, smokiness, fruitiness, spiciness, smoothness, complexity, finish_length")
        .eq("bottling_id", id),
    ]);
    const row = bRes.data as unknown as (Omit<BottlingFull, "distillery" | "avg_score" | "tasting_count" | "flavor"> & {
      distillery: { name: string; name_kr: string | null; country: WhiskyCountry } | { name: string; name_kr: string | null; country: WhiskyCountry }[] | null;
    }) | null;
    if (!row) return null;
    const dist = Array.isArray(row.distillery) ? row.distillery[0] : row.distillery;

    const tastings = (tRes.data ?? []) as Array<{ score: number | null } & FlavorAgg>;
    const scored = tastings.filter((t) => t.score !== null);
    const avg_score = scored.length > 0
      ? Math.round((scored.reduce((s, t) => s + (t.score as number), 0) / scored.length) * 10) / 10
      : null;

    const flavor: FlavorAgg | null = tastings.length > 0
      ? {
          sweetness: avgAxis(tastings, "sweetness"),
          smokiness: avgAxis(tastings, "smokiness"),
          fruitiness: avgAxis(tastings, "fruitiness"),
          spiciness: avgAxis(tastings, "spiciness"),
          smoothness: avgAxis(tastings, "smoothness"),
          complexity: avgAxis(tastings, "complexity"),
          finish_length: avgAxis(tastings, "finish_length"),
        }
      : null;

    return { ...row, distillery: dist ?? null, avg_score, tasting_count: tastings.length, flavor };
  }, []);

  useEffect(() => { void (async () => setA(await loadOne(aId)))(); }, [aId, loadOne]);
  useEffect(() => { void (async () => setB(await loadOne(bId)))(); }, [bId, loadOne]);

  function onPick(target: "a" | "b", picked: PickedBottling) {
    if (target === "a") setAId(picked.id); else setBId(picked.id);
    setPickerFor(null);
  }

  if (pickerFor) {
    return (
      <BottlingSearchPicker
        onSelect={(p) => onPick(pickerFor, p)}
        onCancel={() => setPickerFor(null)}
        title="비교할 위스키 선택"
      />
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#0a0a0a" }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ title: "위스키 비교" }} />
      <Text style={styles.lead}>두 위스키를 선택하면 스펙·평점·향미가 나란히 비교됩니다.</Text>
      <View style={styles.pickerRow}>
        <SlotButton bottling={a} onPress={() => setPickerFor("a")} onClear={() => { setAId(null); setA(null); }} />
        <View style={styles.vsBadge}><Text style={styles.vsText}>VS</Text></View>
        <SlotButton bottling={b} onPress={() => setPickerFor("b")} onClear={() => { setBId(null); setB(null); }} />
      </View>

      {(a || b) && (
        <View style={styles.section}>
          <SectionTitle title="기본 스펙" />
          <Row label="이름" a={a?.name_kr ?? a?.name} b={b?.name_kr ?? b?.name} />
          <Row label="증류소" a={a?.distillery ? `${COUNTRY_FLAG[a.distillery.country]} ${a.distillery.name_kr ?? a.distillery.name}` : null}
                              b={b?.distillery ? `${COUNTRY_FLAG[b.distillery.country]} ${b.distillery.name_kr ?? b.distillery.name}` : null} />
          <Row label="숙성" a={a ? formatAge(a.age_years) : null} b={b ? formatAge(b.age_years) : null} />
          <Row label="ABV" a={a ? formatAbv(a.abv) : null} b={b ? formatAbv(b.abv) : null} />
          <Row label="캐스크" a={a?.cask_type ? CASK_LABEL[a.cask_type] : null} b={b?.cask_type ? CASK_LABEL[b.cask_type] : null} />
          <Row label="병입" a={a ? BOTTLER_LABEL[a.bottler] + (a.bottler_name ? ` · ${a.bottler_name}` : "") : null}
                            b={b ? BOTTLER_LABEL[b.bottler] + (b.bottler_name ? ` · ${b.bottler_name}` : "") : null} />
          <Row label="용량" a={a?.bottle_size_ml ? `${a.bottle_size_ml}ml` : null} b={b?.bottle_size_ml ? `${b.bottle_size_ml}ml` : null} />
          {(a?.vintage_year != null || b?.vintage_year != null) && (
            <Row label="빈티지" a={a?.vintage_year?.toString() ?? null} b={b?.vintage_year?.toString() ?? null} />
          )}
          {(a?.bottling_year != null || b?.bottling_year != null) && (
            <Row label="병입연도" a={a?.bottling_year?.toString() ?? null} b={b?.bottling_year?.toString() ?? null} />
          )}
        </View>
      )}

      {(a || b) && (
        <View style={styles.section}>
          <SectionTitle title="커뮤니티 평점" />
          <ScoreCompare a={a} b={b} />
        </View>
      )}

      {(a?.flavor || b?.flavor) && (
        <View style={styles.section}>
          <SectionTitle title="향미 프로필 (평균)" />
          {FLAVOR_AXES.map((ax) => (
            <FlavorRow key={ax.k} label={ax.label} a={a?.flavor?.[ax.k] ?? null} b={b?.flavor?.[ax.k] ?? null} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function SlotButton({ bottling, onPress, onClear }: { bottling: BottlingFull | null; onPress: () => void; onClear: () => void }) {
  return (
    <View style={{ flex: 1 }}>
      {bottling ? (
        <View style={styles.slotFilled}>
          <Text style={styles.slotName} numberOfLines={2}>{bottling.name_kr ?? bottling.name}</Text>
          {bottling.distillery && (
            <Text style={styles.slotSub} numberOfLines={1}>
              {COUNTRY_FLAG[bottling.distillery.country]} {bottling.distillery.name_kr ?? bottling.distillery.name}
            </Text>
          )}
          <View style={styles.slotActions}>
            <Pressable onPress={onPress} hitSlop={4}><Text style={styles.slotAction}>변경</Text></Pressable>
            <Pressable onPress={onClear} hitSlop={4}><Text style={[styles.slotAction, { color: "#fca5a5" }]}>제거</Text></Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.slotEmpty, pressed && { opacity: 0.7 }]}>
          <Ionicons name="add" size={22} color="#fbbf24" />
          <Text style={styles.slotEmptyText}>위스키 선택</Text>
        </Pressable>
      )}
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function Row({ label, a, b }: { label: string; a?: string | null; b?: string | null }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValues}>
        <Text style={styles.rowVal}>{a ?? "—"}</Text>
        <Text style={styles.rowVal}>{b ?? "—"}</Text>
      </View>
    </View>
  );
}

function ScoreCompare({ a, b }: { a: BottlingFull | null; b: BottlingFull | null }) {
  return (
    <View style={styles.scoreRow}>
      <View style={styles.scoreCol}>
        <Text style={styles.scoreBig}>{a?.avg_score ?? "—"}</Text>
        <Text style={styles.scoreSub}>{a ? `${a.tasting_count}개 노트` : ""}</Text>
      </View>
      <View style={styles.scoreCol}>
        <Text style={styles.scoreBig}>{b?.avg_score ?? "—"}</Text>
        <Text style={styles.scoreSub}>{b ? `${b.tasting_count}개 노트` : ""}</Text>
      </View>
    </View>
  );
}

function FlavorRow({ label, a, b }: { label: string; a: number | null; b: number | null }) {
  return (
    <View style={styles.flavorRow}>
      <Text style={styles.flavorLabel}>{label}</Text>
      <View style={{ flex: 1, gap: 4 }}>
        <FlavorBar value={a} color="#fbbf24" />
        <FlavorBar value={b} color="#93c5fd" />
      </View>
    </View>
  );
}

function FlavorBar({ value, color }: { value: number | null; color: string }) {
  const w = value != null ? `${Math.min(100, value * 10)}%` as const : "0%" as const;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: w, backgroundColor: color }]} />
      <Text style={styles.barText}>{value != null ? value.toFixed(1) : "—"}</Text>
    </View>
  );
}

function avgAxis(rows: Array<Partial<FlavorAgg>>, key: keyof FlavorAgg): number | null {
  const nums = rows.map((r) => r[key]).filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

const styles = StyleSheet.create({
  lead: { color: "#a3a3a3", fontSize: 12, padding: 16, paddingBottom: 8 },
  pickerRow: { flexDirection: "row", gap: 8, padding: 12, alignItems: "center" },
  vsBadge: { backgroundColor: "#fbbf24", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  vsText: { color: "#0a0a0a", fontSize: 11, fontWeight: "800" },
  slotEmpty: {
    padding: 20, borderRadius: 10,
    borderWidth: 1, borderStyle: "dashed", borderColor: "#404040",
    backgroundColor: "#111",
    alignItems: "center", justifyContent: "center", gap: 4, minHeight: 100,
  },
  slotEmptyText: { color: "#fbbf24", fontSize: 12, fontWeight: "600" },
  slotFilled: {
    padding: 12, borderRadius: 10,
    backgroundColor: "#111", borderWidth: 1, borderColor: "#262626",
    gap: 4, minHeight: 100,
  },
  slotName: { color: "#fafafa", fontSize: 13, fontWeight: "600" },
  slotSub: { color: "#a3a3a3", fontSize: 11 },
  slotActions: { flexDirection: "row", gap: 12, marginTop: "auto" },
  slotAction: { color: "#fbbf24", fontSize: 11 },

  section: { padding: 16, gap: 6 },
  sectionTitle: { color: "#a3a3a3", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "600", marginBottom: 4 },
  row: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#171717", gap: 8 },
  rowLabel: { color: "#737373", fontSize: 11, width: 60 },
  rowValues: { flex: 1, flexDirection: "row", gap: 12 },
  rowVal: { color: "#fafafa", fontSize: 13, flex: 1 },

  scoreRow: { flexDirection: "row", gap: 12, paddingVertical: 10 },
  scoreCol: { flex: 1, alignItems: "center", padding: 12, backgroundColor: "#111", borderRadius: 10, borderWidth: 1, borderColor: "#262626" },
  scoreBig: { color: "#fbbf24", fontSize: 32, fontWeight: "800" },
  scoreSub: { color: "#737373", fontSize: 11 },

  flavorRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  flavorLabel: { color: "#a3a3a3", fontSize: 11, width: 66 },
  barTrack: { height: 20, backgroundColor: "#171717", borderRadius: 10, overflow: "hidden", justifyContent: "center" },
  barFill: { position: "absolute", left: 0, top: 0, bottom: 0, opacity: 0.65 },
  barText: { color: "#fafafa", fontSize: 10, fontWeight: "600", textAlign: "right", paddingHorizontal: 8 },
});
