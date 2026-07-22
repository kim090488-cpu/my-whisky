/* eslint-disable no-console */
//
// whiskyhunter.net /api/distilleries_info/ → distilleries 매핑/확장
//
// 사용:
//   npm run seed:whiskyhunter           # dry-run
//   npm run seed:whiskyhunter -- --apply
//
// 처리:
//   1. /api/distilleries_info/ fetch (name, slug, country)
//   2. 이름·국가로 기존 distilleries 매칭 → whiskyhunter_slug 채움
//   3. 매칭 없으면 새로 insert (name + country + whiskyhunter_slug)
//
// 멱등: whiskyhunter_slug unique 제약. 재실행해도 같은 결과.
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

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

type WhiskyCountry =
  | "scotland" | "ireland" | "usa" | "canada" | "japan" | "india"
  | "taiwan" | "australia" | "france" | "sweden" | "germany" | "south_korea" | "other";

// whiskyhunter country 문자열 → 우리 enum.
// API가 영어 풀네임으로 주는데 정확한 표기 다 확인 못 함 → 정규화 후 비교.
const COUNTRY_MAP: Record<string, WhiskyCountry> = {
  scotland: "scotland",
  ireland: "ireland",
  "united states": "usa",
  "united states of america": "usa",
  usa: "usa",
  canada: "canada",
  japan: "japan",
  india: "india",
  taiwan: "taiwan",
  australia: "australia",
  france: "france",
  sweden: "sweden",
  germany: "germany",
  "south korea": "south_korea",
  korea: "south_korea",
  // 나머지는 "other"로 폴백 (영국 외 잉글랜드·웨일즈는 정확 매핑 없음 → other로)
};

type WhRow = { name: string; slug: string; country: string };

async function fetchWhiskyhunter(): Promise<WhRow[]> {
  console.log("→ whiskyhunter /api/distilleries_info/ 호출 중…");
  const res = await fetch("https://whiskyhunter.net/api/distilleries_info/", {
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (!res.ok) {
    throw new Error(`whiskyhunter 응답 ${res.status}`);
  }
  return (await res.json()) as WhRow[];
}

// 이름 정규화: 매칭 robust하게.
//   "The Macallan" / "Macallan" / "MACALLAN" / "Macallan Distillery" → "macallan"
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/^the\s+/i, "")
    .replace(/\s+distillery$/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function mapCountry(raw: string): WhiskyCountry {
  const key = raw.trim().toLowerCase();
  return COUNTRY_MAP[key] ?? "other";
}

type DbRow = { id: string; name: string; country: WhiskyCountry; whiskyhunter_slug: string | null };

async function loadExisting(): Promise<DbRow[]> {
  const all: DbRow[] = [];
  // pagesize default cap = 1000. 현재 distilleries 천 단위라 한 번에 fetch 가능하지만 안전하게 페이지네이션.
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("distilleries")
      .select("id, name, country, whiskyhunter_slug")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`distilleries 조회 실패: ${error.message}`);
    const rows = (data ?? []) as DbRow[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  const wh = await fetchWhiskyhunter();
  console.log(`  whiskyhunter ${wh.length}개`);

  const existing = await loadExisting();
  console.log(`  기존 distilleries ${existing.length}개`);

  // 이름+국가 인덱스 (정규화 키). 같은 정규화 이름이 여러 국가에 있을 수 있어 country도 포함.
  // 같은 (norm, country)에 다중 행 있으면 첫 번째만 사용 (드물지만 가능).
  const byKey = new Map<string, DbRow>();
  for (const d of existing) {
    const k = `${normalizeName(d.name)}|${d.country}`;
    if (!byKey.has(k)) byKey.set(k, d);
  }

  // 기존 slug → 행 (재실행 시 같은 slug 다시 안 건드리게)
  const bySlug = new Map<string, DbRow>();
  for (const d of existing) {
    if (d.whiskyhunter_slug) bySlug.set(d.whiskyhunter_slug, d);
  }

  type Plan =
    | { kind: "skip-already-linked"; slug: string }
    | { kind: "update"; id: string; slug: string; existingName: string; whName: string }
    | { kind: "insert"; name: string; country: WhiskyCountry; slug: string }
    | { kind: "skip-country"; name: string; rawCountry: string };

  const plans: Plan[] = [];
  const unmappedCountries = new Map<string, number>();

  for (const r of wh) {
    if (bySlug.has(r.slug)) {
      plans.push({ kind: "skip-already-linked", slug: r.slug });
      continue;
    }

    const country = mapCountry(r.country);
    if (country === "other" && !["other"].includes(r.country.toLowerCase())) {
      unmappedCountries.set(r.country, (unmappedCountries.get(r.country) ?? 0) + 1);
    }

    const k = `${normalizeName(r.name)}|${country}`;
    const match = byKey.get(k);
    if (match) {
      if (match.whiskyhunter_slug && match.whiskyhunter_slug !== r.slug) {
        // 이미 다른 slug 박혀있음 — 충돌. skip하고 경고.
        console.warn(`  ! ${match.name} (${country}) 이미 slug "${match.whiskyhunter_slug}" — "${r.slug}" 무시`);
        continue;
      }
      plans.push({ kind: "update", id: match.id, slug: r.slug, existingName: match.name, whName: r.name });
    } else {
      plans.push({ kind: "insert", name: r.name, country, slug: r.slug });
    }
  }

  const counts = {
    alreadyLinked: plans.filter((p) => p.kind === "skip-already-linked").length,
    update: plans.filter((p) => p.kind === "update").length,
    insert: plans.filter((p) => p.kind === "insert").length,
  };
  console.log("\n계획:");
  console.log(`  이미 연결됨 (skip)     ${counts.alreadyLinked}`);
  console.log(`  기존 매칭 → slug 채움   ${counts.update}`);
  console.log(`  새 distillery insert    ${counts.insert}`);

  if (unmappedCountries.size > 0) {
    console.log("\n매핑 안 된 country (→ other로 처리):");
    for (const [c, n] of [...unmappedCountries.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${c.padEnd(25)} ${n}`);
    }
  }

  if (!APPLY) {
    console.log("\n[DRY RUN] insert/update 미실행. --apply 붙이세요.");
    console.log("\n샘플 update 5개:");
    for (const p of plans.filter((p): p is Extract<Plan, { kind: "update" }> => p.kind === "update").slice(0, 5)) {
      console.log(`  ${p.existingName.padEnd(30)} ← ${p.whName} (${p.slug})`);
    }
    console.log("\n샘플 insert 5개:");
    for (const p of plans.filter((p): p is Extract<Plan, { kind: "insert" }> => p.kind === "insert").slice(0, 5)) {
      console.log(`  ${p.name.padEnd(30)} ${p.country.padEnd(12)} ${p.slug}`);
    }
    return;
  }

  // UPDATE: 한 건씩 (Supabase 일괄 update 까다로워서, 수십~수백 건이라 충분)
  let updated = 0;
  let updateErr = 0;
  for (const p of plans) {
    if (p.kind !== "update") continue;
    const { error } = await supabase
      .from("distilleries")
      .update({ whiskyhunter_slug: p.slug })
      .eq("id", p.id);
    if (error) {
      console.error(`  update 실패 ${p.existingName}: ${error.message}`);
      updateErr++;
    } else {
      updated++;
    }
  }

  // INSERT: 50개 배치
  const inserts = plans.filter((p): p is Extract<Plan, { kind: "insert" }> => p.kind === "insert");
  let inserted = 0;
  let insertErr = 0;
  const BATCH = 50;
  for (let i = 0; i < inserts.length; i += BATCH) {
    const batch = inserts.slice(i, i + BATCH).map((p) => ({
      name: p.name,
      country: p.country,
      whiskyhunter_slug: p.slug,
    }));
    const { error, data } = await supabase
      .from("distilleries")
      .insert(batch)
      .select("id");
    if (error) {
      console.error(`  insert 배치 ${i / BATCH + 1} 실패: ${error.message}`);
      insertErr++;
      continue;
    }
    inserted += data?.length ?? batch.length;
  }

  console.log(`\n✓ 완료. updated ${updated} (err ${updateErr}), inserted ${inserted} (err ${insertErr}).`);
}

main().catch((e) => {
  console.error("\n✗ 실패:", e);
  process.exit(1);
});
