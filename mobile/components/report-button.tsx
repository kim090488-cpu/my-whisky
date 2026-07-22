import { useState } from "react";
import {
  View, Text, Pressable, TextInput, Modal, StyleSheet, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { REPORT_REASON_LABEL, REPORT_REASONS } from "@/lib/report-labels";
import type { ReportReason, ReportTarget } from "@/types/database";

type Props = {
  targetTable: ReportTarget;
  targetId: string;
  ownerId: string | null;
  currentUserId: string | null;
  /** override label (default "신고") */
  label?: string;
  /** override the trigger text style; defaults to small muted */
  compact?: boolean;
};

export function ReportButton({
  targetTable, targetId, ownerId, currentUserId,
  label = "신고",
  compact = true,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // 본인 것은 신고 버튼 자체 숨김
  if (currentUserId && ownerId && currentUserId === ownerId) return null;

  function trigger() {
    if (!currentUserId) {
      router.push("/login" as never);
      return;
    }
    setOpen(true);
    setMsg(null);
  }

  function close() {
    if (pending) return;
    setOpen(false);
    setBody("");
    setReason("spam");
    setMsg(null);
  }

  async function submit() {
    if (pending) return;
    setMsg(null);
    setPending(true);

    const trimmed = body.trim();
    if (trimmed.length > 1000) {
      setMsg({ kind: "err", text: "설명은 1000자 이내." });
      setPending(false);
      return;
    }

    const { error } = await supabase.from("reports").insert({
      reporter_id: currentUserId,
      target_table: targetTable,
      target_id: targetId,
      reason,
      body: trimmed || null,
    });

    if (error) {
      const errMsg =
        error.code === "23505"
          ? "이미 신고하신 항목이에요."
          : error.message;
      setMsg({ kind: "err", text: errMsg });
      setPending(false);
      return;
    }

    setMsg({ kind: "ok", text: "신고가 접수됐어요. 검토 후 처리됩니다." });
    setPending(false);
    setTimeout(() => {
      setOpen(false);
      setBody("");
      setReason("spam");
      setMsg(null);
    }, 1200);
  }

  return (
    <>
      <Pressable onPress={trigger} hitSlop={4}>
        <Text style={compact ? styles.triggerCompact : styles.triggerNormal}>
          {label}
        </Text>
      </Pressable>

      <Modal
        transparent
        animationType="fade"
        visible={open}
        onRequestClose={close}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable
            style={styles.dialog}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.title}>신고하기</Text>

            <Text style={styles.fieldLabel}>사유</Text>
            <View style={styles.reasonList}>
              {REPORT_REASONS.map((r) => {
                const active = r === reason;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setReason(r)}
                    style={({ pressed }) => [
                      styles.reasonItem,
                      active && styles.reasonItemActive,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.reasonText, active && styles.reasonTextActive]}>
                      {REPORT_REASON_LABEL[r]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>추가 설명 (선택, 1000자)</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={1000}
              placeholder="어떤 점이 문제인지 알려주시면 처리에 도움돼요."
              placeholderTextColor="#525252"
              style={styles.textInput}
            />

            {msg && (
              <Text style={[styles.msg, msg.kind === "ok" ? styles.msgOk : styles.msgErr]}>
                {msg.text}
              </Text>
            )}

            <View style={styles.actions}>
              <Pressable
                onPress={close}
                disabled={pending}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && { opacity: 0.7 },
                  pending && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.cancelText}>취소</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={pending}
                style={({ pressed }) => [
                  styles.submitBtn,
                  pressed && { opacity: 0.85 },
                  pending && { opacity: 0.6 },
                ]}
              >
                {pending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitText}>신고</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  triggerCompact: { color: "#525252", fontSize: 11 },
  triggerNormal: { color: "#a3a3a3", fontSize: 13 },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  dialog: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#0a0a0a",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  title: { color: "#fafafa", fontSize: 15, fontWeight: "600", marginBottom: 4 },
  fieldLabel: { color: "#a3a3a3", fontSize: 11 },

  reasonList: { gap: 6 },
  reasonItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 9, paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1, borderColor: "#262626",
    backgroundColor: "#171717",
  },
  reasonItemActive: {
    borderColor: "#fbbf24",
    backgroundColor: "rgba(251, 191, 36, 0.08)",
  },
  radio: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 1.5, borderColor: "#525252",
    alignItems: "center", justifyContent: "center",
  },
  radioActive: { borderColor: "#fbbf24" },
  radioDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: "#fbbf24",
  },
  reasonText: { color: "#d4d4d4", fontSize: 13 },
  reasonTextActive: { color: "#fafafa", fontWeight: "500" },

  textInput: {
    color: "#f5f5f5", fontSize: 13,
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    minHeight: 66, maxHeight: 140,
    textAlignVertical: "top",
  },

  msg: { fontSize: 12 },
  msgOk: { color: "#6ee7b7" },
  msgErr: { color: "#fca5a5" },

  actions: {
    flexDirection: "row", justifyContent: "flex-end",
    gap: 8, marginTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 6, borderWidth: 1, borderColor: "#404040",
  },
  cancelText: { color: "#d4d4d4", fontSize: 12 },
  submitBtn: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: "#ef4444",
    minWidth: 60, alignItems: "center",
  },
  submitText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
