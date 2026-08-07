import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/lib/auth-context";

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
          <Stack.Screen name="settings/delete-account" options={{ title: "계정 삭제" }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
