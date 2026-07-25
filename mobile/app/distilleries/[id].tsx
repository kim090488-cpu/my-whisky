import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, Linking,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import {
  COUNTRY_FLAG, COUNTRY_LABEL, CASK_LABEL, formatAge, formatAbv, formatPrice,
} from "@/lib/format";
import { isValidUuid } from "@/lib/params";
import type { WhiskyCountry, DistilleryStatus, CaskType } from "@/types/database";

type Distillery = {
  id: string;
  name: string;
  name_kr: string | null;
  country: WhiskyCountry;
  region: string | null;
  status: DistilleryStatus;
  founded_year: number | null;
  closed_year: number | null;
  website: string | null;
  description: string | null;
  whiskyhunter_slug: string | null;
};

type Bottling = {
  id: string;
  name: string;
  name_kr: string | null;
  age_years: number | null;
  abv: number | null;
  cask_type: CaskType | null;
};

type AuctionStat = {
  dt: string;
  winning_bid_mean: number | null;
  winning_bid_min: number | null;
  winning_bid_max: number | null;
  lots_count: number | null;
};

export default function DistilleryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<Distillery | null>(null);
  const [bottlings, setBottlings] = useState<Bottling[]>([]);
  const [auction, setAuction] = useState<AuctionStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    if (!isValidUuid(id)) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: dist } = await supabase
        .from("distilleries")
        .select("id, name, name_kr, country, region, status, founded_year, closed_year, website, description, whiskyhunter_slug")
        .eq("id", id)
        .maybeSingle();
      setD((dist ?? null) as Distillery | null);

      const [bRes, aRes] = await Promise.all([
        supabase
          .from("bottlings")
          .select("id, name, name_kr, age_years, abv, cask_type")
          .eq("distillery_id", id)
          .order("age_years", { ascending: true, nullsFirst: false })
          .order("name"),
        supabase
          .from("distillery_auction_stats")
          .select("dt, winning_bid_mean, winning_bid_min, winning_bid_max, lots_count")
          .eq("distillery_id", id)
          .eq("source", "whiskyhunter")
          .order("dt", { ascending: false })
          .limit(12),
      ]);
      setBottlings((bRes.data ?? []) as Bottling[]);
      setAuction((aRes.data ?? []) as AuctionStat[]);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "" }} />
        <View style={styles.center}><ActivityIndicator color="#fbbf24" /></View>
      </>
    );
  }
  if (!d) {
    return (
      <>
        <Stack.Screen options={{ title: "" }} />
        <View style={styles.center}>
          <Text style={styles.muted}>증류소를 찾을 수 없어요.</Text>
        </View>
      </>
    );
  }

  const latest = auction[0];

  return (
    <>
      <Stack.Screen options={{ title: d.name_kr ?? d.name }} />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.header}>
          <Text style={styles.country}>
            {COUNTRY_FLAG[d.country]} {COUNTRY_LABEL[d.country]}
            {d.region ? ` · ${d.region}` : ""}
          </Text>
          <Text style={styles.title}>{d.name_kr ?? d.name}</Text>
          {d.name_kr && <Text style={styles.subtitle}>{d.name}</Text>}

          <View style={styles.metaRow}>
            <Meta label="설립" value={d.founded_year?.toString() ?? "—"} />
            <Meta
              label="상태"
              value={
                d.status === "active" ? "가동 중" :
                d.status === "silent" ? "침묵" :
                d.status === "closed" ? `폐쇄${d.closed_year ? ` (${d.closed_year})` : ""}` :
                d.status === "demolished" ? "철거" :
                d.status === "planned" ? "예정" : d.status
              }
            />
            {d.website && /^https?:\/\//i.test(d.website) && (
              <Pressable onPress={() => Linking.openURL(d.website!)} style={styles.metaBox}>
                <Text style={styles.metaLabel}>웹사이트</Text>
                <Text style={styles.metaLink}>↗ 열기</Text>
              </Pressable>
            )}
          </View>

          {d.description && (
            <Text style={styles.desc}>{d.description}</Text>
          )}
        </View>

        {/* 옥션 시세 */}
        {auction.length > 0 && latest && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>옥션 시세 <Text style={styles.sectionHint}>· whiskyhunter</Text></Text>
            <View style={styles.auctionCard}>
              <Text style={styles.auctionDate}>{latest.dt}</Text>
              {latest.winning_bid_mean !== null && (
                <Text style={styles.auctionMain}>평균 {formatPrice(latest.winning_bid_mean)}</Text>
              )}
              <View style={styles.auctionRow}>
                {latest.winning_bid_min !== null && (
                  <Text style={styles.auctionMeta}>최저 {formatPrice(latest.winning_bid_min)}</Text>
                )}
                {latest.winning_bid_max !== null && (
                  <Text style={styles.auctionMeta}>최고 {formatPrice(latest.winning_bid_max)}</Text>
                )}
                {latest.lots_count !== null && (
                  <Text style={styles.auctionMeta}>{latest.lots_count}건</Text>
                )}
              </View>
              {auction.length > 1 && (
                <Text style={styles.auctionHistory}>최근 {auction.length}개월 데이터</Text>
              )}
            </View>
          </View>
        )}

        {/* 보틀링 목록 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            보틀링 <Text style={styles.sectionHint}>({bottlings.length})</Text>
          </Text>
          {bottlings.length === 0 ? (
            <Text style={styles.empty}>등록된 보틀링이 없습니다.</Text>
          ) : (
            <View style={{ marginTop: 10, gap: 6 }}>
              {bottlings.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => router.push(`/whiskies/${b.id}`)}
                  style={({ pressed }) => [styles.bottlingCard, pressed && { opacity: 0.7 }]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.bottlingName} numberOfLines={2}>
                      {b.name_kr ?? b.name}
                    </Text>
                    <Text style={styles.bottlingMeta} numberOfLines={1}>
                      {formatAge(b.age_years)} · {formatAbv(b.abv)}
                      {b.cask_type ? ` · ${CASK_LABEL[b.cask_type]}` : ""}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaBox}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a" },
  muted: { color: "#737373" },

  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  country: { color: "#a3a3a3", fontSize: 13 },
  title: { color: "#fafafa", fontSize: 26, fontWeight: "700", letterSpacing: -0.3, marginTop: 4 },
  subtitle: { color: "#737373", fontSize: 13, marginTop: 2 },
  desc: { color: "#d4d4d4", fontSize: 13, lineHeight: 19, marginTop: 16 },

  metaRow: { flexDirection: "row", gap: 8, marginTop: 16, flexWrap: "wrap" },
  metaBox: {
    flex: 1,
    minWidth: 90,
    padding: 10,
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 8,
  },
  metaLabel: {
    color: "#737373",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: { color: "#fafafa", fontSize: 13, marginTop: 3, fontWeight: "500" },
  metaLink: { color: "#fbbf24", fontSize: 13, marginTop: 3, fontWeight: "500" },

  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: { color: "#fafafa", fontSize: 17, fontWeight: "600" },
  sectionHint: { color: "#737373", fontSize: 12, fontWeight: "400" },

  auctionCard: {
    marginTop: 10,
    padding: 14,
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 10,
  },
  auctionDate: { color: "#737373", fontSize: 11 },
  auctionMain: { color: "#fbbf24", fontSize: 20, fontWeight: "700", marginTop: 4 },
  auctionRow: { flexDirection: "row", gap: 12, marginTop: 8, flexWrap: "wrap" },
  auctionMeta: { color: "#a3a3a3", fontSize: 12 },
  auctionHistory: { color: "#525252", fontSize: 10, marginTop: 10 },

  empty: { color: "#737373", textAlign: "center", padding: 24, fontSize: 13, marginTop: 10 },

  bottlingCard: {
    padding: 12,
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 10,
  },
  bottlingName: { color: "#fafafa", fontSize: 14, fontWeight: "500" },
  bottlingMeta: { color: "#737373", fontSize: 12, marginTop: 4 },
});
