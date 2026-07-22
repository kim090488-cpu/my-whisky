import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, Image,
  ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  pickAndUploadTastingPhoto, deleteTastingPhoto, tastingPhotoUrl,
} from "@/lib/uploads";
import type { TastingVisibility } from "@/types/database";

type RecommendedKind = "beginner" | "intermediate" | "expert" | "gift";
const RECOMMENDED: readonly { k: RecommendedKind; l: string }[] = [
  { k: "beginner",     l: "초보자" },
  { k: "intermediate", l: "중급" },
  { k: "expert",       l: "전문가" },
  { k: "gift",         l: "선물용" },
];
const VALUE_LABELS = ["가격 아까움", "그저 그럼", "적정", "이 가격에 좋음", "가격 대비 최고"] as const;

const MAX_PHOTOS = 3;

const VISIBILITIES: { v: TastingVisibility; l: string }[] = [
  { v: "public", l: "공개" },
  { v: "followers", l: "팔로워만" },
  { v: "private", l: "비공개" },
];

export default function EditTasting() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();

  const [score, setScore] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState("");
  const [visibility, setVisibility] = useState<TastingVisibility>("public");
  const [photos, setPhotos] = useState<string[]>([]);
  const [initialPhotos, setInitialPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bottlingName, setBottlingName] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  // 향미 7축 (null = 미기록, 1~10)
  const [sweetness, setSweetness] = useState<number | null>(null);
  const [smokiness, setSmokiness] = useState<number | null>(null);
  const [fruitiness, setFruitiness] = useState<number | null>(null);
  const [spiciness, setSpiciness] = useState<number | null>(null);
  const [smoothness, setSmoothness] = useState<number | null>(null);
  const [complexity, setComplexity] = useState<number | null>(null);
  const [finishLength, setFinishLength] = useState<number | null>(null);

  // 구매 메타
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseCurrency, setPurchaseCurrency] = useState("KRW");
  const [purchasedAtPlace, setPurchasedAtPlace] = useState("");
  const [foodPairing, setFoodPairing] = useState("");

  // Verdict
  const [wouldBuyAgain, setWouldBuyAgain] = useState<boolean | null>(null);
  const [valueForMoney, setValueForMoney] = useState<number | null>(null);
  const [recommendedFor, setRecommendedFor] = useState<RecommendedKind[]>([]);

  useEffect(() => {
    if (!id || !session) return;
    (async () => {
      setLoading(true);
      const { data: t } = await supabase
        .from("tastings")
        .select(
          "id, user_id, bottling_id, score, notes, color, visibility, photos, " +
            "sweetness, smokiness, fruitiness, spiciness, smoothness, complexity, finish_length, " +
            "purchase_price, purchase_currency, purchased_at_place, food_pairing, " +
            "would_buy_again, value_for_money, recommended_for",
        )
        .eq("id", id)
        .maybeSingle();
      if (!t) {
        setLoading(false);
        return;
      }
      const row = t as unknown as {
        user_id: string;
        bottling_id: string;
        score: number | null;
        notes: string | null;
        color: string | null;
        visibility: TastingVisibility;
        photos: string[] | null;
        sweetness: number | null;
        smokiness: number | null;
        fruitiness: number | null;
        spiciness: number | null;
        smoothness: number | null;
        complexity: number | null;
        finish_length: number | null;
        purchase_price: number | null;
        purchase_currency: string | null;
        purchased_at_place: string | null;
        food_pairing: string | null;
        would_buy_again: boolean | null;
        value_for_money: number | null;
        recommended_for: RecommendedKind[] | null;
      };
      if (row.user_id !== session.user.id) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      setScore(row.score?.toString() ?? "");
      setNotes(row.notes ?? "");
      setColor(row.color ?? "");
      setVisibility(row.visibility ?? "public");
      const existingPhotos = row.photos ?? [];
      setPhotos(existingPhotos);
      setInitialPhotos(existingPhotos);

      setSweetness(row.sweetness);
      setSmokiness(row.smokiness);
      setFruitiness(row.fruitiness);
      setSpiciness(row.spiciness);
      setSmoothness(row.smoothness);
      setComplexity(row.complexity);
      setFinishLength(row.finish_length);

      setPurchasePrice(row.purchase_price?.toString() ?? "");
      setPurchaseCurrency(row.purchase_currency ?? "KRW");
      setPurchasedAtPlace(row.purchased_at_place ?? "");
      setFoodPairing(row.food_pairing ?? "");

      setWouldBuyAgain(row.would_buy_again);
      setValueForMoney(row.value_for_money);
      setRecommendedFor(row.recommended_for ?? []);

      const { data: b } = await supabase
        .from("bottlings")
        .select("name, name_kr")
        .eq("id", row.bottling_id)
        .maybeSingle();
      const bRow = b as unknown as { name: string; name_kr: string | null } | null;
      if (bRow) setBottlingName(bRow.name_kr ?? bRow.name);

      setLoading(false);
    })();
  }, [id, session]);

  async function addPhoto() {
    if (!session || photos.length >= MAX_PHOTOS) return;
    setPhotoBusy(true);
    try {
      const path = await pickAndUploadTastingPhoto(session.user.id);
      if (path) setPhotos((prev) => [...prev, path]);
    } catch (e) {
      Alert.alert("사진 업로드 실패", e instanceof Error ? e.message : String(e));
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhoto(index: number) {
    // 실제 storage 삭제는 저장 시점에 (revert 대비)
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    if (!session || !id || pending) return;
    if (score) {
      const n = Number(score);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        Alert.alert("입력 오류", "점수는 0~100 사이의 숫자여야 해요.");
        return;
      }
    }

    const priceNum = purchasePrice.trim() ? Number(purchasePrice) : null;
    if (priceNum !== null && (!Number.isFinite(priceNum) || priceNum < 0)) {
      Alert.alert("입력 오류", "구매가는 0 이상의 숫자여야 해요.");
      return;
    }

    setPending(true);
    const { error } = await supabase
      .from("tastings")
      .update({
        score: score ? Number(score) : null,
        notes: notes.trim() || null,
        color: color.trim() || null,
        visibility,
        photos,
        sweetness,
        smokiness,
        fruitiness,
        spiciness,
        smoothness,
        complexity,
        finish_length: finishLength,
        purchase_price: priceNum,
        purchase_currency: priceNum !== null ? purchaseCurrency : null,
        purchased_at_place: purchasedAtPlace.trim() || null,
        food_pairing: foodPairing.trim() || null,
        would_buy_again: wouldBuyAgain,
        value_for_money: valueForMoney,
        recommended_for: recommendedFor.length > 0 ? recommendedFor : null,
      } as never)
      .eq("id", id)
      .eq("user_id", session.user.id);

    if (error) {
      setPending(false);
      Alert.alert("저장 실패", error.message);
      return;
    }

    // 최종적으로 폼에서 사라진 사진의 storage 파일 정리 (best-effort)
    const removed = initialPhotos.filter((p) => !photos.includes(p));
    for (const p of removed) {
      try { await deleteTastingPhoto(p); } catch { /* orphan 무시 */ }
    }

    setPending(false);
    router.back();
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>로그인 후 다시 시도해주세요.</Text>
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
  if (forbidden) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>본인 노트만 수정할 수 있어요.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0a0a0a" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "노트 수정" }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {bottlingName && <Text style={styles.subtitle}>{bottlingName}</Text>}

        <Field label="점수 (0–100)">
          <TextInput
            value={score}
            onChangeText={setScore}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="—"
            placeholderTextColor="#525252"
            style={styles.input}
          />
        </Field>

        <Field label="공개 범위">
          <View style={styles.pillRow}>
            {VISIBILITIES.map((v) => (
              <Pressable
                key={v.v}
                onPress={() => setVisibility(v.v)}
                style={({ pressed }) => [
                  styles.pill,
                  visibility === v.v && styles.pillActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.pillText, visibility === v.v && styles.pillTextActive]}>
                  {v.l}
                </Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="색">
          <TextInput
            value={color}
            onChangeText={setColor}
            placeholder="예: 진한 호박색"
            placeholderTextColor="#525252"
            style={styles.input}
          />
        </Field>

        <Field label="노트">
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="향·맛·피니시·총평을 자유롭게…"
            placeholderTextColor="#525252"
            style={[styles.input, styles.textareaTall]}
          />
        </Field>

        {/* Verdict */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>총평</Text>
          <Text style={styles.sectionHint}>선택 사항</Text>
        </View>

        <Field label="다시 사시겠어요?">
          <View style={styles.pillRow}>
            {([[true, "예"], [false, "아니오"], [null, "미결정"]] as const).map(([v, l]) => (
              <Pressable
                key={String(v)}
                onPress={() => setWouldBuyAgain(v)}
                style={({ pressed }) => [
                  styles.pill,
                  wouldBuyAgain === v && styles.pillActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.pillText, wouldBuyAgain === v && styles.pillTextActive]}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label={`가성비 ${valueForMoney ? `(${VALUE_LABELS[valueForMoney - 1]})` : ""}`}>
          <View style={styles.valuePillRow}>
            {[1, 2, 3, 4, 5].map((n) => {
              const active = valueForMoney === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setValueForMoney(active ? null : n)}
                  style={({ pressed }) => [
                    styles.valuePill,
                    active && styles.pillActive,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.valuePillNum, active && styles.pillTextActive]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="누구에게 추천하시나요">
          <View style={styles.chipRow}>
            {RECOMMENDED.map(({ k, l }) => {
              const active = recommendedFor.includes(k);
              return (
                <Pressable
                  key={k}
                  onPress={() =>
                    setRecommendedFor((prev) =>
                      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
                    )
                  }
                  style={({ pressed }) => [
                    styles.chip,
                    active && styles.pillActive,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.chipText, active && styles.pillTextActive]}>{l}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        {/* 향미 프로필 (1-10) */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>향미 프로필</Text>
          <Text style={styles.sectionHint}>탭해서 기록 · 각 축 1–10</Text>
        </View>
        <FlavorAxis label="단맛" value={sweetness} onChange={setSweetness} />
        <FlavorAxis label="스모키" value={smokiness} onChange={setSmokiness} />
        <FlavorAxis label="과일맛" value={fruitiness} onChange={setFruitiness} />
        <FlavorAxis label="스파이시" value={spiciness} onChange={setSpiciness} />
        <FlavorAxis label="부드러움" value={smoothness} onChange={setSmoothness} />
        <FlavorAxis label="복잡도" value={complexity} onChange={setComplexity} />
        <FlavorAxis label="여운 길이" value={finishLength} onChange={setFinishLength} />

        {/* 구매 메타 */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>구매 정보</Text>
          <Text style={styles.sectionHint}>선택 사항</Text>
        </View>

        <Field label="구매가">
          <View style={styles.priceRow}>
            <TextInput
              value={purchasePrice}
              onChangeText={setPurchasePrice}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor="#525252"
              style={[styles.input, { flex: 1 }]}
            />
            <View style={styles.currencyRow}>
              {(["KRW", "USD", "JPY"] as const).map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setPurchaseCurrency(c)}
                  style={({ pressed }) => [
                    styles.currencyPill,
                    purchaseCurrency === c && styles.pillActive,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[
                    styles.currencyPillText,
                    purchaseCurrency === c && styles.pillTextActive,
                  ]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Field>

        <Field label="구매처">
          <TextInput
            value={purchasedAtPlace}
            onChangeText={setPurchasedAtPlace}
            placeholder="예: 마트, 면세점, 온라인"
            placeholderTextColor="#525252"
            style={styles.input}
          />
        </Field>

        <Field label="추천 페어링">
          <TextInput
            value={foodPairing}
            onChangeText={setFoodPairing}
            placeholder="예: 다크초콜릿, 견과류"
            placeholderTextColor="#525252"
            style={styles.input}
          />
        </Field>

        <Field label={`사진 (${photos.length}/${MAX_PHOTOS})`}>
          <View style={styles.photoRow}>
            {photos.map((p, i) => {
              const url = tastingPhotoUrl(p);
              return (
                <View key={p} style={styles.photoBox}>
                  {url && <Image source={{ uri: url }} style={styles.photoImg} />}
                  <Pressable onPress={() => removePhoto(i)} style={styles.photoRemove} hitSlop={6}>
                    <Text style={styles.photoRemoveText}>×</Text>
                  </Pressable>
                </View>
              );
            })}
            {photos.length < MAX_PHOTOS && (
              <Pressable
                onPress={addPhoto}
                disabled={photoBusy}
                style={({ pressed }) => [
                  styles.photoAdd,
                  pressed && { opacity: 0.7 },
                  photoBusy && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.photoAddText}>{photoBusy ? "올리는 중…" : "+ 사진"}</Text>
              </Pressable>
            )}
          </View>
        </Field>

        <Pressable
          onPress={submit}
          disabled={pending}
          style={({ pressed }) => [
            styles.submitButton,
            pending && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.submitText}>{pending ? "저장 중…" : "저장"}</Text>
        </Pressable>

        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancelText}>취소</Text>
        </Pressable>
      </ScrollView>
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

function FlavorAxis({
  label, value, onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const isSet = value !== null;
  return (
    <View style={styles.axisRow}>
      <View style={styles.axisHead}>
        <Text style={[styles.axisLabel, !isSet && styles.axisLabelDim]}>{label}</Text>
        {isSet ? (
          <View style={styles.axisMeta}>
            <Text style={styles.axisValue}>{value}</Text>
            <Pressable onPress={() => onChange(null)} hitSlop={6}>
              <Text style={styles.axisClear}>✕</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => onChange(5)}
            style={({ pressed }) => [styles.axisStart, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.axisStartText}>+ 기록</Text>
          </Pressable>
        )}
      </View>
      {isSet && (
        <View style={styles.axisPillRow}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const active = n === value;
            return (
              <Pressable
                key={n}
                onPress={() => onChange(n)}
                style={({ pressed }) => [
                  styles.axisPill,
                  active && styles.axisPillActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.axisPillText, active && styles.axisPillTextActive]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a", padding: 24 },
  muted: { color: "#737373", textAlign: "center" },
  container: { padding: 16, gap: 16, paddingBottom: 40 },
  subtitle: { color: "#a3a3a3", fontSize: 13 },
  label: { color: "#a3a3a3", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    color: "#fafafa",
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 8, fontSize: 14,
  },
  textareaTall: { minHeight: 110, textAlignVertical: "top" },
  pillRow: { flexDirection: "row", gap: 8 },
  pill: {
    flex: 1, paddingVertical: 9, alignItems: "center",
    borderRadius: 8, borderWidth: 1, borderColor: "#262626",
    backgroundColor: "#171717",
  },
  pillActive: { borderColor: "#fbbf24", backgroundColor: "rgba(251, 191, 36, 0.1)" },
  pillText: { color: "#a3a3a3", fontSize: 13 },
  pillTextActive: { color: "#fde68a", fontWeight: "600" },
  submitButton: {
    backgroundColor: "#fbbf24",
    paddingVertical: 13,
    borderRadius: 8, alignItems: "center",
    marginTop: 8,
  },
  submitText: { color: "#0a0a0a", fontWeight: "600", fontSize: 15 },
  cancelText: { color: "#737373", textAlign: "center", padding: 12 },

  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoBox: {
    width: 80, height: 80, borderRadius: 8,
    overflow: "hidden", borderWidth: 1, borderColor: "#262626",
    position: "relative",
  },
  photoImg: { width: "100%", height: "100%" },
  photoRemove: {
    position: "absolute", right: 2, top: 2,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 5, borderRadius: 4,
  },
  photoRemoveText: { color: "#fafafa", fontSize: 14, lineHeight: 16 },
  photoAdd: {
    width: 80, height: 80,
    borderRadius: 8, borderWidth: 1, borderStyle: "dashed",
    borderColor: "#525252",
    alignItems: "center", justifyContent: "center",
  },
  photoAddText: { color: "#a3a3a3", fontSize: 12 },

  sectionHead: {
    marginTop: 8, marginBottom: -4,
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between",
  },
  sectionTitle: { color: "#fafafa", fontSize: 14, fontWeight: "600" },
  sectionHint: { color: "#525252", fontSize: 11 },

  axisRow: { gap: 8 },
  axisHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  axisLabel: { color: "#e5e5e5", fontSize: 13 },
  axisLabelDim: { color: "#737373" },
  axisMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  axisValue: { color: "#fbbf24", fontSize: 15, fontWeight: "600", minWidth: 20, textAlign: "right" },
  axisClear: { color: "#737373", fontSize: 12, paddingHorizontal: 4 },
  axisStart: {
    borderWidth: 1, borderColor: "#404040",
    borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  axisStartText: { color: "#a3a3a3", fontSize: 11 },
  axisPillRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  axisPill: {
    width: 28, height: 28,
    borderRadius: 6, borderWidth: 1, borderColor: "#262626",
    backgroundColor: "#171717",
    alignItems: "center", justifyContent: "center",
  },
  axisPillActive: { borderColor: "#fbbf24", backgroundColor: "rgba(251, 191, 36, 0.15)" },
  axisPillText: { color: "#737373", fontSize: 11, fontWeight: "500" },
  axisPillTextActive: { color: "#fde68a", fontWeight: "700" },

  priceRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  currencyRow: { flexDirection: "row", gap: 4 },
  currencyPill: {
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 6, borderWidth: 1, borderColor: "#262626",
    backgroundColor: "#171717",
  },
  currencyPillText: { color: "#a3a3a3", fontSize: 12 },

  valuePillRow: { flexDirection: "row", gap: 6 },
  valuePill: {
    flex: 1, paddingVertical: 10, alignItems: "center",
    borderRadius: 8, borderWidth: 1, borderColor: "#262626",
    backgroundColor: "#171717",
  },
  valuePillNum: { color: "#a3a3a3", fontSize: 15, fontWeight: "600" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1, borderColor: "#262626",
    backgroundColor: "#171717",
  },
  chipText: { color: "#a3a3a3", fontSize: 12 },
});
