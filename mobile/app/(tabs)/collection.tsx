import { useCallback, useEffect, useState } from "react";
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Alert,
  BackHandler,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  COLLECTION_LABEL, COUNTRY_FLAG, formatAge, formatAbv,
} from "@/lib/format";
import { BottlingSearchPicker, type PickedBottling } from "@/components/whisky/bottling-search-picker";
import type { CollectionStatus, WhiskyCountry } from "@/types/database";

type Item = {
  id: string;
  status: CollectionStatus;
  purchase_price: number | null;
  bottling: {
    id: string;
    name: string;
    age_years: number | null;
    abv: number | null;
    distillery: { name: string; country: WhiskyCountry; region: string | null } | null;
  } | null;
};

const TABS: (CollectionStatus | "all")[] = ["all", "owned", "opened", "finished", "wishlist"];

const STATUS_OPTIONS: { v: CollectionStatus; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { v: "wishlist", label: "위시리스트", icon: "bookmark-outline" },
  { v: "owned",    label: "소장",       icon: "cube-outline" },
  { v: "opened",   label: "오픈됨",     icon: "wine-outline" },
  { v: "finished", label: "비움",       icon: "checkmark-done-outline" },
];

export default function CollectionScreen() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<CollectionStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingBottling, setPendingBottling] = useState<PickedBottling | null>(null);
  const [saving, setSaving] = useState<CollectionStatus | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    let q = supabase
      .from("collection_items")
      .select(`
        id, status, purchase_price,
        bottling:bottlings(
          id, name, age_years, abv,
          distillery:distilleries(name, country, region)
        )
      `)
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    if (status !== "all") q = q.eq("status", status);
    const { data } = await q;
    const mapped = (data ?? []).map((it) => {
      const b = Array.isArray(it.bottling) ? it.bottling[0] : it.bottling;
      const d = b && (Array.isArray(b.distillery) ? b.distillery[0] : b.distillery);
      return { ...it, bottling: b ? { ...b, distillery: d ?? null } : null };
    });
    setItems(mapped as Item[]);
    setLoading(false);
  }, [session, status]);

  useEffect(() => {
    if (sessionLoading || !session) return;
    void load();
  }, [session, sessionLoading, load]);

  // 안드로이드 하드웨어 뒤로가기: picker/상태선택 중이면 그 단계만 닫기 (홈 탭으로 튀지 않게)
  useEffect(() => {
    const onBack = () => {
      if (pendingBottling) { setPendingBottling(null); return true; }
      if (pickerOpen) { setPickerOpen(false); return true; }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [pickerOpen, pendingBottling]);

  async function saveWithStatus(next: CollectionStatus) {
    if (!session || !pendingBottling || saving) return;
    setSaving(next);
    const { error } = await supabase
      .from("collection_items")
      .upsert(
        { user_id: session.user.id, bottling_id: pendingBottling.id, status: next },
        { onConflict: "user_id,bottling_id" },
      );
    setSaving(null);
    if (error) return Alert.alert("저장 실패", error.message);
    setPendingBottling(null);
    await load();
  }

  if (sessionLoading) {
    return <View style={styles.center}><ActivityIndicator color="#fbbf24" /></View>;
  }
  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>로그인 후 이용 가능합니다.</Text>
      </View>
    );
  }

  // Step 1: 위스키 검색 picker
  if (pickerOpen) {
    return (
      <BottlingSearchPicker
        onSelect={(b) => { setPickerOpen(false); setPendingBottling(b); }}
        onCancel={() => setPickerOpen(false)}
      />
    );
  }

  // Step 2: 상태 선택
  if (pendingBottling) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateLead}>어떤 상태로 등록할까요?</Text>
        <View style={styles.stateBottlingCard}>
          <Text style={styles.stateBottlingName} numberOfLines={2}>
            {pendingBottling.name_kr ?? pendingBottling.name}
          </Text>
          <Text style={styles.stateBottlingSub} numberOfLines={1}>
            {COUNTRY_FLAG[pendingBottling.country]}{" "}
            {(pendingBottling.distillery_name_kr ?? pendingBottling.distillery_name) || "—"}
          </Text>
        </View>
        <View style={styles.stateGrid}>
          {STATUS_OPTIONS.map((s) => (
            <Pressable
              key={s.v}
              onPress={() => saveWithStatus(s.v)}
              disabled={!!saving}
              style={({ pressed }) => [
                styles.stateBtn,
                pressed && { opacity: 0.7 },
                saving === s.v && { opacity: 0.5 },
              ]}
            >
              <Ionicons name={s.icon} size={22} color="#fbbf24" />
              <Text style={styles.stateBtnText}>
                {saving === s.v ? "저장 중…" : s.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => setPendingBottling(null)} style={styles.stateCancel}>
          <Text style={styles.stateCancelText}>취소</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.tabRow}>
          {TABS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setStatus(s)}
              style={({ pressed }) => [
                styles.tab,
                status === s && styles.tabActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.tabText, status === s && styles.tabTextActive]}>
                {s === "all" ? "전체" : COLLECTION_LABEL[s]}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="add" size={18} color="#0a0a0a" />
          <Text style={styles.addBtnText}>추가</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#fbbf24" /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bookmark-outline" size={40} color="#525252" />
          <Text style={styles.muted}>
            {status === "all" ? "컬렉션이 비어있어요." : "이 상태의 항목이 없어요."}
          </Text>
          <Pressable onPress={() => setPickerOpen(true)}>
            <Text style={styles.link}>+ 위스키 추가하기</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => item.bottling && router.push(`/whiskies/${item.bottling.id}`)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.statusBadge}>{COLLECTION_LABEL[item.status]}</Text>
                {item.purchase_price != null && (
                  <Text style={styles.price}>
                    {Math.round(Number(item.purchase_price)).toLocaleString()}원
                  </Text>
                )}
              </View>
              {item.bottling && (
                <>
                  {item.bottling.distillery && (
                    <Text style={styles.cardDist}>
                      {COUNTRY_FLAG[item.bottling.distillery.country]} {item.bottling.distillery.name}
                    </Text>
                  )}
                  <Text style={styles.cardName}>{item.bottling.name}</Text>
                  <Text style={styles.cardMeta}>
                    {formatAge(item.bottling.age_years)} · {formatAbv(item.bottling.abv)}
                  </Text>
                </>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a", padding: 24, gap: 12 },
  muted: { color: "#737373", textAlign: "center", fontSize: 14 },
  link: { color: "#fbbf24", marginTop: 8, fontSize: 13, fontWeight: "600" },

  headerRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4,
  },
  tabRow: { flexDirection: "row", gap: 6, flex: 1, flexWrap: "wrap" },
  tab: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: "#262626", backgroundColor: "#171717" },
  tabActive: { borderColor: "#fbbf24", backgroundColor: "rgba(251, 191, 36, 0.1)" },
  tabText: { color: "#a3a3a3", fontSize: 11 },
  tabTextActive: { color: "#fbbf24", fontWeight: "600" },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#fbbf24",
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  addBtnText: { color: "#0a0a0a", fontSize: 12, fontWeight: "700" },

  card: {
    backgroundColor: "#171717", borderWidth: 1, borderColor: "#262626",
    borderRadius: 10, padding: 12,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBadge: { color: "#fbbf24", fontSize: 11, fontWeight: "600" },
  price: { color: "#a3a3a3", fontSize: 11 },
  cardDist: { color: "#a3a3a3", fontSize: 11, marginTop: 6 },
  cardName: { color: "#fafafa", fontSize: 14, fontWeight: "500", marginTop: 2 },
  cardMeta: { color: "#737373", fontSize: 11, marginTop: 2 },

  // Step 2: 상태 선택
  stateContainer: { flex: 1, backgroundColor: "#0a0a0a", padding: 20, paddingTop: 40 },
  stateLead: { color: "#a3a3a3", fontSize: 13, textAlign: "center", marginBottom: 20 },
  stateBottlingCard: {
    backgroundColor: "#111",
    borderWidth: 1, borderColor: "#262626", borderRadius: 12,
    padding: 16, marginBottom: 20,
    alignItems: "center",
  },
  stateBottlingName: { color: "#fafafa", fontSize: 17, fontWeight: "700", textAlign: "center" },
  stateBottlingSub: { color: "#a3a3a3", fontSize: 12, marginTop: 4, textAlign: "center" },
  stateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stateBtn: {
    flexBasis: "48%", flexGrow: 1,
    paddingVertical: 22, borderRadius: 12,
    backgroundColor: "#111", borderWidth: 1, borderColor: "rgba(251,191,36,0.35)",
    alignItems: "center", justifyContent: "center", gap: 6,
  },
  stateBtnText: { color: "#fbbf24", fontSize: 14, fontWeight: "600" },
  stateCancel: { marginTop: 20, alignItems: "center", paddingVertical: 12 },
  stateCancelText: { color: "#737373", fontSize: 13 },
});
