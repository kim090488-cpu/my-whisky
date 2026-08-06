import { useState, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [lookup, setLookup] = useState(false);
  const lastCodeRef = useRef<string | null>(null);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fbbf24" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "바코드 스캔" }} />
        <Text style={styles.message}>카메라 권한이 필요해요.</Text>
        <Pressable
          onPress={requestPermission}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.primaryBtnText}>권한 허용</Text>
        </Pressable>
      </View>
    );
  }

  async function onScanned(data: string) {
    if (lookup || data === lastCodeRef.current) return;
    lastCodeRef.current = data;
    setScanning(false);
    setLookup(true);
    console.log("[scan] barcode scanned:", data, "length:", data.length);

    const { data: match, error: lookupError } = await supabase
      .from("bottling_barcodes")
      .select("bottling_id")
      .eq("barcode", data)
      .maybeSingle();
    const matched = match as unknown as { bottling_id: string } | null;
    console.log("[scan] lookup result:", matched ? `found bottling_id=${matched.bottling_id}` : "not found", "error:", lookupError?.message ?? "none");

    setLookup(false);

    if (matched) {
      router.replace(`/whiskies/${matched.bottling_id}` as never);
      return;
    }

    const resumeScanning = () => { lastCodeRef.current = null; setScanning(true); };
    Alert.alert(
      "미등록 바코드",
      `바코드: ${data}\n\n이미 카탈로그에 있는 위스키라면 "기존 위스키에 연결"을,\n처음 등록하는 위스키라면 "새 위스키로 등록"을 선택하세요.`,
      [
        { text: "다시 스캔", onPress: resumeScanning },
        {
          text: "기존 위스키에 연결",
          onPress: () => router.replace(`/(tabs)/whiskies/link-barcode?barcode=${encodeURIComponent(data)}` as never),
        },
        {
          text: "새 위스키로 등록",
          onPress: () => router.replace(`/(tabs)/whiskies/new?barcode=${encodeURIComponent(data)}` as never),
        },
      ],
      { onDismiss: resumeScanning },
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <Stack.Screen options={{ title: "바코드 스캔" }} />
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={scanning ? (r) => onScanned(r.data) : undefined}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"],
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.reticle} />
          <Text style={styles.hintText}>
            {lookup ? "조회 중…" : "병 바코드를 사각형 안에 맞춰주세요"}
          </Text>
        </View>
      </CameraView>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.closeBtnText}>닫기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a", padding: 24, gap: 14 },
  message: { color: "#fafafa", fontSize: 14, textAlign: "center" },
  primaryBtn: {
    backgroundColor: "#fbbf24", paddingHorizontal: 24, paddingVertical: 11, borderRadius: 8,
  },
  primaryBtnText: { color: "#0a0a0a", fontWeight: "600" },

  overlay: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 },
  reticle: {
    width: 260, height: 160, borderWidth: 2, borderColor: "#fbbf24", borderRadius: 12,
    backgroundColor: "transparent",
  },
  hintText: {
    color: "#fde68a", marginTop: 18, fontSize: 13,
    backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
  },

  closeBtn: {
    position: "absolute", bottom: 32, alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8,
  },
  closeBtnText: { color: "#fafafa", fontSize: 14 },
});
