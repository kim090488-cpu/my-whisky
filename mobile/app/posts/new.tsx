import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, Image, Alert,
  ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  pickAndUploadPostPhoto, deletePostPhoto, postPhotoUrl,
} from "@/lib/uploads";
import { COUNTRY_FLAG } from "@/lib/format";
import type { TastingVisibility, WhiskyCountry } from "@/types/database";

const MAX_PHOTOS = 10;

const VISIBILITIES: { v: TastingVisibility; l: string }[] = [
  { v: "public", l: "공개" },
  { v: "followers", l: "팔로워만" },
  { v: "private", l: "비공개" },
];

type PrefillBottling = {
  id: string;
  name: string;
  name_kr: string | null;
  distillery_name: string;
  distillery_name_kr: string | null;
  country: WhiskyCountry;
};

export default function NewPost() {
  const { bottling: bottlingParam } = useLocalSearchParams<{ bottling?: string }>();
  const router = useRouter();
  const { session } = useSession();

  const [photos, setPhotos] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<TastingVisibility>("public");
  const [locationName, setLocationName] = useState("");
  const [bottling, setBottling] = useState<PrefillBottling | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bottlingParam) return;
    (async () => {
      const { data } = await supabase
        .from("bottling_card_stats")
        .select("id, name, name_kr, distillery_name, distillery_name_kr, country")
        .eq("id", bottlingParam)
        .maybeSingle();
      if (data) {
        const b = data as unknown as {
          id: string | null;
          name: string;
          name_kr: string | null;
          distillery_name: string;
          distillery_name_kr: string | null;
          country: WhiskyCountry;
        };
        if (b.id) {
          setBottling({
            id: b.id,
            name: b.name,
            name_kr: b.name_kr,
            distillery_name: b.distillery_name,
            distillery_name_kr: b.distillery_name_kr,
            country: b.country,
          });
        }
      }
    })();
  }, [bottlingParam]);

  async function addPhoto() {
    if (!session || photos.length >= MAX_PHOTOS) return;
    setPhotoBusy(true);
    try {
      const path = await pickAndUploadPostPhoto(session.user.id);
      if (path) setPhotos((prev) => [...prev, path]);
    } catch (e) {
      Alert.alert("사진 업로드 실패", e instanceof Error ? e.message : String(e));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto(index: number) {
    const target = photos[index];
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    try { await deletePostPhoto(target); } catch { /* orphan 무시 */ }
  }

  async function submit() {
    if (!session || pending) return;
    setError(null);
    if (photos.length === 0) {
      setError("사진을 한 장 이상 올려주세요.");
      return;
    }

    setPending(true);
    const { data, error: insertError } = await supabase.from("posts").insert({
      user_id: session.user.id,
      photos,
      body: body.trim() || null,
      visibility,
      bottling_id: bottling?.id ?? null,
      location_name: locationName.trim() || null,
    } as never).select("id").single();
    setPending(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    const newId = (data as unknown as { id: string } | null)?.id;
    if (newId) {
      router.replace(`/posts/${newId}` as never);
    } else {
      router.replace("/posts" as never);
    }
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>로그인 후 다시 시도해주세요.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0a0a0a" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "새 모먼트" }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>
          지금 마시는 한 잔, 바에 갔던 순간 — 정식 후기는 아니지만 남기고 싶은 기억.
        </Text>

        {/* 사진 */}
        <Field label={`사진 (${photos.length}/${MAX_PHOTOS})`}>
          <View style={styles.photoRow}>
            {photos.map((p, i) => {
              const url = postPhotoUrl(p);
              return (
                <View key={p} style={styles.photoBox}>
                  {url && <Image source={{ uri: url }} style={styles.photoImg} />}
                  <Pressable onPress={() => removePhoto(i)} style={styles.photoRemove} hitSlop={6}>
                    <Text style={styles.photoRemoveText}>×</Text>
                  </Pressable>
                </View>
              );
            })}
            {photos.length < MAX_PHOTOS && (
              <Pressable
                onPress={addPhoto}
                disabled={photoBusy}
                style={({ pressed }) => [
                  styles.photoAdd,
                  pressed && { opacity: 0.7 },
                  photoBusy && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.photoAddText}>{photoBusy ? "올리는 중…" : "+ 사진"}</Text>
              </Pressable>
            )}
          </View>
        </Field>

        {/* 캡션 */}
        <Field label={`캡션 (${body.length}/2000)`}>
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={2000}
            placeholder="이 순간에 대해 한 줄… (선택)"
            placeholderTextColor="#525252"
            style={[styles.input, styles.textareaTall]}
          />
        </Field>

        {/* 공개 범위 */}
        <Field label="공개 범위">
          <View style={styles.pillRow}>
            {VISIBILITIES.map((v) => (
              <Pressable
                key={v.v}
                onPress={() => setVisibility(v.v)}
                style={({ pressed }) => [
                  styles.pill,
                  visibility === v.v && styles.pillActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.pillText, visibility === v.v && styles.pillTextActive]}>
                  {v.l}
                </Text>
              </Pressable>
            ))}
          </View>
        </Field>

        {/* 보틀링 태그 */}
        <Field label="보틀링 태그 (선택)">
          {bottling ? (
            <View style={styles.bottlingCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bottlingCardText} numberOfLines={2}>
                  {COUNTRY_FLAG[bottling.country]}{" "}
                  {bottling.distillery_name_kr ?? bottling.distillery_name} · {bottling.name_kr ?? bottling.name}
                </Text>
              </View>
              <Pressable onPress={() => setBottling(null)} hitSlop={6}>
                <Text style={styles.bottlingClear}>×</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.hintText}>
              위스키 상세 화면에서 "모먼트 남기기"로 진입하면 자동 태그됩니다.
            </Text>
          )}
        </Field>

        {/* 위치 */}
        <Field label="위치 이름 (선택)">
          <TextInput
            value={locationName}
            onChangeText={setLocationName}
            maxLength={100}
            placeholder="예: 강남 바 XX"
            placeholderTextColor="#525252"
            style={styles.input}
          />
        </Field>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={pending || photos.length === 0}
          style={({ pressed }) => [
            styles.submitButton,
            (pending || photos.length === 0) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.submitText}>{pending ? "저장 중…" : "모먼트 남기기"}</Text>
        </Pressable>

        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancelText}>취소</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a", padding: 24 },
  muted: { color: "#737373", textAlign: "center" },
  container: { padding: 16, gap: 16, paddingBottom: 40 },
  lead: { color: "#a3a3a3", fontSize: 13, lineHeight: 19 },
  label: { color: "#a3a3a3", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  hintText: { color: "#737373", fontSize: 12, lineHeight: 17 },

  input: {
    backgroundColor: "#171717",
    borderWidth: 1, borderColor: "#262626",
    color: "#fafafa",
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 8, fontSize: 14,
  },
  textareaTall: { minHeight: 130, textAlignVertical: "top" },

  pillRow: { flexDirection: "row", gap: 8 },
  pill: {
    flex: 1, paddingVertical: 9, alignItems: "center",
    borderRadius: 8, borderWidth: 1, borderColor: "#262626",
    backgroundColor: "#171717",
  },
  pillActive: { borderColor: "#fbbf24", backgroundColor: "rgba(251, 191, 36, 0.1)" },
  pillText: { color: "#a3a3a3", fontSize: 13 },
  pillTextActive: { color: "#fde68a", fontWeight: "600" },

  bottlingCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: "rgba(180, 83, 9, 0.4)",
    backgroundColor: "rgba(251, 191, 36, 0.06)",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
  },
  bottlingCardText: { color: "#fde68a", fontSize: 13 },
  bottlingClear: { color: "#fbbf24", fontSize: 18, paddingHorizontal: 4 },

  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoBox: {
    width: 80, height: 80, borderRadius: 8,
    overflow: "hidden", borderWidth: 1, borderColor: "#262626",
    position: "relative",
  },
  photoImg: { width: "100%", height: "100%" },
  photoRemove: {
    position: "absolute", right: 2, top: 2,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 5, borderRadius: 4,
  },
  photoRemoveText: { color: "#fafafa", fontSize: 14, lineHeight: 16 },
  photoAdd: {
    width: 80, height: 80,
    borderRadius: 8, borderWidth: 1, borderStyle: "dashed",
    borderColor: "#525252",
    alignItems: "center", justifyContent: "center",
  },
  photoAddText: { color: "#a3a3a3", fontSize: 12 },

  errorText: { color: "#fca5a5", fontSize: 12 },
  submitButton: {
    backgroundColor: "#fbbf24",
    paddingVertical: 13,
    borderRadius: 8, alignItems: "center",
    marginTop: 8,
  },
  submitText: { color: "#0a0a0a", fontWeight: "600", fontSize: 15 },
  cancelText: { color: "#737373", textAlign: "center", padding: 12 },
});
