import { useLocalSearchParams } from "expo-router";
import { FollowList } from "./_follow-list";

export default function FollowersScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  return <FollowList username={username ?? ""} direction="followers" />;
}
