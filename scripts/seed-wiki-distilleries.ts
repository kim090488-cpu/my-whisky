/* eslint-disable no-console */
//
// Wikidata SPARQL → distilleries 시드 import.
//
// 사용:
//   npm run seed:wiki        # dry-run (insert 안 함, 미리보기)
//   npm run seed:wiki -- --apply
//
// 환경:
//   .env.local 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요.
//   service_role 키 — RLS 우회. created_by = NULL (시스템 등록).
//
// 데이터:
//   Q10373548 (whisky distillery)의 P31/P279* 인스턴스 + 서브클래스 모두.
//   ISO 국가코드(P297)로 우리 enum 매핑. 매핑 안 되는 국가는 스킵.
//   GB는 일단 'scotland'로 — 영국 증류소 대부분 스카치라서.
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

type WhiskyCountry =
  | "scotland" | "ireland" | "usa" | "canada" | "japan" | "india"
  | "taiwan" | "australia" | "france" | "sweden" | "germany" | "south_korea" | "other";

// ISO 3166-1 alpha-2 → 우리 enum
const ISO_TO_COUNTRY: Record<string, WhiskyCountry> = {
  GB: "scotland",
  IE: "ireland",
  US: "usa",
  CA: "canada",
  JP: "japan",
  IN: "india",
  TW: "taiwan",
  AU: "australia",
  FR: "france",
  SE: "sweden",
  DE: "germany",
  KR: "south_korea",
};

const SPARQL = `
SELECT DISTINCT ?distillery ?distilleryLabel ?countryCode ?coords ?founded ?website WHERE {
  ?distillery wdt:P31/wdt:P279* wd:Q10373548.
  OPTIONAL {
    ?distillery wdt:P17 ?country.
    ?country wdt:P297 ?countryCode.
  }
  OPTIONAL { ?distillery wdt:P625 ?coords. }
  OPTIONAL { ?distillery wdt:P571 ?founded. }
  OPTIONAL { ?distillery wdt:P856 ?website. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 1000
`.trim();

type SparqlBinding = {
  distillery?: { value: string };
  distilleryLabel?: { value: string };
  countryCode?: { value: string };
  coords?: { value: string };
  founded?: { value: string };
  website?: { value: string };
};

async function fetchWikidata(): Promise<SparqlBinding[]> {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(SPARQL)}`;
  console.log("→ Wikidata SPARQL 호출 중…");
  const res = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "my-whisky-seed/0.1 (https://github.com/kim090488/my-whisky)",
    },
  });
  if (!res.ok) {
    throw new Error(`Wikidata 응답 ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = (await res.json()) as { results: { bindings: SparqlBinding[] } };
  return data.results.bindings;
}

type Row = {
  name: string;
  country: WhiskyCountry;
  founded_year: number | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
};

function transform(bindings: SparqlBinding[]) {
  const out: Row[] = [];
  const stats = { noLabel: 0, noCountry: 0, badLabel: 0 };

  for (const r of bindings) {
    const name = r.distilleryLabel?.value?.trim();
    if (!name) { stats.noLabel++; continue; }
    if (/^Q\d+$/.test(name)) { stats.badLabel++; continue; } // 라벨 없으면 Qid가 들어옴
    if (name.length > 100) { stats.badLabel++; continue; }

    const code = r.countryCode?.value;
    const country = code ? ISO_TO_COUNTRY[code] : undefined;
    if (!country) { stats.noCountry++; continue; }

    let founded_year: number | null = null;
    if (r.founded?.value) {
      const m = r.founded.value.match(/^([-]?\d+)/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n) && n > 1500 && n < 2100) founded_year = n;
      }
    }

    let lat: number | null = null;
    let lng: number | null = null;
    if (r.coords?.value) {
      const m = r.coords.value.match(/Point\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/);
      if (m) {
        lng = parseFloat(m[1]);
        lat = parseFloat(m[2]);
      }
    }

    out.push({
      name,
      country,
      founded_year,
      lat,
      lng,
      website: r.website?.value ?? null,
    });
  }

  return { out, stats };
}

function summarize(rows: Row[]) {
  const byCountry = new Map<WhiskyCountry, number>();
  for (const r of rows) byCountry.set(r.country, (byCountry.get(r.country) ?? 0) + 1);
  return [...byCountry.entries()].sort((a, b) => b[1] - a[1]);
}

async function main() {
  const bindings = await fetchWikidata();
  console.log(`  Wikidata 결과 ${bindings.length}개`);

  const { out: candidates, stats } = transform(bindings);
  console.log(
    `  파싱 ${candidates.length}개 (스킵: 라벨없음 ${stats.noLabel}, 잘못된라벨 ${stats.badLabel}, 매핑안된국가 ${stats.noCountry})`,
  );

  console.log("\n국가별 카운트:");
  for (const [c, n] of summarize(candidates)) console.log(`  ${c.padEnd(14)} ${n}`);

  // 기존 (name lower, country) 가져와서 중복 필터
  console.log("\n→ 기존 distilleries 조회 중…");
  const { data: existing, error: exErr } = await supabase
    .from("distilleries")
    .select("name, country");
  if (exErr) throw new Error(`기존 조회 실패: ${exErr.message}`);
  const existingKeys = new Set((existing ?? []).map((e) => `${e.name.toLowerCase()}|${e.country}`));
  console.log(`  기존 ${existing?.length ?? 0}개`);

  const toInsert = candidates.filter((c) => !existingKeys.has(`${c.name.toLowerCase()}|${c.country}`));
  console.log(`  신규 ${toInsert.length}개 (중복 ${candidates.length - toInsert.length} 스킵)`);

  if (!APPLY) {
    console.log("\n[DRY RUN] 실제 insert 안 했습니다. --apply 붙여서 다시 실행하세요.");
    console.log("샘플 5개:");
    for (const r of toInsert.slice(0, 5)) {
      console.log("  ", JSON.stringify(r));
    }
    return;
  }

  const BATCH = 50;
  let inserted = 0;
  let errors = 0;
  console.log(`\n→ ${Math.ceil(toInsert.length / BATCH)} 배치 INSERT 시작…`);
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error, data } = await supabase
      .from("distilleries")
      .insert(batch)
      .select("id");
    if (error) {
      console.error(`  배치 ${i / BATCH + 1} 실패: ${error.message}`);
      errors++;
      continue;
    }
    inserted += data?.length ?? batch.length;
  }
  console.log(`\n✓ 완료. inserted ${inserted}, errors ${errors}.`);
}

main().catch((e) => {
  console.error("\n✗ 실패:", e);
  process.exit(1);
});
