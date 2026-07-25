import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth-context";
import { COUNTRY_FLAG } from "@/lib/format";
import type { WhiskyCountry } from "@/types/database";

export type PickedBottling = {
  id: string;
  name: string;
  name_kr: string | null;
  distillery_name: string;
  distillery_name_kr: string | null;
  country: WhiskyCountry;
};

type Props = {
  onSelect: (b: PickedBottling) => void;
  onCancel: () => void;
  title?: string;
};

export function BottlingSearchPicker({ onSelect, onCancel, title = "위스키 선택" }: Props) {
  const { session } = useSession();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedBottling[]>([]);
  const [searching, setSearching] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    const query = q.trim();
    const timer = setTimeout(async () => {
      let sb = supabase
        .from("bottling_card_stats")
        .select("id, name, name_kr, distillery_name, distillery_name_kr, country");
      if (query.length > 0) {
        const safe = query.replace(/[%_\\]/g, (m) => `\\${m}`);
        sb = sb.or(
          `name.ilike.%${safe}%,name_kr.ilike.%${safe}%,distillery_name.ilike.%${safe}%,distillery_name_kr.ilike.%${safe}%`,
        );
      }
      const { data } = await sb
        .order("tasting_count", { ascending: false, nullsFirst: false })
        .limit(100);
      if (cancelled) return;
      const rows = (data ?? []) as unknown as PickedBottling[];
      setResults(rows.filter((r) => r.id));
      setSearching(false);
    }, query.length === 0 ? 0 : 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [q]);

  async function createAndPick() {
    if (!session || creating) return;
    const name = q.trim();
    if (name.length < 1) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("bottlings")
      .insert({
        name, name_kr: name,
        created_by: session.user.id,
        cask_type: "unknown", bottler: "official", bottle_size_ml: 700,
      } as never)
      .select("id")
      .single();
    setCreating(false);
    if (error) return Alert.alert("등록 실패", error.message);
    const newId = (data as unknown as { id: string } | null)?.id;
    if (!newId) return;
    onSelect({
      id: newId, name, name_kr: name,
      distillery_name: "", distillery_name_kr: null,
      country: "other" as WhiskyCountry,
    });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0a0a0a" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color="#a3a3a3" />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={title === "위스키 선택" ? "이름·증류소로 검색 (한글 OK)" : title}
            placeholderTextColor="#525252"
            autoCapitalize="none"
            autoFocus
            style={styles.searchInput}
          />
          <Pressable onPress={onCancel} hitSlop={6}>
            <Text style={styles.cancel}>취소</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          {q.trim().length === 0 ? `전체 위스키 (인기순 · ${results.length}개)` : searching ? "검색 중…" : `결과 ${results.length}개`}
        </Text>
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24, gap: 8 }}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          extraScrollHeight={80}
        >
          {q.trim().length >= 1 && (
            <Pressable
              onPress={createAndPick}
              disabled={creating}
              style={({ pressed }) => [
                styles.createBtn,
                pressed && { opacity: 0.7 },
                creating && { opacity: 0.5 },
              ]}
            >
              <Ionicons name="add-circle-outline" size={16} color="#fbbf24" />
              <Text style={styles.createBtnText} numberOfLines={1}>
                {creating ? "등록 중…" : `"${q.trim()}" 새 위스키로 등록해서 선택`}
              </Text>
            </Pressable>
          )}
          {!searching && results.length === 0 && q.trim().length === 0 ? (
            <Text style={styles.empty}>등록된 위스키가 없어요.</Text>
          ) : (
            <View style={styles.resultList}>
              {results.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => onSelect(r)}
                  style={({ pressed }) => [styles.resultItem, pressed && { backgroundColor: "#1f1f1f" }]}
                >
                  <Text style={styles.resultTitle} numberOfLines={1}>
                    {r.name_kr ?? r.name}
                  </Text>
                  <Text style={styles.resultSub} numberOfLines={1}>
                    {COUNTRY_FLAG[r.country]} {r.distillery_name_kr ?? r.distillery_name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </KeyboardAwareScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12, backgroundColor: "#0a0a0a" },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#171717", borderWidth: 1, borderColor: "#262626",
    borderRadius: 8, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: "#fafafa", fontSize: 14, paddingVertical: 10 },
  cancel: { color: "#a3a3a3", fontSize: 12 },
  hint: { color: "#737373", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "600" },
  empty: { color: "#737373", fontSize: 13, textAlign: "center", paddingVertical: 20 },
  createBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: "rgba(251, 191, 36, 0.45)",
    borderRadius: 8, backgroundColor: "rgba(251, 191, 36, 0.08)",
  },
  createBtnText: { color: "#fbbf24", fontSize: 13, fontWeight: "600", flex: 1 },
  resultList: {
    borderRadius: 8, borderWidth: 1, borderColor: "#262626",
    backgroundColor: "#111", overflow: "hidden",
  },
  resultItem: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#1f1f1f", gap: 2,
  },
  resultTitle: { color: "#fafafa", fontSize: 13, fontWeight: "500" },
  resultSub: { color: "#a3a3a3", fontSize: 11 },
});
