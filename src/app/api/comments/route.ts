import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMMENT_LIMIT = 500;

// GET /api/comments?tasting_id=<uuid>
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tastingId = searchParams.get("tasting_id") ?? "";
  if (!UUID_RE.test(tastingId)) {
    return NextResponse.json({ error: "invalid tasting_id" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: comments, error } = await supabase
    .from("tasting_comments")
    .select("id, body, parent_id, user_id, created_at")
    .eq("tasting_id", tastingId)
    .order("created_at", { ascending: true })
    .limit(COMMENT_LIMIT);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = Array.from(new Set((comments ?? []).map((c) => c.user_id)));
  const profilesById = new Map<
    string,
    { id: string; username: string; display_name: string | null; avatar_url: string | null }
  >();
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", userIds);
    for (const p of profs ?? []) profilesById.set(p.id, p);
  }

  return NextResponse.json(
    {
      comments: (comments ?? []).map((c) => ({
        ...c,
        profile: profilesById.get(c.user_id) ?? null,
      })),
    },
    {
      headers: {
        "Cache-Control": "private, max-age=5, stale-while-revalidate=30",
      },
    },
  );
}
