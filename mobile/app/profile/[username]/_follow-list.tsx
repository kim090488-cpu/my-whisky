import { useEffect, useState } from "react";
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type Props = {
  username: string;
  /** followers: 나를 팔로우하는 사람 / following: 내가 팔로우하는 사람 */
  direction: "followers" | "following";
};

export function FollowList({ username, direction }: Props) {
  const router = useRouter();
  const { session } = useSession();

  const [rows, setRows] = useState<Profile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;
    (async () => {
      setLoading(true);

      const { data: p } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username.toLowerCase())
        .maybeSingle();
      const owner = p as unknown as { id: string } | null;
      if (!owner) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // followers: followee_id = owner.id → follower_id 목록
      // following: follower_id  = owner.id → followee_id 목록
      const targetCol = direction === "followers" ? "follower_id" : "followee_id";
      const filterCol = direction === "followers" ? "followee_id" : "follower_id";

      const { data: edges } = await supabase
        .from("follows")
        .select("follower_id, followee_id, created_at")
        .eq(filterCol, owner.id)
        .order("created_at", { ascending: false })
        .limit(200);

      const otherIds = Array.from(
        new Set(
          ((edges ?? []) as unknown as { follower_id: string; followee_id: string }[])
            .map((e) => (targetCol === "follower_id" ? e.follower_id : e.followee_id)),
        ),
      );

      let profiles: Profile[] = [];
      if (otherIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, bio")
          .in("id", otherIds);
        const byId = new Map<string, Profile>();
        for (const pr of (profs ?? []) as Profile[]) byId.set(pr.id, pr);
        // edges 순서 유지 (최신 순)
        profiles = otherIds
          .map((oid) => byId.get(oid))
          .filter((x): x is Profile => !!x);
      }
      setRows(profiles);

      // 로그인 유저가 이미 팔로우 중인 대상 표시 (자기 자신 제외)
      if (session && profiles.length > 0) {
        const { data: myEdges } = await supabase
          .from("follows")
          .select("followee_id")
          .eq("follower_id", session.user.id)
          .in("followee_id", profiles.map((pr) => pr.id));
        const mine = new Set(
          ((myEdges ?? []) as unknown as { followee_id: string }[]).map((e) => e.followee_id),
        );
        setFollowingIds(mine);
      } else {
        setFollowingIds(new Set());
      }

      setLoading(false);
    })();
  }, [username, direction, session]);

  async function toggleFollow(targetId: string) {
    if (!session) {
      router.push("/login" as never);
      return;
    }
    if (targetId === session.user.id) return;

    const prev = followingIds;
    const next = new Set(prev);
    const isFollowing = prev.has(targetId);
    if (isFollowing) next.delete(targetId);
    else next.add(targetId);
    setFollowingIds(next);

    if (isFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", session.user.id)
        .eq("followee_id", targetId);
      if (error) setFollowingIds(prev);
    } else {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: session.user.id, followee_id: targetId });
      if (error) setFollowingIds(prev);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fbbf24" />
      </View>
    );
  }
  if (notFound) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>프로필을 찾을 수 없어요.</Text>
      </View>
    );
  }
  if (rows.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>
          {direction === "followers" ? "아직 팔로워가 없어요." : "아직 팔로잉이 없어요."}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: "#0a0a0a" }}
      data={rows}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => {
        const name = item.display_name ?? item.username;
        const initial = name.trim().charAt(0).toUpperCase();
        const isSelf = session?.user.id === item.id;
        const isFollowing = followingIds.has(item.id);

        return (
          <Pressable
            onPress={() => router.push(`/profile/${item.username}` as never)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              <Text style={styles.handle} numberOfLines={1}>@{item.username}</Text>
              {item.bio && (
                <Text style={styles.bio} numberOfLines={2}>{item.bio}</Text>
              )}
            </View>
            {!isSelf && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  void toggleFollow(item.id);
                }}
                style={({ pressed }) => [
                  styles.followBtn,
                  isFollowing && styles.followBtnActive,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                  {isFollowing ? "팔로잉" : "+ 팔로우"}
                </Text>
              </Pressable>
            )}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#0a0a0a", padding: 24,
  },
  muted: { color: "#a3a3a3", fontSize: 14 },
  separator: { height: 1, backgroundColor: "#171717", marginHorizontal: 16 },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#0a0a0a",
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(180, 83, 9, 0.3)",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fde68a", fontSize: 18, fontWeight: "600" },
  name: { color: "#fafafa", fontSize: 14, fontWeight: "600" },
  handle: { color: "#737373", fontSize: 12, marginTop: 1 },
  bio: { color: "#a3a3a3", fontSize: 12, marginTop: 4, lineHeight: 16 },

  followBtn: {
    backgroundColor: "#fbbf24",
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 6,
  },
  followBtnActive: {
    backgroundColor: "transparent",
    borderWidth: 1, borderColor: "#404040",
  },
  followBtnText: { color: "#0a0a0a", fontSize: 12, fontWeight: "600" },
  followBtnTextActive: { color: "#a3a3a3" },
});
