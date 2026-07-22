import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { COUNTRY_FLAG, formatAge, formatAbv } from "@/lib/format";
import type { WhiskyCountry } from "@/types/database";

type Bottle = {
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
  avg_value_for_money: number | null;
  buy_again_pct: number | null;
};

const MIN_REBUY = 3;
const MIN_VALUE = 3;
const LIMIT = 8;

const SELECT =
  "id, name, name_kr, age_years, abv, distillery_name, distillery_name_kr, country, region, avg_score, tasting_count, avg_value_for_money, buy_again_pct";

export default function PicksScreen() {
  const [rebuy, setRebuy] = useState<Bottle[]>([]);
  const [beginner, setBeginner] = useState<Bottle[]>([]);
  const [gift, setGift] = useState<Bottle[]>([]);
  const [value, setValue] = useState<Bottle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [r, b, g, v] = await Promise.all([
        supabase
          .from("bottling_card_stats")
          .select(SELECT)
          .gte("tasting_count", MIN_REBUY)
          .not("buy_again_pct", "is", null)
          .order("buy_again_pct", { ascending: false, nullsFirst: false })
          .order("tasting_count", { ascending: false })
          .limit(LIMIT),
        supabase
          .from("bottling_card_stats")
          .select(SELECT + ", beginner_count")
          .gte("beginner_count", 1)
          .order("beginner_count", { ascending: false })
          .order("avg_score", { ascending: false, nullsFirst: false })
          .limit(LIMIT),
        supabase
          .from("bottling_card_stats")
          .select(SELECT + ", gift_count")
          .gte("gift_count", 1)
          .order("gift_count", { ascending: false })
          .order("avg_score", { ascending: false, nullsFirst: false })
          .limit(LIMIT),
        supabase
          .from("bottling_card_stats")
          .select(SELECT)
          .gte("tasting_count", MIN_VALUE)
          .gte("avg_value_for_money", 4)
          .order("avg_value_for_money", { ascending: false, nullsFirst: false })
          .order("tasting_count", { ascending: false })
          .limit(LIMIT),
      ]);
      setRebuy((r.data ?? []) as Bottle[]);
      setBeginner((b.data ?? []) as Bottle[]);
      setGift((g.data ?? []) as Bottle[]);
      setValue((v.data ?? []) as Bottle[]);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "맞춤 추천" }} />
        <View style={styles.center}><ActivityIndicator color="#fbbf24" /></View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "맞춤 추천" }} />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.header}>
          <Text style={styles.h1}>맞춤 추천</Text>
          <Text style={styles.lead}>시나리오별로 골라봤어요. 후기가 모일수록 정확해집니다.</Text>
        </View>

        <Section
          title="다시 사고 싶은 위스키"
          subtitle={`재구매율 기준 · 후기 ${MIN_REBUY}개 이상`}
          bottles={rebuy}
        />
        <Section
          title="처음이라면"
          subtitle="입문자에게 추천한다는 후기가 가장 많이 모인 보틀링"
          bottles={beginner}
        />
        <Section
          title="선물하기 좋은"
          subtitle="선물용으로 추천받은 보틀링"
          bottles={gift}
        />
        <Section
          title="가성비 갑"
          subtitle={`가격 대비 만족도 4점 이상 · 후기 ${MIN_VALUE}개 이상`}
          bottles={value}
        />
      </ScrollView>
    </>
  );
}

function Section({
  title,
  subtitle,
  bottles,
}: {
  title: string;
  subtitle: string;
  bottles: Bottle[];
}) {
  const router = useRouter();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSub}>{subtitle}</Text>
      {bottles.length === 0 ? (
        <Text style={styles.empty}>아직 신호가 모이지 않았어요.</Text>
      ) : (
        <View style={styles.grid}>
          {bottles.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => router.push(`/whiskies/${b.id}`)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.cardDist} numberOfLines={1}>
                {COUNTRY_FLAG[b.country]} {b.distillery_name_kr ?? b.distillery_name}
              </Text>
              <Text style={styles.cardName} numberOfLines={2}>
                {b.name_kr ?? b.name}
              </Text>
              <Text style={styles.cardMeta}>
                {formatAge(b.age_years)} · {formatAbv(b.abv)}
              </Text>
              <View style={styles.cardBottom}>
                {b.avg_score !== null && (
                  <Text style={styles.score}>{b.avg_score}점</Text>
                )}
                {b.buy_again_pct !== null && (
                  <Text style={styles.muted}>재구매 {b.buy_again_pct}%</Text>
                )}
                {b.avg_value_for_money !== null && (
                  <Text style={styles.muted}>가성비 {b.avg_value_for_money}/5</Text>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a" },

  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  h1: { color: "#fafafa", fontSize: 26, fontWeight: "700", letterSpacing: -0.3 },
  lead: { color: "#a3a3a3", fontSize: 13, marginTop: 6 },

  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: { color: "#fafafa", fontSize: 18, fontWeight: "600" },
  sectionSub: { color: "#737373", fontSize: 11, marginTop: 4 },
  empty: { color: "#525252", fontSize: 13, marginTop: 12, padding: 24, textAlign: "center" },

  grid: { marginTop: 12, gap: 10 },
  card: {
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 10,
    padding: 14,
  },
  cardDist: { color: "#a3a3a3", fontSize: 12 },
  cardName: { color: "#fafafa", fontSize: 15, fontWeight: "500", marginTop: 4 },
  cardMeta: { color: "#a3a3a3", fontSize: 12, marginTop: 4 },
  cardBottom: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  score: { color: "#fbbf24", fontSize: 13, fontWeight: "700" },
  muted: { color: "#737373", fontSize: 11 },
});
