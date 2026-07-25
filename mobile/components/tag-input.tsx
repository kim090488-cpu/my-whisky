import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  placeholder?: string;
};

export function TagInput({ value, onChange, max = 10, placeholder = "태그 추가 (예: 피트, 입문)" }: Props) {
  const [draft, setDraft] = useState("");

  function add() {
    const t = draft.trim();
    if (!t || t.length > 30) return;
    if (value.includes(t)) { setDraft(""); return; }
    if (value.length >= max) return;
    onChange([...value, t]);
    setDraft("");
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <View style={styles.wrap}>
      {value.length > 0 && (
        <View style={styles.chipRow}>
          {value.map((t, i) => (
            <View key={`${t}-${i}`} style={styles.chip}>
              <Text style={styles.chipText}>#{t}</Text>
              <Pressable onPress={() => remove(i)} hitSlop={6}>
                <Ionicons name="close" size={12} color="#fbbf24" />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {value.length < max && (
        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            returnKeyType="done"
            maxLength={30}
            autoCapitalize="none"
            placeholder={placeholder}
            placeholderTextColor="#525252"
            style={styles.input}
          />
          <Pressable
            onPress={add}
            disabled={!draft.trim()}
            style={({ pressed }) => [styles.addBtn, !draft.trim() && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.addBtnText}>추가</Text>
          </Pressable>
        </View>
      )}
      <Text style={styles.hint}>{value.length}/{max} · 각 30자 이내 · 엔터로 추가</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    borderWidth: 1, borderColor: "rgba(251, 191, 36, 0.35)",
  },
  chipText: { color: "#fbbf24", fontSize: 12, fontWeight: "500" },
  inputRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    backgroundColor: "#171717", borderWidth: 1, borderColor: "#262626",
    color: "#fafafa", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, fontSize: 13,
  },
  addBtn: { backgroundColor: "#fbbf24", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, justifyContent: "center" },
  addBtnText: { color: "#0a0a0a", fontSize: 12, fontWeight: "700" },
  hint: { color: "#525252", fontSize: 10 },
});
