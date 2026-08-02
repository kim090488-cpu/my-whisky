import { useCallback, useEffect, useState } from "react";
import {
  View, Text, FlatList, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth-context";
import { COUNTRY_FLAG, formatAge, formatAbv } from "@/lib/format";
import type { WhiskyCountry } from "@/types/database";

type Bottling = {
  id: string;
  name: string;
  name_kr: string | null;
  age_years: number | null;
  abv: number | null;
  distillery_name: string;
  distillery_name_kr: string | null;
  country: WhiskyCountry;
  region: string | null;
  avg_score: number | null;
  tasting_count: number;
};

const SELECT =
  "id, name, name_kr, age_years, abv, distillery_name, distillery_name_kr, country, region, avg_score, tasting_count";

export default function LinkBarcode() {
  const { barcode } = useLocalSearchParams<{ barcode?: string }>();
  const router = useRouter();
  const { session } = useSession();

  const [q, setQ] = useState("");
  const [items, setItems] = useState<Bottling[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const search = useCallback(async (term: string) => {
    const t = term.trim();
    if (!t) { setItems([]); return; }
    setLoading(true);
    const safe = t.replace(/[%_\\]/g, (m) => `\\${m}`);
    const pattern = `%${safe}%`;
    const [byName, byDist] = await Promise.all([
      supabase
        .from("bottling_card_stats")
        .select(SELECT)
        .or(`name.ilike.${pattern},name_kr.ilike.${pattern}`)
        .order("name")
        .limit(30),
      supabase
        .from("bottling_card_stats")
        .select(SELECT)
        .or(`distillery_name.ilike.${pattern},distillery_name_kr.ilike.${pattern}`)
        .order("name")
        .limit(30),
    ]);
    const merged = [...((byName.data as Bottling[]) ?? []), ...((byDist.data as Bottling[]) ?? [])];
    const seen = new Set<string>();
    const unique = merged.filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
    unique.sort((a, b) => a.name.localeCompare(b.name));
    setItems(unique);
    setLoading(false);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => { search(q); }, 250);
    return () => clearTimeout(handle);
  }, [q, search]);

  async function link(bottlingId: string) {
    if (!barcode || linkingId) return;
    // 이미 barcode 있는지 조회 후 확인
    const { data: current, error: readError } = await supabase
      .from("bottlings")
      .select("id, name_kr, name, barcode")
      .eq("id", bottlingId)
      .maybeSingle();
    if (readError || !current) {
      Alert.alert("연결 실패", readError?.message ?? "위스키를 찾을 수 없어요.");
      return;
    }
    const row = current as unknown as { id: string; name_kr: string | null; name: string; barcode: string | null };
    if (row.barcode && row.barcode !== barcode) {
      const displayName = row.name_kr ?? row.name;
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "이미 다른 바코드가 등록돼 있어요",
          `${displayName}에는 이미 바코드가 있어요.\n기존: ${row.barcode}\n새로: ${barcode}\n덮어쓸까요?`,
          [
            { text: "취소", style: "cancel", onPress: () => resolve(false) },
            { text: "덮어쓰기", style: "destructive", onPress: () => resolve(true) },
          ],
        );
      });
      if (!proceed) return;
    }

    setLinkingId(bottlingId);
    console.log("[link-barcode] updating", bottlingId, "with", barcode);
    const { error: updateError } = await supabase
      .from("bottlings")
      .update({ barcode } as never)
      .eq("id", bottlingId);
    console.log("[link-barcode] update result:", updateError?.message ?? "ok");
    setLinkingId(null);

    if (updateError) {
      // unique 위반이면 이미 다른 위스키에 이 barcode가 붙어있음
      const msg = /duplicate|unique/i.test(updateError.message)
        ? "이 바코드는 이미 다른 위스키에 등록되어 있어요."
        : updateError.message;
      Alert.alert("연결 실패", msg);
      return;
    }
    router.replace(`/whiskies/${bottlingId}` as never);
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "바코드 연결" }} />
        <Text style={styles.muted}>로그인 후 이용 가능합니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "바코드 연결" }} />
      <View style={styles.barcodeCard}>
        <Text style={styles.barcodeLabel}>연결할 바코드</Text>
        <Text style={styles.barcodeValue}>{barcode ?? "(없음)"}</Text>
      </View>
      <Text style={styles.lead}>기존 카탈로그에서 이 병에 해당하는 위스키를 찾아 선택하면 바코드가 연결돼요.</Text>

      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="위스키 이름·증류소로 검색"
        placeholderTextColor="#525252"
        returnKeyType="search"
        autoCorrect={false}
        autoFocus
        style={styles.searchInput}
      />

      <FlatList
        data={items}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => {
          const isLinking = linkingId === item.id;
          return (
            <Pressable
              onPress={() => link(item.id)}
              disabled={linkingId !== null}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }, linkingId !== null && !isLinking && { opacity: 0.5 }]}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.cardDist} numberOfLines={1}>
                  {COUNTRY_FLAG[item.country]} {item.distillery_name_kr ?? item.distillery_name}
                  {item.region ? ` · ${item.region}` : ""}
                </Text>
                {item.avg_score !== null ? (
                  <View style={styles.scoreBadge}>
                    <Text style={styles.scoreText}>{item.avg_score}</Text>
                    <Text style={styles.scoreCount}>({item.tasting_count})</Text>
                  </View>
                ) : (
                  <Text style={styles.noNote}>노트 없음</Text>
                )}
              </View>
              <Text style={styles.cardName} numberOfLines={2}>{item.name_kr ?? item.name}</Text>
              <Text style={styles.cardMeta}>
                {formatAge(item.age_years)} · {formatAbv(item.abv)}
                {isLinking ? "  ·  연결 중…" : ""}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#fbbf24" style={{ marginTop: 40 }} />
          ) : q.trim() ? (
            <Text style={styles.empty}>"{q}"에 대한 결과가 없어요.{"\n"}아래 버튼으로 새 위스키를 등록하세요.</Text>
          ) : (
            <Text style={styles.empty}>검색어를 입력하세요.</Text>
          )
        }
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      />

      <View style={styles.footerBar}>
        <Pressable
          onPress={() => router.replace(`/(tabs)/whiskies/new?barcode=${encodeURIComponent(barcode ?? "")}` as never)}
          style={({ pressed }) => [styles.registerBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.registerBtnText}>+ 새 위스키로 등록</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a", padding: 24 },
  muted: { color: "#737373", textAlign: "center" },
  barcodeCard: {
    marginHorizontal: 12, marginTop: 10,
    backgroundColor: "rgba(251, 191, 36, 0.08)",
    borderWidth: 1, borderColor: "rgba(251, 191, 36, 0.35)",
    borderRadius: 8, padding: 12, gap: 4,
  },
  barcodeLabel: { color: "#a3a3a3", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  barcodeValue: { color: "#fbbf24", fontSize: 14, fontWeight: "600", letterSpacing: 1 },
  lead: { color: "#a3a3a3", fontSize: 12, lineHeight: 18, paddingHorizontal: 12, paddingTop: 8 },
  searchInput: {
    marginHorizontal: 12, marginTop: 10,
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    color: "#fafafa",
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 8, fontSize: 14,
  },
  card: {
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 10,
    padding: 14,
  },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  cardDist: { color: "#a3a3a3", fontSize: 12, flex: 1 },
  scoreBadge: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  scoreText: { color: "#fbbf24", fontSize: 16, fontWeight: "700" },
  scoreCount: { color: "#737373", fontSize: 11 },
  noNote: { color: "#525252", fontSize: 11 },
  cardName: { color: "#fafafa", fontSize: 15, fontWeight: "500", marginTop: 4 },
  cardMeta: { color: "#a3a3a3", fontSize: 12, marginTop: 4 },
  empty: { color: "#737373", textAlign: "center", fontSize: 14, marginTop: 40, lineHeight: 20 },
  footerBar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 20,
    borderTopWidth: 1, borderTopColor: "#171717",
    backgroundColor: "rgba(10,10,10,0.96)",
  },
  registerBtn: {
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#fbbf24",
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8,
    alignItems: "center",
  },
  registerBtnText: { color: "#fbbf24", fontWeight: "600", fontSize: 14 },
});
