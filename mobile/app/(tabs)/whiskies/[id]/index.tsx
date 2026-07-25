import { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, Image,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import {
  COUNTRY_FLAG, CASK_LABEL, BOTTLER_LABEL, formatAge, formatAbv,
} from "@/lib/format";
import { tastingPhotoUrl } from "@/lib/uploads";
import type {
  WhiskyCountry, CaskType, BottlerKind, TastingVisibility,
} from "@/types/database";
import { useSession } from "@/lib/auth-context";
import { FlavorProfile, type FlavorProfileData } from "./_flavor-profile";
import { loadBottlingFans, type BottlingFan } from "@/lib/social/bottling-fans";
import { BottlingFansSection } from "@/components/social/bottling-fans-section";
import { TastingCard } from "@/components/social/tasting-card";

type Bottling = {
  id: string;
  name: string;
  age_years: number | null;
  abv: number | null;
  vintage_year: number | null;
  bottling_year: number | null;
  cask_type: CaskType | null;
  bottler: BottlerKind;
  bottler_name: string | null;
  bottle_size_ml: number | null;
  total_bottles: number | null;
  notes: string | null;
  distillery: {
    id: string;
    name: string;
    country: WhiskyCountry;
    region: string | null;
  } | null;
};

type Tasting = {
  id: string;
  tasted_at: string;
  score: number | null;
  notes: string | null;
  visibility: TastingVisibility;
  user_id: string;
  like_count: number;
  comment_count: number;
  photos: string[] | null;
  profile: { username: string; display_name: string | null } | null;
};

export default function BottlingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();
  const [b, setB] = useState<Bottling | null>(null);
  const [tastings, setTastings] = useState<Tasting[]>([]);
  const [verdict, setVerdict] = useState<(FlavorProfileData & { total_reviews: number }) | null>(null);
  const [fans, setFans] = useState<BottlingFan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

      const { data: bottling } = await supabase
        .from("bottlings")
        .select(
          `id, name, age_years, abv, vintage_year, bottling_year,
           cask_type, bottler, bottler_name, bottle_size_ml, total_bottles, notes,
           distillery:distilleries(id, name, country, region)`,
        )
        .eq("id", id)
        .maybeSingle();

      if (bottling) {
        const d = Array.isArray(bottling.distillery)
          ? bottling.distillery[0]
          : bottling.distillery;
        setB({ ...bottling, distillery: d ?? null } as Bottling);
      } else {
        setB(null);
      }

      const { data: rawT } = await supabase
        .from("tastings")
        .select(
          "id, tasted_at, score, notes, visibility, user_id, like_count, comment_count, photos, created_at, updated_at",
        )
        .eq("bottling_id", id)
        .order("tasted_at", { ascending: false })
        .limit(30);

      const { data: verdictRaw } = await supabase
        .from("bottling_verdict_stats")
        .select(
          "total_reviews, avg_sweetness, avg_smokiness, avg_fruitiness, avg_spiciness, avg_smoothness, avg_complexity, avg_finish_length",
        )
        .eq("bottling_id", id)
        .maybeSingle();
      setVerdict(
        verdictRaw
          ? (verdictRaw as unknown as FlavorProfileData & { total_reviews: number })
          : null,
      );

      const userIds = Array.from(new Set((rawT ?? []).map((t) => t.user_id)));
      const profilesById = new Map<string, { username: string; display_name: string | null }>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, display_name")
          .in("id", userIds);
        for (const p of profs ?? []) profilesById.set(p.id, p);
      }
      const ts: Tasting[] = (rawT ?? []).map((t) => ({
        ...(t as Omit<Tasting, "profile">),
        profile: profilesById.get(t.user_id) ?? null,
      }));
      setTastings(ts);

      const fansData = await loadBottlingFans(supabase, id, {
        excludeUserId: session?.user.id ?? null,
      });
      setFans(fansData);

      setLoading(false);
  }, [id, session]);

  // 화면 focus 될 때마다 갱신 — 노트 작성 후 router.back() 으로 돌아오면 자동 refresh
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fbbf24" />
      </View>
    );
  }
  if (!b) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>보틀링을 찾을 수 없어요.</Text>
      </View>
    );
  }

  const d = b.distillery;
  const scored = tastings.filter((t) => t.score !== null);
  const avg =
    scored.length > 0
      ? Math.round((scored.reduce((s, t) => s + (t.score as number), 0) / scored.length) * 10) / 10
      : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ title: d?.name ?? "" }} />

      <View style={styles.header}>
        {d && (
          <Text style={styles.distLine}>
            {COUNTRY_FLAG[d.country]} {d.name}
            {d.region ? ` · ${d.region}` : ""}
          </Text>
        )}
        <Text style={styles.bottlingName}>{b.name}</Text>
        {avg !== null && (
          <View style={styles.scoreRow}>
            <Text style={styles.scoreBig}>{avg}</Text>
            <Text style={styles.scoreLabel}>
              {" "}/ 100 · {scored.length}개 노트
            </Text>
          </View>
        )}
      </View>

      <View style={styles.statsGrid}>
        <Stat label="숙성" value={formatAge(b.age_years)} />
        <Stat label="ABV" value={formatAbv(b.abv)} />
        <Stat label="캐스크" value={b.cask_type ? CASK_LABEL[b.cask_type] : "—"} />
        <Stat
          label="병입자"
          value={BOTTLER_LABEL[b.bottler] + (b.bottler_name ? ` · ${b.bottler_name}` : "")}
        />
        {b.vintage_year != null && <Stat label="빈티지" value={String(b.vintage_year)} />}
        {b.bottling_year != null && <Stat label="병입연도" value={String(b.bottling_year)} />}
        {b.bottle_size_ml != null && <Stat label="용량" value={`${b.bottle_size_ml}ml`} />}
        {b.total_bottles != null && <Stat label="총 병수" value={`${b.total_bottles}병`} />}
      </View>

      {b.notes && <Text style={styles.bottlingNotes}>{b.notes}</Text>}

      {verdict && verdict.total_reviews > 0 && <FlavorProfile data={verdict} />}

      <BottlingFansSection fans={fans} />

      <View style={styles.tastingsHeader}>
        <Text style={styles.sectionTitle}>테이스팅 노트</Text>
        {session ? (
          <Pressable
            onPress={() => router.push(`/whiskies/${id}/new-tasting`)}
            style={({ pressed }) => [styles.writeButton, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.writeButtonText}>+ 노트 작성</Text>
          </Pressable>
        ) : null}
      </View>

      {tastings.length === 0 ? (
        <Text style={styles.empty}>아직 공개 노트가 없어요.</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {tastings.map((t) => (
            <TastingCard
              key={t.id}
              tasting={t}
              currentUserId={session?.user.id ?? null}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a" },
  muted: { color: "#737373", fontSize: 14 },

  header: { padding: 16, paddingTop: 12 },
  distLine: { color: "#a3a3a3", fontSize: 13 },
  bottlingName: { color: "#fafafa", fontSize: 24, fontWeight: "700", marginTop: 4, letterSpacing: -0.3 },
  scoreRow: { flexDirection: "row", alignItems: "baseline", marginTop: 10 },
  scoreBig: { color: "#fbbf24", fontSize: 32, fontWeight: "700" },
  scoreLabel: { color: "#737373", fontSize: 12 },

  statsGrid: {
    flexDirection: "row", flexWrap: "wrap",
    gap: 8, paddingHorizontal: 16, marginTop: 8,
  },
  statBox: {
    width: "47%",
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 8,
    padding: 10,
  },
  statLabel: { color: "#737373", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { color: "#fafafa", fontSize: 14, marginTop: 3 },

  bottlingNotes: { color: "#d4d4d4", fontSize: 13, padding: 16, lineHeight: 20 },

  tastingsHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 24, paddingBottom: 12,
    borderTopWidth: 1, borderTopColor: "#171717", marginTop: 8,
  },
  sectionTitle: { color: "#fafafa", fontSize: 16, fontWeight: "600" },
  writeButton: {
    backgroundColor: "#fbbf24",
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 6,
  },
  writeButtonText: { color: "#0a0a0a", fontWeight: "600", fontSize: 13 },

  empty: { color: "#737373", textAlign: "center", padding: 40, fontSize: 13 },

  tastingCard: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 10,
    padding: 12,
  },
  tastingTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  tastingAuthor: { color: "#d4d4d4", fontSize: 12 },
  tastingAuthorName: { color: "#fde68a" },
  tastingDate: { color: "#737373" },
  myNoteBadge: { color: "#fde68a", fontSize: 11 },
  visibilityBadge: { color: "#737373", fontSize: 11 },
  tastingScore: { color: "#fbbf24", fontWeight: "600", fontSize: 14 },
  tastingNotes: { marginTop: 8, gap: 3 },
  noteLine: { color: "#d4d4d4", fontSize: 13, lineHeight: 18 },
  noteLabel: { color: "#737373" },
  tastingOverall: { color: "#e5e5e5", marginTop: 8, fontSize: 13, lineHeight: 18 },
  tastingFooter: { color: "#525252", fontSize: 11, marginTop: 8 },
  tastingFooterHint: { color: "#fbbf24" },
  photoStrip: { marginTop: 8 },
  tastingPhoto: {
    width: 100, height: 100, borderRadius: 6, marginRight: 8,
    backgroundColor: "#0a0a0a",
  },
});
