/* eslint-disable no-console */
//
// whiskyhunter.net /api/distillery_data/<slug>/ → distillery_auction_stats upsert
//
// 사용:
//   npm run seed:whiskyhunter:stats              # dry-run (한 슬러그 샘플만 fetch)
//   npm run seed:whiskyhunter:stats -- --apply
//
// 처리:
//   1. whiskyhunter_slug 박힌 distilleries 전체 조회
//   2. 각 slug마다 /api/distillery_data/<slug>/ fetch (월별 행 배열)
//   3. distillery_auction_stats에 upsert (PK: distillery_id, dt, source='whiskyhunter')
//
// 호스트 부담 안 주려고 요청 사이 200ms 슬립. 200개 증류소 = 약 40초.
// 멱등: PK 충돌 시 upsert로 갱신.
//

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗ .env.local 에 NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 가 필요해요.");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const UA = "my-whisky-seed/0.1 (https://github.com/kim090488/my-whisky)";
const REQUEST_DELAY_MS = 200;
const SOURCE = "whiskyhunter";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

type WhStatRow = {
  dt: string;
  winning_bid_max: number | null;
  winning_bid_min: number | null;
  winning_bid_mean: number | null;
  trading_volume: number | null;
  lots_count: number | null;
};

type DistilleryRef = { id: string; name: string; whiskyhunter_slug: string };

async function loadLinkedDistilleries(): Promise<DistilleryRef[]> {
  const { data, error } = await supabase
    .from("distilleries")
    .select("id, name, whiskyhunter_slug")
    .not("whiskyhunter_slug", "is", null)
    .order("name");
  if (error) throw new Error(`distilleries 조회 실패: ${error.message}`);
  return (data ?? []).filter((d): d is DistilleryRef => d.whiskyhunter_slug !== null);
}

async function fetchOne(slug: string): Promise<WhStatRow[]> {
  const res = await fetch(`https://whiskyhunter.net/api/distillery_data/${slug}/`, {
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as WhStatRow[];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const linked = await loadLinkedDistilleries();
  console.log(`whiskyhunter_slug 박힌 distilleries ${linked.length}개`);

  if (linked.length === 0) {
    console.log("\n→ seed-whiskyhunter-distilleries 먼저 돌려서 slug 채우세요.");
    return;
  }

  if (!APPLY) {
    // dry-run: 첫 슬러그 하나만 fetch해서 데이터 모양 확인
    const sample = linked[0];
    console.log(`\n[DRY RUN] 샘플 fetch: ${sample.name} (slug=${sample.whiskyhunter_slug})`);
    try {
      const rows = await fetchOne(sample.whiskyhunter_slug);
      console.log(`  ${rows.length}행 받음. 최신 3개:`);
      for (const r of rows.slice(0, 3)) {
        console.log(`    ${r.dt}  mean=${r.winning_bid_mean}  min=${r.winning_bid_min}  max=${r.winning_bid_max}  lots=${r.lots_count}`);
      }
      console.log(`\n예상 upsert 총량: ${linked.length}개 distillery × 평균 ~200월 = 수만 row.`);
      console.log("--apply 붙이면 진행합니다.");
    } catch (e) {
      console.error(`  fetch 실패: ${e instanceof Error ? e.message : e}`);
    }
    return;
  }

  let ok = 0;
  let fetchErr = 0;
  let upsertErr = 0;
  let totalRows = 0;

  for (let i = 0; i < linked.length; i++) {
    const d = linked[i];
    const tag = `[${i + 1}/${linked.length}] ${d.name}`;

    let rows: WhStatRow[];
    try {
      rows = await fetchOne(d.whiskyhunter_slug);
    } catch (e) {
      console.error(`  ✗ ${tag} fetch 실패: ${e instanceof Error ? e.message : e}`);
      fetchErr++;
      await sleep(REQUEST_DELAY_MS);
      continue;
    }

    if (rows.length === 0) {
      console.log(`  · ${tag} 데이터 없음`);
      await sleep(REQUEST_DELAY_MS);
      continue;
    }

    const payload = rows.map((r) => ({
      distillery_id: d.id,
      dt: r.dt,
      source: SOURCE,
      winning_bid_mean: r.winning_bid_mean,
      winning_bid_min: r.winning_bid_min,
      winning_bid_max: r.winning_bid_max,
      trading_volume: r.trading_volume,
      lots_count: r.lots_count,
      fetched_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("distillery_auction_stats")
      .upsert(payload, { onConflict: "distillery_id,dt,source" });

    if (error) {
      console.error(`  ✗ ${tag} upsert 실패: ${error.message}`);
      upsertErr++;
    } else {
      ok++;
      totalRows += payload.length;
      if (i % 20 === 0) console.log(`  ✓ ${tag} (${payload.length}월) — 누적 ${totalRows}행`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\n✓ 완료. 성공 ${ok}, fetch 실패 ${fetchErr}, upsert 실패 ${upsertErr}, 총 upsert ${totalRows}행.`);
}

main().catch((e) => {
  console.error("\n✗ 실패:", e);
  process.exit(1);
});
