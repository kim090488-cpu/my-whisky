import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { COUNTRY_FLAG, COUNTRY_LABEL } from "@/lib/format";
import type { WhiskyCountry, DistilleryStatus } from "@/types/database";

type Distillery = {
  id: string;
  name: string;
  name_kr: string | null;
  country: WhiskyCountry;
  region: string | null;
  status: DistilleryStatus;
  founded_year: number | null;
};

export default function DistilleriesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Distillery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("distilleries")
        .select("id, name, name_kr, country, region, status, founded_year")
        .order("country")
        .order("region")
        .order("name")
        .limit(500);
      setItems((data ?? []) as Distillery[]);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "증류소" }} />
        <View style={styles.center}><ActivityIndicator color="#fbbf24" /></View>
      </>
    );
  }

  const grouped = new Map<WhiskyCountry, Distillery[]>();
  for (const d of items) {
    const arr = grouped.get(d.country) ?? [];
    arr.push(d);
    grouped.set(d.country, arr);
  }

  return (
    <>
      <Stack.Screen options={{ title: "증류소" }} />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.header}>
          <Text style={styles.h1}>증류소</Text>
          <Text style={styles.lead}>{items.length}곳</Text>
        </View>

        {[...grouped.entries()].map(([country, list]) => (
          <View key={country} style={styles.section}>
            <Text style={styles.sectionTitle}>
              {COUNTRY_FLAG[country]} {COUNTRY_LABEL[country]}{" "}
              <Text style={styles.sectionCount}>({list.length})</Text>
            </Text>
            <View style={{ marginTop: 10, gap: 6 }}>
              {list.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => router.push(`/distilleries/${d.id}`)}
                  style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {d.name_kr ?? d.name}
                    </Text>
                    {d.name_kr && d.name_kr !== d.name && (
                      <Text style={styles.cardSub} numberOfLines={1}>{d.name}</Text>
                    )}
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {d.region ?? "—"}
                      {d.founded_year ? ` · ${d.founded_year}` : ""}
                    </Text>
                  </View>
                  {d.status !== "active" && (
                    <Text style={styles.statusBadge}>
                      {d.status === "closed" ? "폐쇄" :
                       d.status === "silent" ? "침묵" :
                       d.status === "demolished" ? "철거" :
                       d.status === "planned" ? "예정" : d.status}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a" },

  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  h1: { color: "#fafafa", fontSize: 26, fontWeight: "700", letterSpacing: -0.3 },
  lead: { color: "#737373", fontSize: 13, marginTop: 6 },

  section: { marginTop: 22, paddingHorizontal: 16 },
  sectionTitle: { color: "#a3a3a3", fontSize: 13, fontWeight: "600" },
  sectionCount: { color: "#525252", fontWeight: "400" },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 10,
  },
  cardName: { color: "#fafafa", fontSize: 14, fontWeight: "500" },
  cardSub: { color: "#525252", fontSize: 10, marginTop: 2 },
  cardMeta: { color: "#737373", fontSize: 11, marginTop: 4 },
  statusBadge: {
    color: "#a3a3a3",
    fontSize: 10,
    backgroundColor: "#262626",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: "hidden",
  },
});
