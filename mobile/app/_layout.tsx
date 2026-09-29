import { Stack, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { SessionProvider } from "@/lib/auth-context";

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const version = Constants.expoConfig?.version ?? "";
  return (
    <SafeAreaProvider>
      <SafeAreaView style={errorStyles.root}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={errorStyles.container}>
          <Text style={errorStyles.title}>문제가 생겼어요</Text>
          <Text style={errorStyles.subtitle}>
            잠깐의 오류가 있었어요. 아래 버튼을 눌러 다시 시도해 주세요.{"\n"}
            문제가 반복되면 앱을 완전히 종료했다가 다시 켜주세요.
          </Text>
          {__DEV__ && error?.message ? (
            <View style={errorStyles.errorBox}>
              <Text style={errorStyles.errorText}>{error.message}</Text>
            </View>
          ) : null}
          <Pressable
            style={({ pressed }) => [errorStyles.button, pressed && errorStyles.buttonPressed]}
            onPress={retry}
          >
            <Text style={errorStyles.buttonText}>다시 시도</Text>
          </Pressable>
          {version ? <Text style={errorStyles.version}>my-whisky v{version}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const errorStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0a0a" },
  container: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 14 },
  title: { fontSize: 22, fontWeight: "700", color: "#fafafa", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#a3a3a3", textAlign: "center", lineHeight: 21 },
  errorBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#262626",
    backgroundColor: "#111",
  },
  errorText: { color: "#fca5a5", fontSize: 12, fontFamily: "monospace" },
  button: {
    marginTop: 16,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#fbbf24",
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: "#0a0a0a", fontSize: 15, fontWeight: "700" },
  version: { marginTop: 24, fontSize: 11, color: "#525252", textAlign: "center" },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: "#0a0a0a" },
            headerTintColor: "#f5f5f5",
            headerTitleStyle: { fontWeight: "600" },
            contentStyle: { backgroundColor: "#0a0a0a" },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="profile/[username]/index" options={{ title: "" }} />
          <Stack.Screen name="profile/[username]/followers" options={{ title: "팔로워" }} />
          <Stack.Screen name="profile/[username]/following" options={{ title: "팔로잉" }} />
          <Stack.Screen name="ranking" options={{ title: "랭킹" }} />
          <Stack.Screen name="picks" options={{ title: "맞춤 추천" }} />
          <Stack.Screen name="distilleries/index" options={{ title: "증류소" }} />
          <Stack.Screen name="distilleries/[id]" options={{ title: "" }} />
          <Stack.Screen name="tastings/index" options={{ title: "테이스팅 노트" }} />
          <Stack.Screen name="tastings/[id]/index" options={{ title: "노트" }} />
          <Stack.Screen name="tastings/[id]/edit" options={{ title: "노트 수정" }} />
          <Stack.Screen name="notifications" options={{ title: "알림" }} />
          <Stack.Screen name="posts/index" options={{ title: "모먼트" }} />
          <Stack.Screen name="posts/[id]" options={{ title: "모먼트" }} />
          <Stack.Screen name="posts/new" options={{ title: "새 모먼트" }} />
          <Stack.Screen name="notification-settings" options={{ title: "알림 설정" }} />
          <Stack.Screen name="curator" options={{ title: "AI 큐레이터" }} />
          <Stack.Screen name="settings/profile-edit" options={{ title: "프로필 편집" }} />
          <Stack.Screen name="settings/feedback" options={{ title: "문의·건의" }} />
          <Stack.Screen name="settings/delete-account" options={{ title: "계정 삭제" }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
