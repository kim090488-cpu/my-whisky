import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const alt = "테이스팅 노트";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: Promise<{ id: string }> };

export default async function OgImage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS — anon (crawler)는 public만 볼 수 있음. 그 외엔 fallback.
  const { data: t } = await supabase
    .from("tastings")
    .select("score, bottling_id, user_id")
    .eq("id", id)
    .maybeSingle();

  let topLine = "Tasting Note";
  let title = "my-whisky";
  let scoreText = "—";
  let author = "anonymous";

  if (t) {
    const [bRes, pRes] = await Promise.all([
      supabase
        .from("bottling_card_stats")
        .select("name, name_kr, distillery_name, distillery_name_kr")
        .eq("id", t.bottling_id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", t.user_id)
        .maybeSingle(),
    ]);
    if (bRes.data) {
      topLine = bRes.data.distillery_name_kr ?? bRes.data.distillery_name;
      title = bRes.data.name_kr ?? bRes.data.name;
    }
    if (t.score !== null && t.score !== undefined) scoreText = String(t.score);
    if (pRes.data) author = pRes.data.display_name ?? pRes.data.username;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1c1408 100%)",
          color: "white",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            color: "#fbbf24",
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: -0.5,
          }}
        >
          my-whisky
        </div>

        <div style={{ marginTop: 56, fontSize: 32, color: "#a3a3a3" }}>{topLine}</div>
        <div
          style={{
            marginTop: 8,
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: -1,
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: 28, color: "#737373", display: "flex" }}>
            by {author}
          </div>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <div
              style={{
                fontSize: 160,
                fontWeight: 800,
                color: "#fbbf24",
                lineHeight: 1,
                letterSpacing: -4,
              }}
            >
              {scoreText}
            </div>
            {scoreText !== "—" && (
              <div style={{ fontSize: 36, color: "#737373", marginLeft: 10 }}>/ 100</div>
            )}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
