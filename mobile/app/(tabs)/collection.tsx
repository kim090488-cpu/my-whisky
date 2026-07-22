import { useEffect, useState } from "react";
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  COLLECTION_LABEL, COUNTRY_FLAG, formatAge, formatAbv,
} from "@/lib/format";
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

export default function CollectionScreen() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<CollectionStatus | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading || !session) return;
    (async () => {
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
        return {
          ...it,
          bottling: b ? { ...b, distillery: d ?? null } : null,
        };
      });
      setItems(mapped as Item[]);
      setLoading(false);
    })();
  }, [session, sessionLoading, status]);

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

  return (
    <View style={styles.container}>
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

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#fbbf24" /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>
            {status === "all" ? "컬렉션이 비어있어요." : "이 상태의 항목이 없어요."}
          </Text>
          <Pressable onPress={() => router.push("/whiskies")}>
            <Text style={styles.link}>카탈로그에서 추가하기 →</Text>
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
  link: { color: "#fbbf24", marginTop: 8, fontSize: 13 },

  tabRow: { flexDirection: "row", gap: 6, padding: 12 },
  tab: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: "#262626", backgroundColor: "#171717" },
  tabActive: { borderColor: "#fbbf24", backgroundColor: "rgba(251, 191, 36, 0.1)" },
  tabText: { color: "#a3a3a3", fontSize: 12 },
  tabTextActive: { color: "#fde68a", fontWeight: "600" },

  card: { backgroundColor: "#171717", borderWidth: 1, borderColor: "#262626", borderRadius: 10, padding: 14 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBadge: {
    color: "#fde68a", fontSize: 11,
    backgroundColor: "rgba(180, 83, 9, 0.2)",
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
    overflow: "hidden",
  },
  price: { color: "#a3a3a3", fontSize: 12 },
  cardDist: { color: "#a3a3a3", fontSize: 12, marginTop: 6 },
  cardName: { color: "#fafafa", fontSize: 15, fontWeight: "500", marginTop: 2 },
  cardMeta: { color: "#a3a3a3", fontSize: 12, marginTop: 4 },
});
