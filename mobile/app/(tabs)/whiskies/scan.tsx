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

    const { data: bottling } = await supabase
      .from("bottlings")
      .select("id, name")
      .eq("barcode", data)
      .maybeSingle();

    setLookup(false);

    if (bottling) {
      router.replace(`/whiskies/${bottling.id}`);
      return;
    }

    Alert.alert(
      "찾을 수 없어요",
      `바코드: ${data}\n이 보틀링은 아직 등록돼 있지 않아요.`,
      [
        { text: "다시 스캔", onPress: () => { lastCodeRef.current = null; setScanning(true); } },
        { text: "닫기", onPress: () => router.back(), style: "cancel" },
      ],
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
