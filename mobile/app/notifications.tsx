import { useEffect, useState } from "react";
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

type NotificationKind = "like" | "comment" | "follow";

type Row = {
  id: string;
  kind: NotificationKind;
  actor_id: string | null;
  target_table: string | null;
  target_id: string | null;
  payload: { tasting_id?: string; comment_id?: string; body?: string } | null;
  read_at: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Tasting = { id: string; bottling_id: string };
type BottlingLite = {
  id: string;
  name: string;
  name_kr: string | null;
  distillery_name: string;
};

type EnrichedRow = Row & {
  actor: Profile | null;
  bottling: BottlingLite | null;
  wasUnread: boolean;
};

const KIND_META: Record<NotificationKind, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  like:    { icon: "heart",       color: "#f43f5e" },
  comment: { icon: "chatbubble",  color: "#0ea5e9" },
  follow:  { icon: "person-add",  color: "#10b981" },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const [rows, setRows] = useState<EnrichedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);

      const { data: rawNotifs } = await supabase
        .from("notifications")
        .select("id, kind, actor_id, target_table, target_id, payload, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      const notifs = (rawNotifs ?? []) as unknown as Row[];
      const unreadIds = notifs.filter((n) => !n.read_at).map((n) => n.id);
      const wasUnreadSet = new Set(unreadIds);

      const actorIds = Array.from(
        new Set(notifs.map((n) => n.actor_id).filter((v): v is string => !!v)),
      );
      const actorPromise =
        actorIds.length > 0
          ? supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url")
              .in("id", actorIds)
          : Promise.resolve({ data: [] as Profile[] } as const);

      const tastingIds = new Set<string>();
      for (const n of notifs) {
        if (n.kind === "like" && n.target_id) tastingIds.add(n.target_id);
        if (n.kind === "comment") {
          const t = n.payload?.tasting_id;
          if (typeof t === "string") tastingIds.add(t);
        }
      }
      const tastingPromise =
        tastingIds.size > 0
          ? supabase
              .from("tastings")
              .select("id, bottling_id")
              .in("id", Array.from(tastingIds))
          : Promise.resolve({ data: [] as Tasting[] } as const);

      const [actorRes, tastingRes] = await Promise.all([actorPromise, tastingPromise]);

      const actorsById = new Map<string, Profile>();
      for (const p of (actorRes.data ?? []) as Profile[]) actorsById.set(p.id, p);
      const tastingsById = new Map<string, Tasting>();
      for (const t of (tastingRes.data ?? []) as Tasting[]) tastingsById.set(t.id, t);

      const bottlingIds = Array.from(
        new Set(Array.from(tastingsById.values()).map((t) => t.bottling_id)),
      );
      let bottlingsById = new Map<string, BottlingLite>();
      if (bottlingIds.length > 0) {
        const { data } = await supabase
          .from("bottling_card_stats")
          .select("id, name, name_kr, distillery_name")
          .in("id", bottlingIds);
        bottlingsById = new Map(
          ((data ?? []) as BottlingLite[]).map((b) => [b.id, b]),
        );
      }

      const enriched: EnrichedRow[] = notifs.map((n) => {
        let bottling: BottlingLite | null = null;
        if (n.kind === "like" && n.target_id) {
          const t = tastingsById.get(n.target_id);
          bottling = t ? bottlingsById.get(t.bottling_id) ?? null : null;
        } else if (n.kind === "comment" && typeof n.payload?.tasting_id === "string") {
          const t = tastingsById.get(n.payload.tasting_id);
          bottling = t ? bottlingsById.get(t.bottling_id) ?? null : null;
        }
        return {
          ...n,
          actor: n.actor_id ? actorsById.get(n.actor_id) ?? null : null,
          bottling,
          wasUnread: wasUnreadSet.has(n.id),
        };
      });

      setRows(enriched);
      setLoading(false);

      // read_at bulk 업데이트 — 시각적 강조는 wasUnread 캡처값 사용
      if (unreadIds.length > 0) {
        void supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("user_id", session.user.id)
          .is("read_at", null);
      }
    })();
  }, [session, sessionLoading]);

  if (sessionLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fbbf24" />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>로그인 후 알림을 볼 수 있어요.</Text>
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>아직 도착한 알림이 없어요.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: "#0a0a0a" }}
      data={rows}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => <NotificationRow row={item} router={router} />}
    />
  );
}

function NotificationRow({
  row,
  router,
}: {
  row: EnrichedRow;
  router: ReturnType<typeof useRouter>;
}) {
  const actorName = row.actor?.display_name || row.actor?.username || "누군가";
  const meta = KIND_META[row.kind];

  const message =
    row.kind === "like"
      ? `${actorName}님이 회원님의 노트를 좋아합니다.`
      : row.kind === "comment"
        ? `${actorName}님이 회원님의 노트에 댓글을 남겼습니다${
            row.payload?.body ? `: "${row.payload.body}"` : "."
          }`
        : `${actorName}님이 회원님을 팔로우했습니다.`;

  const subline =
    row.bottling
      ? `${row.bottling.distillery_name} · ${row.bottling.name_kr || row.bottling.name}`
      : row.kind === "follow" && row.actor?.username
        ? `@${row.actor.username}`
        : null;

  const onPress = () => {
    if (row.kind === "like" && row.target_id) {
      router.push(`/tastings/${row.target_id}`);
    } else if (row.kind === "comment") {
      const tastingId = row.payload?.tasting_id;
      if (typeof tastingId === "string") {
        router.push(`/tastings/${tastingId}`);
      } else if (row.bottling) {
        router.push(`/whiskies/${row.bottling.id}`);
      }
    } else if (row.kind === "follow" && row.actor?.username) {
      router.push(`/profile/${row.actor.username}`);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        row.wasUnread && styles.rowUnread,
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.iconBadge, { backgroundColor: meta.color }]}>
        <Ionicons name={meta.icon} color="#fff" size={14} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.message}>{message}</Text>
        {subline && <Text style={styles.subline}>{subline}</Text>}
        <Text style={styles.time}>{formatTime(row.created_at)}</Text>
      </View>
      {row.wasUnread && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  return d.toISOString().slice(0, 10);
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0a0a0a",
    padding: 24,
    gap: 8,
  },
  muted: { color: "#a3a3a3", textAlign: "center", fontSize: 14 },
  separator: { height: 1, backgroundColor: "#262626", marginHorizontal: 12 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#0a0a0a",
  },
  rowUnread: { backgroundColor: "rgba(251, 191, 36, 0.06)" },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  message: { color: "#f5f5f5", fontSize: 13, lineHeight: 18 },
  subline: { color: "#a3a3a3", fontSize: 11, marginTop: 3 },
  time: { color: "#737373", fontSize: 10, marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fbbf24",
    marginTop: 8,
  },
});
