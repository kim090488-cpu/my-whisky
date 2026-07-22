import { FollowListPage } from "../_follow-list";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Params = Promise<{ username: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}의 팔로잉 · my-whisky` };
}

export default async function Page({ params }: { params: Params }) {
  const { username } = await params;
  return <FollowListPage username={username} direction="following" />;
}
