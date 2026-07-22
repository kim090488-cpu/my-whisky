import { useEffect, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

type Settings = {
  notify_like: boolean;
  notify_comment: boolean;
  notify_follow: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  notify_like: true,
  notify_comment: true,
  notify_follow: true,
};

const ITEMS: {
  key: keyof Settings;
  label: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { key: "notify_like",    label: "좋아요",  desc: "내 노트를 누가 좋아요 했을 때",       icon: "heart",       color: "#f43f5e" },
  { key: "notify_comment", label: "댓글",    desc: "내 노트나 내 댓글에 답이 달렸을 때",  icon: "chatbubble",  color: "#0ea5e9" },
  { key: "notify_follow",  label: "팔로우",  desc: "누가 나를 팔로우했을 때",             icon: "person-add",  color: "#10b981" },
];

export default function NotificationSettingsScreen() {
  const { session, loading: sessionLoading } = useSession();
  const [initial, setInitial] = useState<Settings>(DEFAULT_SETTINGS);
  const [state, setState] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("notify_like, notify_comment, notify_follow")
        .eq("id", session.user.id)
        .maybeSingle();
      if (data) {
        const s: Settings = {
          notify_like:    (data as Settings).notify_like    ?? true,
          notify_comment: (data as Settings).notify_comment ?? true,
          notify_follow:  (data as Settings).notify_follow  ?? true,
        };
        setInitial(s);
        setState(s);
      }
      setLoading(false);
    })();
  }, [session, sessionLoading]);

  function toggle(key: keyof Settings) {
    setStatusMsg(null);
    setState((s) => ({ ...s, [key]: !s[key] }));
  }

  async function save() {
    if (!session) return;
    setSaving(true);
    setStatusMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        notify_like: state.notify_like,
        notify_comment: state.notify_comment,
        notify_follow: state.notify_follow,
      })
      .eq("id", session.user.id);
    if (error) {
      setStatusMsg({ kind: "err", text: error.message });
    } else {
      setStatusMsg({ kind: "ok", text: "저장됐어요." });
      setInitial(state);
    }
    setSaving(false);
  }

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
        <Text style={styles.muted}>로그인 후 설정할 수 있어요.</Text>
      </View>
    );
  }

  const dirty =
    state.notify_like !== initial.notify_like ||
    state.notify_comment !== initial.notify_comment ||
    state.notify_follow !== initial.notify_follow;

  return (
    <ScrollView style={{ backgroundColor: "#0a0a0a" }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={styles.desc}>
        받을 알림 종류를 선택할 수 있어요. 끄면 새 알림이 만들어지지 않아요.
      </Text>

      <View style={styles.card}>
        {ITEMS.map((it, i) => {
          const on = state[it.key];
          return (
            <View key={it.key} style={[styles.row, i > 0 && styles.rowBorder]}>
              <View style={[styles.iconBadge, { backgroundColor: it.color }]}>
                <Ionicons name={it.icon} color="#fff" size={14} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{it.label}</Text>
                <Text style={styles.rowDesc}>{it.desc}</Text>
              </View>
              <Pressable
                onPress={() => toggle(it.key)}
                style={[styles.toggle, on && styles.toggleOn]}
              >
                <View style={[styles.knob, on && styles.knobOn]} />
              </Pressable>
            </View>
          );
        })}
      </View>

      {statusMsg && (
        <Text style={statusMsg.kind === "ok" ? styles.msgOk : styles.msgErr}>{statusMsg.text}</Text>
      )}

      <Pressable
        onPress={save}
        disabled={saving || !dirty}
        style={({ pressed }) => [
          styles.saveBtn,
          (!dirty || saving) && styles.saveBtnDisabled,
          pressed && dirty && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.saveBtnText}>{saving ? "저장 중…" : "저장"}</Text>
      </Pressable>

      <Text style={styles.hint}>
        변경사항은 저장 후 새 알림부터 반영돼요.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0a0a0a",
    padding: 24,
  },
  muted: { color: "#a3a3a3", fontSize: 14 },
  desc: { color: "#a3a3a3", fontSize: 13, lineHeight: 18 },
  card: {
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "#171717",
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: "#262626" },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { color: "#fafafa", fontSize: 14, fontWeight: "500" },
  rowDesc: { color: "#a3a3a3", fontSize: 11, marginTop: 2 },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#404040",
    padding: 2,
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: "#fbbf24" },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fafafa",
    alignSelf: "flex-start",
  },
  knobOn: { alignSelf: "flex-end" },
  msgOk: { color: "#6ee7b7", fontSize: 13 },
  msgErr: { color: "#fda4af", fontSize: 13 },
  saveBtn: {
    backgroundColor: "#fbbf24",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: "#0a0a0a", fontSize: 14, fontWeight: "600" },
  hint: { color: "#525252", fontSize: 11, textAlign: "center" },
});
