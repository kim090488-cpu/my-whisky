import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      console.log("[callback] params:", JSON.stringify(params));
      if (params.error_description) {
        setError(String(params.error_description));
        return;
      }
      const code = typeof params.code === "string" ? params.code : null;
      if (!code) {
        console.log("[callback] no code, redirecting to /me");
        router.replace("/(tabs)/me");
        return;
      }
      console.log("[callback] exchanging code:", code);
      const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeErr) {
        console.log("[callback] exchange error:", exchangeErr.message);
        setError(exchangeErr.message);
        return;
      }
      console.log("[callback] exchange success, redirecting to /me");
      router.replace("/(tabs)/me");
    })();
  }, [params.code, params.error_description, router]);

  return (
    <View style={styles.center}>
      {error ? (
        <>
          <Text style={styles.errorTitle}>로그인 실패</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text
            style={styles.link}
            onPress={() => router.replace("/(tabs)/me")}
          >
            돌아가기
          </Text>
        </>
      ) : (
        <>
          <ActivityIndicator color="#fbbf24" />
          <Text style={styles.hint}>로그인 완료 중…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
  },
  hint: { color: "#a3a3a3", fontSize: 14 },
  errorTitle: { color: "#fca5a5", fontSize: 18, fontWeight: "600" },
  errorText: { color: "#a3a3a3", fontSize: 13, textAlign: "center" },
  link: { color: "#fbbf24", fontSize: 14, marginTop: 12 },
});
