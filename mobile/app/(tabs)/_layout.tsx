import { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

const ACCENT = "#fbbf24";
const MUTED = "#737373";
const BG = "#0a0a0a";
const BORDER = "#262626";

const UNREAD_POLL_MS = 45_000;

function useUnreadCount(): number {
  const { session } = useSession();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!session) {
      setCount(0);
      return;
    }
    let cancelled = false;
    async function refresh() {
      const { count: c } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (!cancelled) setCount(c ?? 0);
    }
    refresh();
    const id = setInterval(refresh, UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [session]);

  return count;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // 안드로이드 제스처 바·삼성 네비게이션 바와 겹치지 않도록 하단 inset 만큼 띄움.
  // inset이 0(전통적 네비)인 경우 최소 8px 여백 확보.
  const bottomPadding = Math.max(insets.bottom, 8);
  const unreadCount = useUnreadCount();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: MUTED,
        tabBarStyle: {
          backgroundColor: BG,
          borderTopColor: BORDER,
          height: 56 + bottomPadding,
          paddingTop: 6,
          paddingBottom: bottomPadding,
        },
        tabBarLabelStyle: { fontSize: 11 },
        tabBarItemStyle: { paddingVertical: 0 },
        headerStyle: { backgroundColor: BG },
        headerTintColor: "#f5f5f5",
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="whiskies"
        options={{
          title: "위스키",
          tabBarIcon: ({ color }) => <Ionicons name="wine-outline" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: "컬렉션",
          tabBarIcon: ({ color }) => <Ionicons name="bookmark-outline" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: "피드",
          tabBarIcon: ({ color }) => <Ionicons name="newspaper-outline" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "내정보",
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" color={color} size={22} />,
          tabBarBadge: unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: ACCENT,
            color: "#0a0a0a",
            fontSize: 10,
            minWidth: 16,
            height: 16,
            lineHeight: 16,
          },
        }}
      />
    </Tabs>
  );
}
