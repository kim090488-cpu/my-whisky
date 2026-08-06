import { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, Image,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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
import { CollectionPicker } from "@/components/whisky/collection-picker";

type BarcodeSource = "manufacturer" | "importer" | "retailer" | "unknown";
const SOURCE_LABEL: Record<BarcodeSource, string> = {
  manufacturer: "제조사",
  importer: "수입 스티커",
  retailer: "유통사",
  unknown: "종류 미지정",
};

type Barcode = { id: string; barcode: string; source: BarcodeSource };

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
  const [barcodes, setBarcodes] = useState<Barcode[]>([]);
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
        const bt = bottling as unknown as Omit<Bottling, "distillery"> & { distillery: Bottling["distillery"] | Bottling["distillery"][] };
        const d = Array.isArray(bt.distillery) ? bt.distillery[0] : bt.distillery;
        setB({ ...bt, distillery: d ?? null } as Bottling);
      } else {
        setB(null);
      }

      const { data: barcodeRows } = await supabase
        .from("bottling_barcodes")
        .select("id, barcode, source")
        .eq("bottling_id", id)
        .order("created_at", { ascending: true });
      setBarcodes((barcodeRows as unknown as Barcode[]) ?? []);

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
      <Stack.Screen
        options={{
          title: d?.name ?? "",
          // 뒤로가기 항상 노출 (외부 route에서 진입 시에도)
          headerLeft: () => (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/whiskies" as never))}
              hitSlop={8}
              style={{ paddingLeft: 8, paddingRight: 4 }}
            >
              <Ionicons name="chevron-back" size={26} color="#fafafa" />
            </Pressable>
          ),
        }}
      />

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

      <CollectionPicker bottlingId={b.id} />

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

      {barcodes.length > 0 && (
        <View style={styles.barcodesSection}>
          <Text style={styles.barcodesTitle}>바코드 📷</Text>
          <View style={styles.barcodesList}>
            {barcodes.map((bc) => (
              <View key={bc.id} style={styles.barcodeChip}>
                <Text style={styles.barcodeChipSource}>{SOURCE_LABEL[bc.source]}</Text>
                <Text style={styles.barcodeChipCode}>{bc.barcode}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {b.notes && <Text style={styles.bottlingNotes}>{b.notes}</Text>}

      <View style={styles.editLinkGroup}>
        {session && (
          <Pressable
            onPress={() => router.push(`/(tabs)/whiskies/${b.id}/edit` as never)}
            style={({ pressed }) => [styles.editLinkRow, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.editLinkText}>정보 수정 (누구나 편집 가능)</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => router.push(`/(tabs)/whiskies/${b.id}/history` as never)}
          style={({ pressed }) => [styles.editLinkRow, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.editLinkText}>수정 이력 · 추천</Text>
        </Pressable>
      </View>

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

  barcodesSection: { paddingHorizontal: 16, paddingTop: 14, gap: 8 },
  barcodesTitle: { color: "#a3a3a3", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  barcodesList: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  barcodeChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(251, 191, 36, 0.08)",
    borderWidth: 1, borderColor: "rgba(251, 191, 36, 0.35)",
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  barcodeChipSource: {
    color: "#a3a3a3", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5,
  },
  barcodeChipCode: { color: "#fbbf24", fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },

  tastingsHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 24, paddingBottom: 12,
    borderTopWidth: 1, borderTopColor: "#171717", marginTop: 8,
  },
  sectionTitle: { color: "#fafafa", fontSize: 16, fontWeight: "600" },
  editLinkGroup: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 4 },
  editLinkRow: { paddingHorizontal: 8, paddingVertical: 8 },
  editLinkText: { color: "#a3a3a3", fontSize: 12, fontStyle: "italic" },
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
