/* eslint-disable no-console */
//
// Frankfurter (ECB 일일 환율) → currency_rates 테이블 갱신
//
// 사용:
//   npm run seed:fx              # dry-run
//   npm run seed:fx -- --apply
//
// 외부 API: https://api.frankfurter.dev — 무료, 인증 없음, 일일 ECB 데이터
// 한 번 호출로 EUR 기준 모든 통화 가져온 뒤 KRW 기준으로 환산.
//
// 주기: 매일~매주 1회 cron 권장. 환율 변동 미세하면 안 돌려도 OK.
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

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// EUR 기준 fetch → 다른 통화 → KRW 환산을 위해 KRW 포함 4개 통화.
const TARGETS = ["KRW", "USD", "GBP", "JPY"] as const;

type FrankResponse = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

async function fetchFx(): Promise<FrankResponse> {
  const url = `https://api.frankfurter.dev/v1/latest?from=EUR&to=${TARGETS.join(",")}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
  return (await res.json()) as FrankResponse;
}

async function main() {
  console.log("→ Frankfurter 환율 fetch 중…");
  const fx = await fetchFx();
  console.log(`  기준일 ${fx.date} (ECB)`);

  // EUR → X 환율을 X → KRW로 환산
  //   1 EUR = R[X] X
  //   ⇒ 1 X = R[KRW] / R[X] KRW
  const eurToKrw = fx.rates.KRW;
  const rows: { code: string; krw_per_unit: number }[] = [
    { code: "EUR", krw_per_unit: eurToKrw },
    { code: "USD", krw_per_unit: eurToKrw / fx.rates.USD },
    { code: "GBP", krw_per_unit: eurToKrw / fx.rates.GBP },
    { code: "JPY", krw_per_unit: eurToKrw / fx.rates.JPY },
  ].map((r) => ({ code: r.code, krw_per_unit: Math.round(r.krw_per_unit * 10000) / 10000 }));

  console.log("\n환율 (1 X = ? KRW):");
  for (const r of rows) {
    console.log(`  ${r.code} → ${r.krw_per_unit.toLocaleString()} KRW`);
  }

  if (!APPLY) {
    console.log("\n[DRY RUN] upsert 미실행. --apply 붙이세요.");
    return;
  }

  const payload = rows.map((r) => ({
    code: r.code,
    krw_per_unit: r.krw_per_unit,
    fetched_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("currency_rates")
    .upsert(payload, { onConflict: "code" });
  if (error) {
    console.error(`✗ upsert 실패: ${error.message}`);
    process.exit(1);
  }
  console.log(`\n✓ 완료. ${rows.length}개 통화 갱신.`);
}

main().catch((e) => {
  console.error("\n✗ 실패:", e);
  process.exit(1);
});
