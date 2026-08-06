import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth-context";
import { CASK_LABEL, BOTTLER_LABEL } from "@/lib/format";
import type { CaskType, BottlerKind } from "@/types/database";

const CASKS: CaskType[] = ["bourbon", "sherry", "port", "wine", "rum", "virgin_oak", "refill", "mixed", "other", "unknown"];
const BOTTLERS: BottlerKind[] = ["official", "independent", "private"];
const THIS_YEAR = new Date().getFullYear();

type BarcodeSource = "manufacturer" | "importer" | "retailer" | "unknown";
const SOURCE_OPTIONS: { key: BarcodeSource; label: string }[] = [
  { key: "manufacturer", label: "제조사 원본" },
  { key: "importer", label: "한글 수입 스티커" },
  { key: "retailer", label: "유통사 부착" },
  { key: "unknown", label: "모름" },
];
const SOURCE_SHORT: Record<BarcodeSource, string> = {
  manufacturer: "제조사",
  importer: "수입 스티커",
  retailer: "유통사",
  unknown: "종류 미지정",
};

type Barcode = { id: string; barcode: string; source: BarcodeSource };

type Bottling = {
  id: string;
  distillery_id: string | null;
  name: string;
  name_kr: string | null;
  age_years: number | null;
  abv: number | null;
  vintage_year: number | null;
  bottling_year: number | null;
  cask_type: CaskType;
  bottler: BottlerKind;
  bottler_name: string | null;
  bottle_size_ml: number | null;
  total_bottles: number | null;
  notes: string | null;
};

export default function EditBottling() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<Bottling | null>(null);

  const [name, setName] = useState("");
  const [nameKr, setNameKr] = useState("");
  const [ageYears, setAgeYears] = useState("");
  const [abv, setAbv] = useState("");
  const [vintageYear, setVintageYear] = useState("");
  const [bottlingYear, setBottlingYear] = useState("");
  const [caskType, setCaskType] = useState<CaskType>("unknown");
  const [bottler, setBottler] = useState<BottlerKind>("official");
  const [bottlerName, setBottlerName] = useState("");
  const [bottleSizeMl, setBottleSizeMl] = useState("");
  const [totalBottles, setTotalBottles] = useState("");
  const [notes, setNotes] = useState("");
  const [barcodes, setBarcodes] = useState<Barcode[]>([]);
  const [newBarcode, setNewBarcode] = useState("");
  const [newSource, setNewSource] = useState<BarcodeSource>("unknown");
  const [barcodeBusy, setBarcodeBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data }, { data: barcodeRows }] = await Promise.all([
        supabase
          .from("bottlings")
          .select("id, distillery_id, name, name_kr, age_years, abv, vintage_year, bottling_year, cask_type, bottler, bottler_name, bottle_size_ml, total_bottles, notes")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("bottling_barcodes")
          .select("id, barcode, source")
          .eq("bottling_id", id)
          .order("created_at", { ascending: true }),
      ]);
      const b = data as unknown as Bottling | null;
      if (!b) {
        Alert.alert("찾을 수 없어요", "위스키 정보를 불러오지 못했어요.");
        router.back();
        return;
      }
      setCurrent(b);
      setName(b.name ?? "");
      setNameKr(b.name_kr ?? "");
      setAgeYears(b.age_years?.toString() ?? "");
      setAbv(b.abv?.toString() ?? "");
      setVintageYear(b.vintage_year?.toString() ?? "");
      setBottlingYear(b.bottling_year?.toString() ?? "");
      setCaskType((b.cask_type ?? "unknown") as CaskType);
      setBottler((b.bottler ?? "official") as BottlerKind);
      setBottlerName(b.bottler_name ?? "");
      setBottleSizeMl(b.bottle_size_ml?.toString() ?? "");
      setTotalBottles(b.total_bottles?.toString() ?? "");
      setNotes(b.notes ?? "");
      setBarcodes((barcodeRows as unknown as Barcode[]) ?? []);
      setLoading(false);
    })();
  }, [id, router]);

  async function addBarcode() {
    const value = newBarcode.trim();
    if (!value || !current || !session || barcodeBusy) return;
    if (value.length > 64) { Alert.alert("바코드 길이", "바코드는 64자 이내로 입력해주세요."); return; }
    if (barcodes.some((b) => b.barcode === value)) {
      Alert.alert("이미 등록됨", "이 바코드는 이미 등록돼 있어요.");
      return;
    }
    setBarcodeBusy(true);
    const { data, error: insertError } = await supabase
      .from("bottling_barcodes")
      .insert({
        bottling_id: current.id,
        barcode: value,
        source: newSource,
        created_by: session.user.id,
      } as never)
      .select("id, barcode, source")
      .single();
    setBarcodeBusy(false);
    if (insertError) {
      const msg = /duplicate|unique/i.test(insertError.message)
        ? "이 바코드는 이미 다른 위스키에 등록되어 있어요."
        : insertError.message;
      Alert.alert("바코드 추가 실패", msg);
      return;
    }
    const inserted = data as unknown as Barcode;
    setBarcodes((prev) => [...prev, inserted]);
    setNewBarcode("");
    setNewSource("unknown");
  }

  async function removeBarcode(barcodeId: string) {
    if (barcodeBusy) return;
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        "바코드 삭제",
        "이 바코드를 삭제할까요? 다시 스캔해도 이 위스키와 연결되지 않아요.",
        [
          { text: "취소", style: "cancel", onPress: () => resolve(false) },
          { text: "삭제", style: "destructive", onPress: () => resolve(true) },
        ],
        { onDismiss: () => resolve(false) },
      );
    });
    if (!confirmed) return;
    setBarcodeBusy(true);
    const { error: deleteError } = await supabase
      .from("bottling_barcodes")
      .delete()
      .eq("id", barcodeId);
    setBarcodeBusy(false);
    if (deleteError) {
      Alert.alert("삭제 실패", deleteError.message);
      return;
    }
    setBarcodes((prev) => prev.filter((b) => b.id !== barcodeId));
  }

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
    if (!session || saving || !current) return;
    setError(null);

    const nameKrTrim = nameKr.trim();
    const nameTrim = name.trim();
    if (!nameKrTrim) { setError("한글 이름을 입력해주세요."); return; }
    if (nameKrTrim.length > 200) { setError("한글 이름은 200자 이내."); return; }
    if (nameTrim.length > 200) { setError("영문 이름은 200자 이내."); return; }
    const finalName = nameTrim.length > 0 ? nameTrim : nameKrTrim;

    const age = intOrNull(ageYears);
    if (age !== null && (age < 0 || age > 100)) { setError("숙성 연수는 0~100."); return; }

    const abvN = numOrNull(abv);
    if (abvN !== null && (abvN < 20 || abvN > 80)) { setError("ABV는 20~80%."); return; }

    const vintage = intOrNull(vintageYear);
    if (vintage !== null && (vintage < 1900 || vintage > THIS_YEAR)) { setError(`빈티지 연도는 1900~${THIS_YEAR}.`); return; }

    const bottlingY = intOrNull(bottlingYear);
    if (bottlingY !== null && (bottlingY < 1900 || bottlingY > THIS_YEAR + 1)) { setError(`병입 연도는 1900~${THIS_YEAR + 1}.`); return; }

    const size = intOrNull(bottleSizeMl);
    if (size !== null && (size < 50 || size > 10000)) { setError("병 용량은 50~10000ml."); return; }

    const total = intOrNull(totalBottles);
    if (total !== null && total < 1) { setError("총 병수는 1 이상."); return; }

    if (notes.trim().length > 2000) { setError("노트는 2000자 이내."); return; }

    setSaving(true);
    const { error: updateError } = await supabase
      .from("bottlings")
      .update({
        name: finalName,
        name_kr: nameKrTrim,
        age_years: age,
        abv: abvN,
        vintage_year: vintage,
        bottling_year: bottlingY,
        cask_type: caskType,
        bottler,
        bottler_name: bottlerName.trim() || null,
        bottle_size_ml: size ?? 700,
        total_bottles: total,
        notes: notes.trim() || null,
      } as never)
      .eq("id", current.id);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    router.replace(`/(tabs)/whiskies/${current.id}` as never);
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>로그인 후 수정할 수 있어요.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fbbf24" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0a0a0a" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "위스키 정보 수정" }} />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={80}
      >
        <Text style={styles.lead}>
          잘못된 정보를 발견하면 누구나 고칠 수 있어요. 신중히 작성해주세요.
        </Text>

        <Field label="한글 이름 *">
          <TextInput
            value={nameKr}
            onChangeText={setNameKr}
            maxLength={200}
            placeholder="예: 맥켈란 12년 셰리 오크"
            placeholderTextColor="#525252"
            style={styles.input}
          />
        </Field>

        <Field label="영문 이름">
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={200}
            placeholder="예: Macallan 12yo Sherry Oak"
            placeholderTextColor="#525252"
            style={styles.input}
          />
        </Field>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="숙성 (년)">
              <TextInput
                value={ageYears}
                onChangeText={setAgeYears}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="12"
                placeholderTextColor="#525252"
                style={styles.input}
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="ABV (%)">
              <TextInput
                value={abv}
                onChangeText={setAbv}
                keyboardType="decimal-pad"
                maxLength={5}
                placeholder="40"
                placeholderTextColor="#525252"
                style={styles.input}
              />
            </Field>
          </View>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="빈티지 연도">
              <TextInput
                value={vintageYear}
                onChangeText={setVintageYear}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="2010"
                placeholderTextColor="#525252"
                style={styles.input}
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="병입 연도">
              <TextInput
                value={bottlingYear}
                onChangeText={setBottlingYear}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="2024"
                placeholderTextColor="#525252"
                style={styles.input}
              />
            </Field>
          </View>
        </View>

        <Field label="캐스크 타입">
          <View style={styles.pillWrap}>
            {CASKS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCaskType(c)}
                style={({ pressed }) => [
                  styles.pill,
                  caskType === c && styles.pillActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.pillText, caskType === c && styles.pillTextActive]}>
                  {CASK_LABEL[c]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="병입 종류">
          <View style={styles.pillWrap}>
            {BOTTLERS.map((b) => (
              <Pressable
                key={b}
                onPress={() => setBottler(b)}
                style={({ pressed }) => [
                  styles.pill,
                  bottler === b && styles.pillActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.pillText, bottler === b && styles.pillTextActive]}>
                  {BOTTLER_LABEL[b]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="병입사 이름">
          <TextInput
            value={bottlerName}
            onChangeText={setBottlerName}
            maxLength={100}
            placeholder="예: Signatory"
            placeholderTextColor="#525252"
            style={styles.input}
          />
        </Field>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="병 용량 (ml)">
              <TextInput
                value={bottleSizeMl}
                onChangeText={setBottleSizeMl}
                keyboardType="number-pad"
                maxLength={5}
                placeholder="700"
                placeholderTextColor="#525252"
                style={styles.input}
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="총 병수">
              <TextInput
                value={totalBottles}
                onChangeText={setTotalBottles}
                keyboardType="number-pad"
                maxLength={7}
                placeholder="12000"
                placeholderTextColor="#525252"
                style={styles.input}
              />
            </Field>
          </View>
        </View>

        <Field label="바코드">
          <Text style={styles.hint}>한 위스키에 여러 바코드(제조사·수입 스티커·유통사) 등록 가능</Text>

          {barcodes.length > 0 && (
            <View style={{ gap: 6 }}>
              {barcodes.map((bc) => (
                <View key={bc.id} style={styles.barcodeItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.barcodeItemSource}>{SOURCE_SHORT[bc.source]}</Text>
                    <Text style={styles.barcodeItemCode}>{bc.barcode}</Text>
                  </View>
                  <Pressable
                    onPress={() => removeBarcode(bc.id)}
                    disabled={barcodeBusy}
                    style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }, barcodeBusy && { opacity: 0.5 }]}
                  >
                    <Text style={styles.removeBtnText}>삭제</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View style={{ gap: 6, marginTop: 8 }}>
            <View style={styles.pillWrap}>
              {SOURCE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => setNewSource(opt.key)}
                  style={({ pressed }) => [styles.pill, newSource === opt.key && styles.pillActive, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.pillText, newSource === opt.key && styles.pillTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.barcodeRow}>
              <TextInput
                value={newBarcode}
                onChangeText={setNewBarcode}
                maxLength={64}
                placeholder="바코드 직접 입력 (스캔은 위스키 목록 화면에서)"
                placeholderTextColor="#525252"
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { flex: 1 }]}
              />
              <Pressable
                onPress={addBarcode}
                disabled={!newBarcode.trim() || barcodeBusy}
                style={({ pressed }) => [
                  styles.addBtn,
                  (!newBarcode.trim() || barcodeBusy) && { opacity: 0.5 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.addBtnText}>추가</Text>
              </Pressable>
            </View>
          </View>
        </Field>

        <Field label={`노트 (${notes.length}/2000)`}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={2000}
            placeholder="이 위스키에 대한 공식/일반 노트"
            placeholderTextColor="#525252"
            style={[styles.input, styles.textareaTall]}
          />
        </Field>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={saving || !nameKr.trim()}
          style={({ pressed }) => [
            styles.submitBtn,
            (saving || !nameKr.trim()) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.submitText}>{saving ? "저장 중…" : "수정 저장"}</Text>
        </Pressable>

        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancelText}>취소</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a", padding: 24 },
  muted: { color: "#737373", textAlign: "center" },
  container: { padding: 16, gap: 14, paddingBottom: 40 },
  lead: { color: "#a3a3a3", fontSize: 12, lineHeight: 18 },
  label: { color: "#a3a3a3", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    color: "#fafafa",
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 8, fontSize: 14,
  },
  textareaTall: { minHeight: 100, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10 },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: {
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1, borderColor: "#262626",
    backgroundColor: "#171717",
  },
  pillActive: { borderColor: "#fbbf24", backgroundColor: "rgba(251, 191, 36, 0.1)" },
  pillText: { color: "#a3a3a3", fontSize: 12 },
  pillTextActive: { color: "#fbbf24", fontWeight: "600" },

  error: { color: "#fca5a5", fontSize: 12 },
  submitBtn: {
    backgroundColor: "#fbbf24",
    paddingVertical: 13,
    borderRadius: 8, alignItems: "center",
    marginTop: 8,
  },
  submitText: { color: "#0a0a0a", fontWeight: "700", fontSize: 15 },
  cancelText: { color: "#737373", textAlign: "center", padding: 12 },
  barcodeRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  hint: { color: "#737373", fontSize: 11, lineHeight: 16 },
  barcodeItemRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 8, padding: 10,
  },
  barcodeItemSource: {
    color: "#a3a3a3", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5,
  },
  barcodeItemCode: { color: "#fbbf24", fontSize: 13, fontWeight: "600", letterSpacing: 0.5, marginTop: 2 },
  removeBtn: {
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "rgba(244, 63, 94, 0.4)",
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6,
  },
  removeBtnText: { color: "#fca5a5", fontSize: 12, fontWeight: "600" },
  addBtn: {
    backgroundColor: "#fbbf24",
    paddingHorizontal: 16, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  addBtnText: { color: "#0a0a0a", fontWeight: "700", fontSize: 13 },
});
