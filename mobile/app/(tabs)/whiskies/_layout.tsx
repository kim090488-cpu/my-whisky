import { Stack } from "expo-router";

export default function WhiskiesStackLayout() {
  return (
    <Stack
      initialRouteName="index"
      screenOptions={{
        headerStyle: { backgroundColor: "#0a0a0a" },
        headerTintColor: "#f5f5f5",
        headerTitleStyle: { fontWeight: "600" },
        contentStyle: { backgroundColor: "#0a0a0a" },
        headerBackTitle: "뒤로",
      }}
    >
      <Stack.Screen name="index" options={{ title: "위스키" }} />
      <Stack.Screen name="[id]/index" options={{ title: "" }} />
      <Stack.Screen
        name="[id]/new-tasting"
        options={{ title: "테이스팅 작성", presentation: "modal" }}
      />
      <Stack.Screen
        name="[id]/edit"
        options={{ title: "위스키 정보 수정", presentation: "modal" }}
      />
      <Stack.Screen name="[id]/history" options={{ title: "수정 이력" }} />
      <Stack.Screen
        name="scan"
        options={{ title: "바코드 스캔", presentation: "modal" }}
      />
      <Stack.Screen name="new" options={{ title: "새 위스키 등록", presentation: "modal" }} />
      <Stack.Screen name="link-barcode" options={{ title: "바코드 연결", presentation: "modal" }} />
      <Stack.Screen name="compare" options={{ title: "위스키 비교" }} />
    </Stack>
  );
}
