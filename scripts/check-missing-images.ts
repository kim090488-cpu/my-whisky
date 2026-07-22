import path from "node:path";
import { config } from "dotenv";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  // 랭킹 상위 인기 보틀링 (avg_score 기준)
  const { data: ranking } = await supabase
    .from("bottling_card_stats")
    .select("id, name, distillery_name, label_image_url, avg_score, tasting_count")
    .gt("tasting_count", 0)
    .order("avg_score", { ascending: false, nullsFirst: false })
    .order("tasting_count", { ascending: false })
    .limit(8);

  console.log("\n━━━ /ranking 인기 보틀링 ━━━");
  for (const b of ranking ?? []) {
    const has = b.label_image_url ? "✓" : "✗ NULL";
    console.log(`  ${has}  ${b.distillery_name} · ${b.name}  (avg ${b.avg_score}, ${b.tasting_count}건)`);
  }

  // 그 중 외부리뷰 있는데 image_url이 null인 거 있나?
  const missingIds = (ranking ?? []).filter((b) => !b.label_image_url).map((b) => b.id);
  if (missingIds.length === 0) {
    console.log("\n모두 이미지 있음");
    return;
  }

  const { data: ext } = await supabase
    .from("bottling_external_reviews")
    .select("bottling_id, source, image_url, source_url")
    .in("bottling_id", missingIds);

  console.log("\n━━━ 라벨없음 보틀의 외부 리뷰 상태 ━━━");
  for (const id of missingIds) {
    const rev = (ext ?? []).filter((e) => e.bottling_id === id);
    if (rev.length === 0) {
      console.log(`  ${id}: 외부 리뷰 entry 없음`);
    } else {
      for (const r of rev) {
        console.log(`  ${id}: source=${r.source}, image_url=${r.image_url ?? "NULL"}, source_url=${r.source_url}`);
      }
    }
  }
}

main();
