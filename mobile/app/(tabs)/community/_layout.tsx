import { Stack } from "expo-router";

export default function CommunityStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0a0a0a" },
        headerTintColor: "#f5f5f5",
        headerTitleStyle: { fontWeight: "600" },
        contentStyle: { backgroundColor: "#0a0a0a" },
        headerBackTitle: "뒤로",
      }}
    >
      <Stack.Screen name="index" options={{ title: "커뮤니티" }} />
      <Stack.Screen name="[id]" options={{ title: "게시글" }} />
      <Stack.Screen name="new" options={{ title: "새 게시글", presentation: "modal" }} />
    </Stack>
  );
}
