import { useEffect, useState } from "react";
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { COUNTRY_FLAG } from "@/lib/format";
import type { WhiskyCountry, TastingVisibility } from "@/types/database";

type Item = {
  id: string;
  tasted_at: string;
  score: number | null;
  notes: string | null;
  user_id: string;
  bottling_id: string;
  visibility: TastingVisibility;
  like_count: number;
  comment_count: number;
  profile?: { username: string; display_name: string | null };
  bottling?: { id: string; name: string; distillery_name: string; country: WhiskyCountry };
};

export default function FeedScreen() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState<"no_session" | "no_follows" | "no_tastings" | null>(null);

  async function load() {
    if (!session) return;
    setLoading(true);
    const { data: follows } = await supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", session.user.id);
    const followeeIds = (follows ?? []).map((f) => f.followee_id);
    if (followeeIds.length === 0) {
      setItems([]); setEmpty("no_follows"); setLoading(false); return;
    }

    const { data: rawT } = await supabase
      .from("tastings")
      .select("id, tasted_at, score, notes, user_id, bottling_id, visibility, like_count, comment_count")
      .in("user_id", followeeIds)
      .order("tasted_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    if (!rawT || rawT.length === 0) {
      setItems([]); setEmpty("no_tastings"); setLoading(false); return;
    }

    const userIds = Array.from(new Set(rawT.map((t) => t.user_id)));
    const bottlingIds = Array.from(new Set(rawT.map((t) => t.bottling_id)));
    const [profsRes, btsRes] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name").in("id", userIds),
      supabase
        .from("bottling_card_stats")
        .select("id, name, distillery_name, country")
        .in("id", bottlingIds),
    ]);
    const profilesById = new Map((profsRes.data ?? []).map((p) => [p.id, p]));
    const bottlingsById = new Map((btsRes.data ?? []).map((b) => [b.id, b]));

    const enriched: Item[] = rawT.map((t) => ({
      ...(t as Omit<Item, "profile" | "bottling">),
      profile: profilesById.get(t.user_id),
      bottling: bottlingsById.get(t.bottling_id),
    }));
    setItems(enriched);
    setEmpty(null);
    setLoading(false);
  }

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      setEmpty("no_session"); setLoading(false); return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, sessionLoading]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#fbbf24" /></View>;
  }

  if (empty === "no_session") {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>로그인 후 피드를 볼 수 있어요.</Text>
      </View>
    );
  }
  if (empty === "no_follows") {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>아직 팔로우한 사람이 없어요.</Text>
        <Text style={styles.subMuted}>
          노트에서 작성자를 탭하면 프로필로 이동해서 팔로우할 수 있어요.
        </Text>
      </View>
    );
  }
  if (empty === "no_tastings") {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>팔로우한 사용자들이 아직 노트를 작성하지 않았어요.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: "#0a0a0a" }}
      data={items}
      keyExtractor={(i) => i.id}
      contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 24 }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/tastings/${item.id}`)}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.cardHeader}>
            <Pressable
              onPress={() => item.profile?.username && router.push(`/profile/${item.profile.username}`)}
              hitSlop={6}
            >
              <Text style={styles.author}>
                {item.profile?.display_name ?? item.profile?.username ?? "익명"}
              </Text>
            </Pressable>
            <Text style={styles.date}>
              {item.tasted_at}
              {item.visibility === "followers" && "  · 팔로워만"}
            </Text>
          </View>
          {item.bottling && (
            <Text style={styles.bottling}>
              {COUNTRY_FLAG[item.bottling.country]} {item.bottling.distillery_name}
              {"  ·  "}
              <Text style={styles.bottlingName}>{item.bottling.name}</Text>
            </Text>
          )}
          {item.score !== null && <Text style={styles.score}>{item.score}점</Text>}
          {item.notes && (
            <Text style={styles.notes} numberOfLines={4}>{item.notes}</Text>
          )}
          <Text style={styles.footer}>
            ♡ {item.like_count} · 💬 {item.comment_count}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a", padding: 24, gap: 8 },
  muted: { color: "#a3a3a3", textAlign: "center", fontSize: 14 },
  subMuted: { color: "#737373", textAlign: "center", fontSize: 12 },

  card: { backgroundColor: "#171717", borderWidth: 1, borderColor: "#262626", borderRadius: 10, padding: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  author: { color: "#fde68a", fontSize: 13, fontWeight: "600" },
  date: { color: "#737373", fontSize: 11 },
  bottling: { color: "#a3a3a3", fontSize: 12, marginTop: 6 },
  bottlingName: { color: "#fafafa", fontWeight: "500" },
  score: { color: "#fbbf24", fontSize: 14, fontWeight: "600", marginTop: 6 },
  notes: { color: "#d4d4d4", fontSize: 13, marginTop: 6, lineHeight: 18 },
  footer: { color: "#525252", fontSize: 11, marginTop: 10 },
});
