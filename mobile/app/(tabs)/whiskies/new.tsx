import { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth-context";
import { CASK_LABEL, BOTTLER_LABEL } from "@/lib/format";
import type { CaskType, BottlerKind } from "@/types/database";

const CASKS: CaskType[] = ["bourbon", "sherry", "port", "wine", "rum", "virgin_oak", "refill", "mixed", "other", "unknown"];
const BOTTLERS: BottlerKind[] = ["official", "independent", "private"];

type BarcodeSource = "manufacturer" | "importer" | "retailer" | "unknown";
const SOURCE_OPTIONS: { key: BarcodeSource; label: string }[] = [
  { key: "manufacturer", label: "제조사 원본" },
  { key: "importer", label: "한글 수입 스티커" },
  { key: "retailer", label: "유통사 부착" },
  { key: "unknown", label: "모름" },
];

export default function NewBottling() {
  const { barcode } = useLocalSearchParams<{ barcode?: string }>();
  const router = useRouter();
  const { session } = useSession();

  const [nameKr, setNameKr] = useState("");
  const [name, setName] = useState("");
  const [ageYears, setAgeYears] = useState("");
  const [abv, setAbv] = useState("");
  const [caskType, setCaskType] = useState<CaskType>("unknown");
  const [bottler, setBottler] = useState<BottlerKind>("official");
  const [source, setSource] = useState<BarcodeSource>("unknown");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function intOrNull(v: string): number | null {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  function numOrNull(v: string): number | null {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  async function submit() {
    if (!session || saving) return;
    setError(null);
    const nk = nameKr.trim();
    const n = name.trim();
    if (!nk) { setError("한글 이름은 필수예요."); return; }
    if (nk.length > 200) { setError("한글 이름은 200자 이내."); return; }
    if (n.length > 200) { setError("영문 이름은 200자 이내."); return; }
    const finalName = n || nk;

    const age = intOrNull(ageYears);
    if (age !== null && (age < 0 || age > 100)) { setError("숙성 연수 0~100"); return; }
    const abvN = numOrNull(abv);
    if (abvN !== null && (abvN < 20 || abvN > 80)) { setError("ABV 20~80%"); return; }

    setSaving(true);
    const { data, error: insertError } = await supabase
      .from("bottlings")
      .insert({
        name: finalName,
        name_kr: nk,
        age_years: age,
        abv: abvN,
        cask_type: caskType,
        bottler,
        bottle_size_ml: 700,
        created_by: session.user.id,
      } as never)
      .select("id")
      .single();
    if (insertError) {
      setSaving(false);
      Alert.alert("등록 실패", insertError.message);
      return;
    }
    const newId = (data as unknown as { id: string } | null)?.id;
    if (newId && barcode) {
      const { error: barcodeError } = await supabase
        .from("bottling_barcodes")
        .insert({
          bottling_id: newId,
          barcode,
          source,
          created_by: session.user.id,
        } as never);
      if (barcodeError && !/duplicate|unique/i.test(barcodeError.message)) {
        // 위스키 등록은 됐으니 진행하되 유저에게 알림
        Alert.alert("바코드 등록 실패", `위스키는 등록됐지만 바코드 저장에 실패했어요: ${barcodeError.message}`);
      }
    }
    setSaving(false);
    if (newId) router.replace(`/(tabs)/whiskies/${newId}` as never);
    else router.back();
  }

  if (!session) {
    return <View style={styles.center}><Text style={styles.muted}>로그인 후 이용 가능합니다.</Text></View>;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#0a0a0a" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: "새 위스키 등록" }} />
      <KeyboardAwareScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" enableOnAndroid extraScrollHeight={80}>
        {barcode && (
          <View style={{ gap: 8 }}>
            <View style={styles.barcodeCard}>
              <Text style={styles.barcodeLabel}>스캔된 바코드</Text>
              <Text style={styles.barcodeValue}>{barcode}</Text>
            </View>
            <Text style={styles.label}>바코드 종류</Text>
            <View style={styles.pillWrap}>
              {SOURCE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => setSource(opt.key)}
                  style={({ pressed }) => [styles.pill, source === opt.key && styles.pillActive, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.pillText, source === opt.key && styles.pillTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        <Text style={styles.lead}>최소 정보만 입력해도 됩니다. 상세는 나중에 편집 가능.</Text>

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>한글 이름 *</Text>
          <TextInput
            value={nameKr} onChangeText={setNameKr} maxLength={200}
            placeholder="예: 맥켈란 12년 셰리 오크"
            placeholderTextColor="#525252" style={styles.input}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>영문 이름</Text>
          <TextInput
            value={name} onChangeText={setName} maxLength={200}
            placeholder="예: Macallan 12yo Sherry Oak"
            placeholderTextColor="#525252" style={styles.input}
          />
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.label}>숙성 (년)</Text>
            <TextInput value={ageYears} onChangeText={setAgeYears} keyboardType="number-pad" maxLength={3} placeholder="12" placeholderTextColor="#525252" style={styles.input} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.label}>ABV (%)</Text>
            <TextInput value={abv} onChangeText={setAbv} keyboardType="decimal-pad" maxLength={5} placeholder="40" placeholderTextColor="#525252" style={styles.input} />
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>캐스크</Text>
          <View style={styles.pillWrap}>
            {CASKS.map((c) => (
              <Pressable key={c} onPress={() => setCaskType(c)} style={({ pressed }) => [styles.pill, caskType === c && styles.pillActive, pressed && { opacity: 0.7 }]}>
                <Text style={[styles.pillText, caskType === c && styles.pillTextActive]}>{CASK_LABEL[c]}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>병입</Text>
          <View style={styles.pillWrap}>
            {BOTTLERS.map((b) => (
              <Pressable key={b} onPress={() => setBottler(b)} style={({ pressed }) => [styles.pill, bottler === b && styles.pillActive, pressed && { opacity: 0.7 }]}>
                <Text style={[styles.pillText, bottler === b && styles.pillTextActive]}>{BOTTLER_LABEL[b]}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable onPress={submit} disabled={saving || !nameKr.trim()}
          style={({ pressed }) => [styles.submit, (saving || !nameKr.trim()) && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}>
          <Text style={styles.submitText}>{saving ? "등록 중…" : "등록"}</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}><Text style={styles.cancel}>취소</Text></Pressable>
      </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a", padding: 24 },
  muted: { color: "#737373", textAlign: "center" },
  container: { padding: 16, gap: 14, paddingBottom: 40 },
  lead: { color: "#a3a3a3", fontSize: 12, lineHeight: 18 },
  label: { color: "#a3a3a3", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    backgroundColor: "#171717", borderWidth: 1, borderColor: "#262626",
    color: "#fafafa", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, fontSize: 14,
  },
  row: { flexDirection: "row", gap: 10 },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "#262626", backgroundColor: "#171717" },
  pillActive: { borderColor: "#fbbf24", backgroundColor: "rgba(251, 191, 36, 0.1)" },
  pillText: { color: "#a3a3a3", fontSize: 12 },
  pillTextActive: { color: "#fbbf24", fontWeight: "600" },
  error: { color: "#fca5a5", fontSize: 12 },
  submit: { backgroundColor: "#fbbf24", paddingVertical: 13, borderRadius: 8, alignItems: "center", marginTop: 8 },
  submitText: { color: "#0a0a0a", fontWeight: "700", fontSize: 15 },
  cancel: { color: "#737373", textAlign: "center", padding: 12 },
  barcodeCard: {
    backgroundColor: "rgba(251, 191, 36, 0.08)",
    borderWidth: 1, borderColor: "rgba(251, 191, 36, 0.35)",
    borderRadius: 8, padding: 12, gap: 4,
  },
  barcodeLabel: { color: "#a3a3a3", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  barcodeValue: { color: "#fbbf24", fontSize: 14, fontWeight: "600", letterSpacing: 1 },
});
