import { useCallback, useEffect, useState } from "react";
import {
  View, Text, FlatList, TextInput, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
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

const PAGE = 24;
const SELECT =
  "id, name, name_kr, age_years, abv, distillery_name, distillery_name_kr, country, region, avg_score, tasting_count";

export default function WhiskiesIndex() {
  const router = useRouter();
  const [items, setItems] = useState<Bottling[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [end, setEnd] = useState(false);

  const fetchPage = useCallback(
    async (offset: number, term: string): Promise<Bottling[]> => {
      const t = term.trim();

      // 검색어 있을 때: 보틀링 이름 + 증류소 이름 2개 쿼리 후 dedupe
      // (한 번에 최대 100개 — 페이지네이션은 검색 모드에선 비활성)
      if (t) {
        const safe = t.replace(/[%_\\]/g, (m) => `\\${m}`);
        const pattern = `%${safe}%`;
        const [byName, byDist] = await Promise.all([
          supabase
            .from("bottling_card_stats")
            .select(SELECT)
            .or(`name.ilike.${pattern},name_kr.ilike.${pattern}`)
            .order("name")
            .limit(50),
          supabase
            .from("bottling_card_stats")
            .select(SELECT)
            .or(`distillery_name.ilike.${pattern},distillery_name_kr.ilike.${pattern}`)
            .order("name")
            .limit(50),
        ]);
        const merged = [...((byName.data as Bottling[]) ?? []), ...((byDist.data as Bottling[]) ?? [])];
        const seen = new Set<string>();
        const unique = merged.filter((b) => {
          if (seen.has(b.id)) return false;
          seen.add(b.id);
          return true;
        });
        unique.sort((a, b) => a.name.localeCompare(b.name));
        return unique;
      }

      // 검색어 없을 때: 일반 페이지네이션
      const { data } = await supabase
        .from("bottling_card_stats")
        .select(SELECT)
        .order("name")
        .range(offset, offset + PAGE - 1);
      return (data as Bottling[]) ?? [];
    },
    [],
  );

  const reset = useCallback(
    async (term: string) => {
      setLoading(true);
      const data = await fetchPage(0, term);
      setItems(data);
      // 검색 모드에선 한 번에 다 받았으므로 더보기 차단
      setEnd(term.trim().length > 0 || data.length < PAGE);
      setLoading(false);
    },
    [fetchPage],
  );

  // q 입력 → 250ms debounce 후 자동 검색 (즉시 미리보기)
  useEffect(() => {
    const handle = setTimeout(() => {
      reset(q);
    }, 250);
    return () => clearTimeout(handle);
  }, [q, reset]);

  async function onRefresh() {
    setRefreshing(true);
    const data = await fetchPage(0, q);
    setItems(data);
    setEnd(data.length < PAGE);
    setRefreshing(false);
  }

  async function loadMore() {
    if (loading || refreshing || end) return;
    setLoading(true);
    const data = await fetchPage(items.length, q);
    setItems((prev) => [...prev, ...data]);
    if (data.length < PAGE) setEnd(true);
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => reset(q)}
          placeholder="이름으로 검색"
          placeholderTextColor="#525252"
          returnKeyType="search"
          autoCorrect={false}
          style={styles.searchInput}
        />
        <Pressable
          onPress={() => router.push("/whiskies/compare" as never)}
          style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.scanBtnText}>⚖</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/(tabs)/whiskies/new" as never)}
          style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.scanBtnText}>+</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/whiskies/scan")}
          style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.scanBtnText}>📷</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/whiskies/${item.id}`)}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
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
            </Text>
          </Pressable>
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fbbf24" />
        }
        ListFooterComponent={
          loading && !refreshing && items.length > 0 ? (
            <ActivityIndicator color="#fbbf24" style={{ marginVertical: 20 }} />
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#fbbf24" style={{ marginTop: 40 }} />
          ) : (
            <Text style={styles.empty}>
              {q ? `"${q}"에 대한 결과가 없어요.` : "보틀링이 없습니다."}
            </Text>
          )
        }
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  searchInput: {
    flex: 1,
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    color: "#fafafa",
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 8, fontSize: 14,
  },
  scanBtn: {
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  scanBtnText: { fontSize: 20 },
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
  empty: { color: "#737373", textAlign: "center", marginTop: 60, fontSize: 14 },
});
