import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, Image, Alert,
  ScrollView, KeyboardAvoidingView, Platform, BackHandler,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  pickAndUploadPostPhoto, deletePostPhoto, postPhotoSignedUrls,
} from "@/lib/uploads";
import { COUNTRY_FLAG } from "@/lib/format";
import { TagInput } from "@/components/tag-input";
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
  const { bottling: bottlingParam, edit: editId } = useLocalSearchParams<{ bottling?: string; edit?: string }>();
  const isEditMode = !!editId;
  const router = useRouter();
  const { session } = useSession();

  const [photos, setPhotos] = useState<string[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<TastingVisibility>("public");
  const [locationName, setLocationName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [bottling, setBottling] = useState<PrefillBottling | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(isEditMode);
  // 보틀링 검색
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<PrefillBottling[]>([]);
  const [searching, setSearching] = useState(false);

  // 편집 모드: 기존 post 로드
  useEffect(() => {
    if (!editId || !session) return;
    (async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, user_id, body, photos, visibility, bottling_id, location_name, tags")
        .eq("id", editId)
        .maybeSingle();
      const p = data as unknown as {
        id: string; user_id: string; body: string | null;
        photos: string[]; visibility: TastingVisibility;
        bottling_id: string | null; location_name: string | null;
        tags: string[] | null;
      } | null;
      if (!p || p.user_id !== session.user.id) {
        Alert.alert("접근 불가", "본인이 작성한 모먼트만 수정할 수 있어요.");
        router.back();
        return;
      }
      setBody(p.body ?? "");
      setPhotos(p.photos ?? []);
      setVisibility(p.visibility);
      setLocationName(p.location_name ?? "");
      setTags(p.tags ?? []);
      // 보틀링 태그도 로드
      if (p.bottling_id) {
        const { data: b } = await supabase
          .from("bottling_card_stats")
          .select("id, name, name_kr, distillery_name, distillery_name_kr, country")
          .eq("id", p.bottling_id)
          .maybeSingle();
        const row = b as unknown as PrefillBottling | null;
        if (row?.id) setBottling(row);
      }
      setLoadingExisting(false);
    })();
  }, [editId, session, router]);

  // 사진 preview signed URL (photos 변화 시 없는 경로만 발급)
  useEffect(() => {
    const missing = photos.filter((p) => !previewUrls[p]);
    if (missing.length === 0) return;
    (async () => {
      const signed = await postPhotoSignedUrls(missing);
      setPreviewUrls((prev) => {
        const next = { ...prev };
        for (let i = 0; i < missing.length; i++) {
          const u = signed[i];
          if (u) next[missing[i]] = u;
        }
        return next;
      });
    })();
  }, [photos, previewUrls]);

  // 신규 진입 시 bottling prefill
  useEffect(() => {
    if (isEditMode || !bottlingParam) return;
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
  }, [bottlingParam, isEditMode]);

  useEffect(() => {
    if (!pickerOpen) return;
    let cancelled = false;
    setSearching(true);
    const q = searchQ.trim();
    const timer = setTimeout(async () => {
      let query = supabase
        .from("bottling_card_stats")
        .select("id, name, name_kr, distillery_name, distillery_name_kr, country");
      if (q.length > 0) {
        const safe = q.replace(/[%_\\]/g, (m) => `\\${m}`);
        query = query.or(
          `name.ilike.%${safe}%,name_kr.ilike.%${safe}%,distillery_name.ilike.%${safe}%,distillery_name_kr.ilike.%${safe}%`,
        );
      }
      const { data } = await query
        .order("tasting_count", { ascending: false, nullsFirst: false })
        .limit(100);
      if (cancelled) return;
      const rows = (data ?? []) as unknown as PrefillBottling[];
      setSearchResults(rows.filter((r) => r.id));
      setSearching(false);
    }, q.length === 0 ? 0 : 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQ, pickerOpen]);

  function selectBottling(b: PrefillBottling) {
    setBottling(b);
    setPickerOpen(false);
    setSearchQ("");
    setSearchResults([]);
  }

  // 안드로이드 하드웨어 뒤로가기: picker 중이면 picker만 닫기
  useEffect(() => {
    const onBack = () => {
      if (pickerOpen) {
        setPickerOpen(false);
        setSearchQ("");
        setSearchResults([]);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [pickerOpen]);

  // 검색어로 새 위스키 즉시 등록 후 태그 (여기 카탈로그에 없는 위스키 대응)
  const [creatingBottling, setCreatingBottling] = useState(false);
  async function createAndTagBottling() {
    if (!session || creatingBottling) return;
    const name = searchQ.trim();
    if (name.length < 1) return;
    setCreatingBottling(true);
    const { data, error: insertError } = await supabase
      .from("bottlings")
      .insert({
        name,
        name_kr: name,
        created_by: session.user.id,
        cask_type: "unknown",
        bottler: "official",
        bottle_size_ml: 700,
      } as never)
      .select("id")
      .single();
    setCreatingBottling(false);
    if (insertError) {
      Alert.alert("등록 실패", insertError.message);
      return;
    }
    const newId = (data as unknown as { id: string } | null)?.id;
    if (!newId) return;
    // 방금 등록한 것을 pretty display 위해 country는 임의 "other"로
    selectBottling({
      id: newId,
      name,
      name_kr: name,
      distillery_name: "",
      distillery_name_kr: null,
      country: "other" as WhiskyCountry,
    });
  }

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
    if (isEditMode && editId) {
      const { error: updateError } = await supabase.from("posts").update({
        photos,
        body: body.trim() || null,
        visibility,
        bottling_id: bottling?.id ?? null,
        location_name: locationName.trim() || null,
        tags,
      } as never).eq("id", editId).eq("user_id", session.user.id);
      setPending(false);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      router.replace(`/posts/${editId}` as never);
      return;
    }
    const { data, error: insertError } = await supabase.from("posts").insert({
      user_id: session.user.id,
      photos,
      body: body.trim() || null,
      visibility,
      bottling_id: bottling?.id ?? null,
      location_name: locationName.trim() || null,
      tags,
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

  // picker 전면 모드: 검색 UI 하나만 표시 (키보드 가림 방지, 다른 필드 접힘. state는 유지)
  if (pickerOpen) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#0a0a0a" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Stack.Screen options={{ title: "위스키 선택" }} />
        <View style={styles.pickerContainer}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color="#a3a3a3" />
            <TextInput
              value={searchQ}
              onChangeText={setSearchQ}
              placeholder="위스키 이름 or 증류소로 검색"
              placeholderTextColor="#525252"
              autoCapitalize="none"
              autoFocus
              style={styles.searchInput}
            />
            <Pressable onPress={() => { setPickerOpen(false); setSearchQ(""); }} hitSlop={6}>
              <Text style={styles.searchCancel}>취소</Text>
            </Pressable>
          </View>
          <Text style={styles.pickerHint}>
            {searchQ.trim().length === 0 ? `전체 위스키 (인기순 · ${searchResults.length}개)` : searching ? "검색 중…" : `결과 ${searchResults.length}개`}
          </Text>
          <KeyboardAwareScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24, gap: 8 }}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid
            extraScrollHeight={80}
          >
            {/* 검색어 있으면 "이 이름으로 새로 등록" 버튼 */}
            {searchQ.trim().length >= 1 && (
              <Pressable
                onPress={createAndTagBottling}
                disabled={creatingBottling}
                style={({ pressed }) => [
                  styles.createBtn,
                  pressed && { opacity: 0.7 },
                  creatingBottling && { opacity: 0.5 },
                ]}
              >
                <Ionicons name="add-circle-outline" size={16} color="#fbbf24" />
                <Text style={styles.createBtnText} numberOfLines={1}>
                  {creatingBottling ? "등록 중…" : `"${searchQ.trim()}" 새 위스키로 등록해서 태그`}
                </Text>
              </Pressable>
            )}
            {!searching && searchResults.length === 0 && searchQ.trim().length === 0 ? (
              <Text style={styles.hintText}>등록된 위스키가 없어요.</Text>
            ) : (
              <View style={styles.resultList}>
                {searchResults.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => selectBottling(r)}
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0a0a0a" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: isEditMode ? "모먼트 수정" : "새 모먼트" }} />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={80}
      >
        <Text style={styles.lead}>
          지금 마시는 한 잔, 바에 갔던 순간 — 정식 후기는 아니지만 남기고 싶은 기억.
        </Text>

        {/* 사진 */}
        <Field label={`사진 (${photos.length}/${MAX_PHOTOS})`}>
          <View style={styles.photoRow}>
            {photos.map((p, i) => {
              const url = previewUrls[p];
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
        <Field label="위스키 태그 (선택)">
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
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => [styles.pickerBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="search" size={16} color="#fbbf24" />
              <Text style={styles.pickerBtnText}>위스키 검색해서 태그</Text>
            </Pressable>
          )}
        </Field>

        {/* 태그 */}
        <Field label="태그 (선택)">
          <TagInput value={tags} onChange={setTags} />
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
          <Text style={styles.submitText}>{pending ? "저장 중…" : isEditMode ? "수정 저장" : "모먼트 남기기"}</Text>
        </Pressable>

        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancelText}>취소</Text>
        </Pressable>
      </KeyboardAwareScrollView>
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
    borderWidth: 1, borderColor: "rgba(251, 191, 36, 0.35)",
    backgroundColor: "rgba(251, 191, 36, 0.06)",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
  },
  bottlingCardText: { color: "#fde68a", fontSize: 13 },
  bottlingClear: { color: "#fbbf24", fontSize: 18, paddingHorizontal: 4 },

  pickerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12,
    borderWidth: 1, borderColor: "rgba(251, 191, 36, 0.35)",
    borderRadius: 8, backgroundColor: "rgba(251, 191, 36, 0.06)",
  },
  pickerBtnText: { color: "#fbbf24", fontSize: 13, fontWeight: "600" },
  pickerContainer: { flex: 1, padding: 16, gap: 12, backgroundColor: "#0a0a0a" },
  pickerHint: { color: "#737373", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "600" },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#171717", borderWidth: 1, borderColor: "#262626",
    borderRadius: 8, paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1, color: "#fafafa", fontSize: 14,
    paddingVertical: 10,
  },
  searchCancel: { color: "#a3a3a3", fontSize: 12 },
  resultList: {
    borderRadius: 8, borderWidth: 1, borderColor: "#262626",
    backgroundColor: "#111", overflow: "hidden",
  },
  resultItem: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#1f1f1f",
    gap: 2,
  },
  resultTitle: { color: "#fafafa", fontSize: 13, fontWeight: "500" },
  resultSub: { color: "#a3a3a3", fontSize: 11 },
  createBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: "rgba(251, 191, 36, 0.45)",
    borderRadius: 8, backgroundColor: "rgba(251, 191, 36, 0.08)",
  },
  createBtnText: { color: "#fbbf24", fontSize: 13, fontWeight: "600", flex: 1 },

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
