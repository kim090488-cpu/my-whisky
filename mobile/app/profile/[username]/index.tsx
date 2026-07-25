import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, Image,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { COUNTRY_FLAG, formatScore } from "@/lib/format";
import { tastingPhotoUrl } from "@/lib/uploads";
import { isValidUsername } from "@/lib/params";
import type { WhiskyCountry, TastingVisibility } from "@/types/database";
import {
  loadTasteDashboard,
  type TasteDashboard,
} from "@/lib/tastings/taste-profile";
import { TasteDashboardCard } from "@/components/social/taste-dashboard-card";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  follower_count: number;
  following_count: number;
  created_at: string;
};

type Tasting = {
  id: string;
  tasted_at: string;
  score: number | null;
  notes: string | null;
  visibility: TastingVisibility;
  bottling_id: string;
  photos: string[] | null;
  bottling?: { id: string; name: string; distillery_name: string; country: WhiskyCountry };
};

export default function PublicProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { session } = useSession();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [tastings, setTastings] = useState<Tasting[]>([]);
  const [dashboard, setDashboard] = useState<TasteDashboard | null>(null);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followPending, setFollowPending] = useState(false);

  const isSelf = session && profile && session.user.id === profile.id;

  useEffect(() => {
    if (!username) return;
    if (!isValidUsername(username)) {
      setProfile(null);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url, follower_count, following_count, created_at")
        .eq("username", username.toLowerCase())
        .maybeSingle();
      if (!p) { setProfile(null); setLoading(false); return; }
      setProfile(p);

      // 노트
      let tQuery = supabase
        .from("tastings")
        .select("id, tasted_at, score, notes, visibility, bottling_id, photos")
        .eq("user_id", p.id)
        .order("tasted_at", { ascending: false })
        .limit(30);
      if (!session || session.user.id !== p.id) {
        tQuery = tQuery.eq("visibility", "public");
      }
      const { data: rawT } = await tQuery;

      const bottlingIds = Array.from(new Set((rawT ?? []).map((t) => t.bottling_id)));
      const bottlingsById = new Map<string, Tasting["bottling"]>();
      if (bottlingIds.length > 0) {
        const { data: bts } = await supabase
          .from("bottling_card_stats")
          .select("id, name, distillery_name, country")
          .in("id", bottlingIds);
        for (const b of bts ?? []) bottlingsById.set(b.id, b);
      }
      setTastings(
        (rawT ?? []).map((t) => ({
          ...(t as Omit<Tasting, "bottling">),
          bottling: bottlingsById.get(t.bottling_id),
        })),
      );

      // 팔로우 여부
      if (session && session.user.id !== p.id) {
        const { data: fol } = await supabase
          .from("follows")
          .select("id")
          .eq("follower_id", session.user.id)
          .eq("followee_id", p.id)
          .maybeSingle();
        setFollowing(!!fol);
      }

      // 취향 대시보드 (자기 자신은 private 포함)
      const dash = await loadTasteDashboard(supabase, p.id, {
        publicOnly: !session || session.user.id !== p.id,
      });
      setDashboard(dash);

      setLoading(false);
    })();
  }, [username, session]);

  async function toggleFollow() {
    if (!session || !profile) return;
    setFollowPending(true);
    const prev = following;
    setFollowing(!prev);
    if (prev) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", session.user.id)
        .eq("followee_id", profile.id);
      if (error) setFollowing(prev);
      else setProfile({ ...profile, follower_count: Math.max(0, profile.follower_count - 1) });
    } else {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: session.user.id, followee_id: profile.id });
      if (error) setFollowing(prev);
      else setProfile({ ...profile, follower_count: profile.follower_count + 1 });
    }
    setFollowPending(false);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#fbbf24" /></View>;
  }
  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>프로필을 찾을 수 없어요.</Text>
      </View>
    );
  }

  const displayName = profile.display_name ?? profile.username;
  const initial = displayName.trim().charAt(0).toUpperCase();
  const joinedMonth = new Date(profile.created_at).toISOString().slice(0, 7);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ title: displayName }} />

      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.handle}>@{profile.username}</Text>
          <View style={styles.followRow}>
            <Pressable
              onPress={() => router.push(`/profile/${profile.username}/followers` as never)}
              hitSlop={6}
            >
              <Text style={styles.followItem}>
                팔로워 <Text style={styles.followNum}>{profile.follower_count}</Text>
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/profile/${profile.username}/following` as never)}
              hitSlop={6}
            >
              <Text style={styles.followItem}>
                팔로잉 <Text style={styles.followNum}>{profile.following_count}</Text>
              </Text>
            </Pressable>
          </View>
          {!isSelf && session && (
            <Pressable
              onPress={toggleFollow}
              disabled={followPending}
              style={({ pressed }) => [
                styles.followBtn,
                following && styles.followBtnActive,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
                {following ? "팔로잉" : "+ 팔로우"}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
      <Text style={styles.joined}>{joinedMonth} 가입</Text>

      {dashboard && <TasteDashboardCard dashboard={dashboard} isSelf={!!isSelf} />}

      <Text style={styles.sectionTitle}>
        {isSelf ? "내 테이스팅 노트" : "공개 테이스팅 노트"}{" "}
        <Text style={styles.countDim}>({tastings.length})</Text>
      </Text>

      {tastings.length === 0 ? (
        <Text style={styles.empty}>
          {isSelf ? "아직 작성한 노트가 없어요." : "아직 공개 노트가 없어요."}
        </Text>
      ) : (
        tastings.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => router.push(`/tastings/${t.id}`)}
            style={({ pressed }) => [styles.tCard, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.tHeader}>
              <Text style={styles.tBottling} numberOfLines={1}>
                {t.bottling && (
                  <>
                    {COUNTRY_FLAG[t.bottling.country]} {t.bottling.distillery_name}{" · "}
                    <Text style={styles.tName}>{t.bottling.name}</Text>
                  </>
                )}
              </Text>
              {t.score !== null && <Text style={styles.tScore}>{formatScore(t.score)}</Text>}
            </View>
            {t.notes && <Text style={styles.tOverall} numberOfLines={3}>{t.notes}</Text>}
            {t.photos && t.photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbStrip}>
                {t.photos.map((p) => {
                  const url = tastingPhotoUrl(p);
                  return url ? (
                    <Image key={p} source={{ uri: url }} style={styles.thumb} />
                  ) : null;
                })}
              </ScrollView>
            )}
            <Text style={styles.tFooter}>
              {t.tasted_at}
              {t.visibility !== "public" && `  · ${t.visibility === "private" ? "비공개" : "팔로워만"}`}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a" },
  muted: { color: "#737373" },

  header: { flexDirection: "row", padding: 20, gap: 16 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(180, 83, 9, 0.3)",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fde68a", fontSize: 30, fontWeight: "600" },
  headerRight: { flex: 1, justifyContent: "center" },
  displayName: { color: "#fafafa", fontSize: 20, fontWeight: "700" },
  handle: { color: "#737373", fontSize: 13, marginTop: 1 },
  followRow: { flexDirection: "row", gap: 14, marginTop: 6 },
  followItem: { color: "#a3a3a3", fontSize: 12 },
  followNum: { color: "#fafafa", fontWeight: "600" },
  followBtn: {
    marginTop: 10,
    backgroundColor: "#fbbf24",
    paddingVertical: 7, paddingHorizontal: 14,
    borderRadius: 6, alignSelf: "flex-start",
  },
  followBtnActive: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#404040" },
  followBtnText: { color: "#0a0a0a", fontWeight: "600", fontSize: 12 },
  followBtnTextActive: { color: "#a3a3a3" },

  bio: { color: "#d4d4d4", fontSize: 13, paddingHorizontal: 20, lineHeight: 19 },
  joined: { color: "#737373", fontSize: 11, paddingHorizontal: 20, marginTop: 6 },

  sectionTitle: {
    color: "#fafafa", fontSize: 14, fontWeight: "600",
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10,
  },
  countDim: { color: "#525252", fontWeight: "400" },
  empty: { color: "#737373", padding: 24, textAlign: "center", fontSize: 13 },

  tCard: {
    marginHorizontal: 12, marginBottom: 8,
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 10, padding: 12,
  },
  tHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  tBottling: { color: "#a3a3a3", fontSize: 12, flex: 1 },
  tName: { color: "#fafafa", fontWeight: "500" },
  tScore: { color: "#fbbf24", fontSize: 13, fontWeight: "600" },
  tOverall: { color: "#d4d4d4", fontSize: 13, marginTop: 6, lineHeight: 18 },
  tFooter: { color: "#525252", fontSize: 10, marginTop: 6 },
  thumbStrip: { marginTop: 8 },
  thumb: { width: 70, height: 70, borderRadius: 6, marginRight: 6, backgroundColor: "#262626" },
});
