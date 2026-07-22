/* eslint-disable no-console */
//
// thewhiskyedition.com /api/whisky-reviews → bottlings + bottling_external_reviews 시드
//
// 사용:
//   npm run seed:whisky-edition              # dry-run (list만 fetch, 매칭 리포트)
//   npm run seed:whisky-edition -- --apply
//
// 처리:
//   1. /api/whisky-reviews?per_page=100&page=N 전부 fetch (~523개)
//   2. 각 리뷰:
//      a) 국가 enum 매핑
//      b) 증류소 lookup (정규화 이름+국가). 없으면 insert.
//      c) bottling 매칭:
//         - 기존 external_reviews(source='whisky_edition', external_slug=X) 있으면 그 bottling_id 사용
//         - 없으면 새 bottling insert
//      d) /api/whisky-reviews/{slug} 상세 fetch → 노트·결론 채워서 external_reviews upsert
//   3. 라이선스: source_url 통해 출처 노출 (DB에 저장, UI에서 사용)
//
// 멱등: (source, external_slug) unique. 재실행해도 같은 결과.
// 라이선스: 이용 시 WHISKY:EDITION 출처 링크 필수 — 카드 UI에서 처리.
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
const BASE = "https://thewhiskyedition.com";
const SOURCE = "whisky_edition";
const DETAIL_DELAY_MS = 150;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

type WhiskyCountry =
  | "scotland" | "ireland" | "usa" | "canada" | "japan" | "india"
  | "taiwan" | "australia" | "france" | "sweden" | "germany" | "south_korea" | "other";

type BottlerKind = "official" | "independent" | "private";

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
};

type WeSummary = {
  id: number;
  slug: string;
  lang: string;
  name: string;
  description?: string;
  image?: { url: string; alt?: string };
  authors?: string[];
  published_at?: string;
  url?: string;
  metadata: {
    type?: string;
    country?: string;
    region?: string;
    distillery?: string;
    bottler?: string;
    age?: number;
    abv?: number;
    price_per_liter?: number;
    flavour?: string;
  };
  rating?: {
    marcel?: number;
    sascha?: number;
    value_for_money?: number;
  };
};

type WeDetail = WeSummary & {
  tasting_notes?: { nose?: string; palate?: string; finish?: string };
  conclusion?: { marcel?: string; sascha?: string };
};

type WeListResponse = {
  ok: boolean;
  lang: string;
  count: number;
  total: number;
  page: number;
  per_page: number;
  items: WeSummary[];
};

async function fetchList(page: number, perPage: number): Promise<WeListResponse> {
  const res = await fetch(`${BASE}/api/whisky-reviews?per_page=${perPage}&page=${page}`, {
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`list page ${page} HTTP ${res.status}`);
  return (await res.json()) as WeListResponse;
}

async function fetchAllSummaries(): Promise<WeSummary[]> {
  const PER = 100;
  const all: WeSummary[] = [];
  let page = 1;
  while (true) {
    const r = await fetchList(page, PER);
    all.push(...r.items);
    if (page * PER >= r.total) break;
    page++;
  }
  return all;
}

async function fetchDetail(slug: string): Promise<WeDetail | null> {
  const res = await fetch(`${BASE}/api/whisky-reviews/${slug}`, {
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`detail ${slug} HTTP ${res.status}`);
  return (await res.json()) as WeDetail;
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/^the\s+/i, "")
    .replace(/\s+distillery$/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function mapCountry(raw: string | undefined): WhiskyCountry {
  if (!raw) return "other";
  return COUNTRY_MAP[raw.trim().toLowerCase()] ?? "other";
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// "Dalmore 10 Years (2007/2017) - A.D. Rattray" + distillery="Dalmore"
//   → "10 Years (2007/2017) - A.D. Rattray"
// 매칭 안 되면 원문 유지.
function stripDistilleryPrefix(name: string, distillery: string): string {
  const d = distillery.trim();
  if (!d) return name;
  const patterns = [
    new RegExp(`^the\\s+${escapeRegex(d)}\\s+`, "i"),
    new RegExp(`^${escapeRegex(d)}\\s+`, "i"),
  ];
  for (const p of patterns) {
    const m = name.match(p);
    if (m) return name.slice(m[0].length).trim();
  }
  return name.trim();
}

function absoluteImage(url: string | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${BASE}${url}`;
}

function absoluteReviewUrl(slugOrPath: string | undefined, slug: string): string {
  if (slugOrPath?.startsWith("http")) return slugOrPath;
  if (slugOrPath?.startsWith("/")) return `${BASE}${slugOrPath}`;
  return `${BASE}/whisky-reviews/${slug}`;
}

type DistilleryRow = { id: string; name: string; country: WhiskyCountry };

async function loadDistilleries(): Promise<DistilleryRow[]> {
  const all: DistilleryRow[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("distilleries")
      .select("id, name, country")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`distilleries 조회: ${error.message}`);
    const rows = (data ?? []) as DistilleryRow[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function loadExistingReviewSlugs(): Promise<Map<string, string>> {
  // (external_slug) → bottling_id
  const out = new Map<string, string>();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("bottling_external_reviews")
      .select("bottling_id, external_slug")
      .eq("source", SOURCE)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`external_reviews 조회: ${error.message}`);
    const rows = (data ?? []) as { bottling_id: string; external_slug: string }[];
    for (const r of rows) out.set(r.external_slug, r.bottling_id);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function resolveDistillery(
  name: string,
  country: WhiskyCountry,
  byKey: Map<string, DistilleryRow>,
): Promise<DistilleryRow | null> {
  const key = `${normalizeName(name)}|${country}`;
  const hit = byKey.get(key);
  if (hit) return hit;

  // 새로 insert
  const { data, error } = await supabase
    .from("distilleries")
    .insert({ name: name.trim(), country })
    .select("id, name, country")
    .single();
  if (error) {
    console.warn(`  ! distillery insert 실패 "${name}" (${country}): ${error.message}`);
    return null;
  }
  const row = data as DistilleryRow;
  byKey.set(key, row);
  return row;
}

function buildBottlingPayload(s: WeSummary, distilleryId: string): {
  distillery_id: string;
  name: string;
  age_years: number | null;
  abv: number | null;
  cask_type: "unknown";
  bottler: BottlerKind;
  bottler_name: string | null;
  bottle_size_ml: number;
} {
  const distName = s.metadata.distillery ?? "";
  const name = stripDistilleryPrefix(s.name, distName) || s.name;
  const age = s.metadata.age && s.metadata.age > 0 ? s.metadata.age : null;
  const abv = s.metadata.abv ?? null;
  const bottlerRaw = (s.metadata.bottler ?? "").trim();
  const bottler: BottlerKind = bottlerRaw ? "independent" : "official";
  return {
    distillery_id: distilleryId,
    name,
    age_years: age,
    abv,
    cask_type: "unknown",
    bottler,
    bottler_name: bottlerRaw || null,
    bottle_size_ml: 700,
  };
}

function buildReviewPayload(
  s: WeSummary,
  detail: WeDetail | null,
  bottlingId: string,
): {
  bottling_id: string;
  source: string;
  external_slug: string;
  source_url: string | null;
  reviewer_a_name: string | null;
  reviewer_a_score: number | null;
  reviewer_b_name: string | null;
  reviewer_b_score: number | null;
  nose: string | null;
  palate: string | null;
  finish: string | null;
  conclusion_a: string | null;
  conclusion_b: string | null;
  price_per_liter: number | null;
  price_currency: string | null;
  flavour: string | null;
  image_url: string | null;
  fetched_at: string;
} {
  const notes = detail?.tasting_notes;
  const concl = detail?.conclusion;
  const ppl = s.metadata.price_per_liter ?? null;
  return {
    bottling_id: bottlingId,
    source: SOURCE,
    external_slug: s.slug,
    source_url: absoluteReviewUrl(s.url, s.slug),
    reviewer_a_name: "Marcel",
    reviewer_a_score: s.rating?.marcel ?? null,
    reviewer_b_name: "Sascha",
    reviewer_b_score: s.rating?.sascha ?? null,
    nose: notes?.nose ?? null,
    palate: notes?.palate ?? null,
    finish: notes?.finish ?? null,
    conclusion_a: concl?.marcel ?? null,
    conclusion_b: concl?.sascha ?? null,
    price_per_liter: ppl,
    price_currency: ppl !== null ? "EUR" : null,
    flavour: s.metadata.flavour ?? null,
    image_url: absoluteImage(s.image?.url),
    fetched_at: new Date().toISOString(),
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("→ WHISKY:EDITION 리뷰 리스트 fetch 중…");
  const summaries = await fetchAllSummaries();
  console.log(`  ${summaries.length}개 받음`);

  console.log("→ 기존 distilleries 로드 중…");
  const distilleries = await loadDistilleries();
  const distByKey = new Map<string, DistilleryRow>();
  for (const d of distilleries) {
    distByKey.set(`${normalizeName(d.name)}|${d.country}`, d);
  }
  console.log(`  기존 ${distilleries.length}개`);

  console.log("→ 기존 whisky_edition 리뷰 로드 중…");
  const existingBySlug = await loadExistingReviewSlugs();
  console.log(`  기존 ${existingBySlug.size}개`);

  // 분류: skip(이미 존재) / 기존 distillery 매칭 / 새 distillery 필요 / 국가 매핑 안 됨
  const summary = {
    alreadyImported: 0,
    needNewDistillery: 0,
    matched: 0,
    skipCountry: new Map<string, number>(),
  };

  for (const s of summaries) {
    if (existingBySlug.has(s.slug)) {
      summary.alreadyImported++;
      continue;
    }
    const country = mapCountry(s.metadata.country);
    if (country === "other" && s.metadata.country && s.metadata.country.toLowerCase() !== "other") {
      summary.skipCountry.set(
        s.metadata.country,
        (summary.skipCountry.get(s.metadata.country) ?? 0) + 1,
      );
    }
    const distName = s.metadata.distillery;
    if (!distName) continue;
    const key = `${normalizeName(distName)}|${country}`;
    if (distByKey.has(key)) summary.matched++;
    else summary.needNewDistillery++;
  }

  console.log("\n계획:");
  console.log(`  이미 import됨 (skip)            ${summary.alreadyImported}`);
  console.log(`  기존 distillery 매칭            ${summary.matched}`);
  console.log(`  새 distillery 필요              ${summary.needNewDistillery}`);
  if (summary.skipCountry.size > 0) {
    console.log("\n  매핑 안 된 country (→ other 폴백):");
    for (const [c, n] of [...summary.skipCountry.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${c.padEnd(25)} ${n}`);
    }
  }

  if (!APPLY) {
    console.log("\n[DRY RUN] insert 미실행. --apply 붙이세요.");
    console.log("\n샘플 5개 (matched):");
    let shown = 0;
    for (const s of summaries) {
      if (shown >= 5) break;
      if (existingBySlug.has(s.slug)) continue;
      const country = mapCountry(s.metadata.country);
      const distName = s.metadata.distillery ?? "";
      const key = `${normalizeName(distName)}|${country}`;
      if (!distByKey.has(key)) continue;
      console.log(`  ${s.name.padEnd(50)} ← ${distName} (${country}) · €${s.metadata.price_per_liter ?? "—"}/L`);
      shown++;
    }
    return;
  }

  // === apply ===
  let createdDistilleries = 0;
  let createdBottlings = 0;
  let upsertedReviews = 0;
  let updatedReviews = 0;
  let fetchErrors = 0;

  for (let i = 0; i < summaries.length; i++) {
    const s = summaries[i];
    const tag = `[${i + 1}/${summaries.length}] ${s.name}`;

    const country = mapCountry(s.metadata.country);
    const distName = s.metadata.distillery?.trim();
    if (!distName) {
      console.warn(`  · ${tag} skip (distillery 없음)`);
      continue;
    }

    const distBefore = distByKey.has(`${normalizeName(distName)}|${country}`);
    const distRow = await resolveDistillery(distName, country, distByKey);
    if (!distRow) continue;
    if (!distBefore) createdDistilleries++;

    // 기존 review row가 있으면 그 bottling_id 사용; 없으면 새 bottling 만들기
    let bottlingId = existingBySlug.get(s.slug) ?? null;
    if (!bottlingId) {
      const payload = buildBottlingPayload(s, distRow.id);
      const { data, error } = await supabase
        .from("bottlings")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) {
        console.warn(`  ! ${tag} bottling insert 실패: ${error?.message ?? "unknown"}`);
        continue;
      }
      bottlingId = (data as { id: string }).id;
      createdBottlings++;
    }

    // 상세 fetch (노트 + 결론)
    let detail: WeDetail | null = null;
    try {
      detail = await fetchDetail(s.slug);
    } catch (e) {
      console.warn(`  ! ${tag} detail fetch 실패: ${e instanceof Error ? e.message : e}`);
      fetchErrors++;
    }

    const revPayload = buildReviewPayload(s, detail, bottlingId);
    const wasNew = !existingBySlug.has(s.slug);
    const { error: revErr } = await supabase
      .from("bottling_external_reviews")
      .upsert(revPayload, { onConflict: "bottling_id,source" });
    if (revErr) {
      console.error(`  ✗ ${tag} review upsert 실패: ${revErr.message}`);
    } else {
      if (wasNew) {
        upsertedReviews++;
        existingBySlug.set(s.slug, bottlingId);
      } else {
        updatedReviews++;
      }
    }

    if (i % 25 === 0) {
      console.log(`  · ${tag} — 누적 bottling ${createdBottlings}, review ${upsertedReviews + updatedReviews}`);
    }

    await sleep(DETAIL_DELAY_MS);
  }

  console.log(`\n✓ 완료.`);
  console.log(`  새 distillery     ${createdDistilleries}`);
  console.log(`  새 bottling       ${createdBottlings}`);
  console.log(`  새 review         ${upsertedReviews}`);
  console.log(`  갱신 review       ${updatedReviews}`);
  console.log(`  detail fetch 실패 ${fetchErrors}`);
}

main().catch((e) => {
  console.error("\n✗ 실패:", e);
  process.exit(1);
});
