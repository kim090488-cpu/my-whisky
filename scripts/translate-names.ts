/**
 * Translate distillery/bottling names to Korean using Claude.
 *
 * Reads rows with name_kr IS NULL, batches them, calls Claude Opus 4.7 with
 * adaptive thinking + prompt caching + structured outputs, writes name_kr back.
 *
 * Requires env:
 *   - SUPABASE_SERVICE_ROLE_KEY (in .env.local)
 *   - NEXT_PUBLIC_SUPABASE_URL  (in .env.local)
 *   - ANTHROPIC_API_KEY         (must be set separately)
 */

import path from "node:path";
import { config } from "dotenv";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!ANTHROPIC_KEY) {
  console.error("Missing ANTHROPIC_API_KEY env var");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const claude = new Anthropic();

const BATCH_SIZE = 30;
const MODEL = "claude-opus-4-7";

// ── 시스템 프롬프트 (캐시됨) ──────────────────────────────────────────

const SYSTEM_PROMPT = `You translate English whisky distillery and bottling names into the standard Korean transliterations used in the Korean whisky community.

Rules:
- Use the established Korean spelling for famous distilleries (Glenfiddich → 글렌피딕, Macallan → 맥캘란, Yamazaki → 야마자키).
- For bottling names: translate descriptive parts (Year Old → 년, Sherry Oak → 셰리오크, Cask Strength → 캐스크 스트렝스), keep proper nouns transliterated.
- Numbers stay as digits (18 Year Old → 18년).
- ABV/proof, edition numbers, batch numbers stay as-is (e.g., "Batch 5" → "배치 5", "46.3% ABV" stays in description but isn't part of name).
- "The" prefix is usually dropped (The Macallan → 맥캘란).
- "Distillery" suffix is usually dropped unless part of the actual brand.
- Cask types: bourbon → 버번, sherry → 셰리, port → 포트, rum → 럼, virgin oak → 버진오크, hogshead → 호그스헤드, butt → 버트, sherry butt → 셰리 버트
- Common terms: Single Malt → 싱글몰트, Blended → 블렌디드, Limited Edition → 한정판, Cask Strength → 캐스크 스트렝스, Non-Chill Filtered → 논칠필터드, Vintage → 빈티지

Output format: JSON object mapping each input name (exactly as provided) to its Korean translation. No extra commentary.

Examples:
{
  "Glenfiddich": "글렌피딕",
  "18 Year Old Sherry Oak": "18년 셰리오크",
  "Hercynian Distilling": "헤르키니안 증류",
  "Apogee XII 12 Years": "아포지 XII 12년"
}`;

// ── DB 조회 ──────────────────────────────────────────────────────────

async function fetchUntranslated(
  table: "distilleries" | "bottlings",
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from(table)
    .select("id, name")
    .is("name_kr", null)
    .order("name");
  if (error) throw new Error(`fetch ${table}: ${error.message}`);
  return (data ?? []).filter((r) => typeof r.name === "string" && r.name.trim().length > 0);
}

// ── 번역 호출 ─────────────────────────────────────────────────────────

type TranslationMap = Record<string, string>;

async function translateBatch(names: string[]): Promise<TranslationMap> {
  const userMsg = `Translate these to Korean. Return only a JSON object mapping each input string to its Korean translation.\n\nInputs:\n${names.map((n) => `- ${n}`).join("\n")}`;

  const response = await claude.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMsg }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          patternProperties: {
            "^.+$": { type: "string" },
          },
          additionalProperties: { type: "string" },
        },
      },
    },
  });

  // 응답 추출
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text block in response");
  }
  const raw = textBlock.text.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON: ${raw.slice(0, 200)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Unexpected response shape: ${raw.slice(0, 200)}`);
  }

  // 캐시 hit/miss 로그
  const cw = response.usage.cache_creation_input_tokens ?? 0;
  const cr = response.usage.cache_read_input_tokens ?? 0;
  const it = response.usage.input_tokens ?? 0;
  const ot = response.usage.output_tokens ?? 0;
  process.stdout.write(
    `    [tokens: in=${it} cache_write=${cw} cache_read=${cr} out=${ot}]\n`,
  );

  return parsed as TranslationMap;
}

// ── DB 업데이트 ──────────────────────────────────────────────────────

async function updateRow(
  table: "distilleries" | "bottlings",
  id: string,
  name_kr: string,
): Promise<void> {
  const { error } = await supabase.from(table).update({ name_kr }).eq("id", id);
  if (error) throw new Error(`update ${table} ${id}: ${error.message}`);
}

// ── 메인 처리 ────────────────────────────────────────────────────────

async function processTable(table: "distilleries" | "bottlings"): Promise<void> {
  console.log(`\n━━━ ${table} ━━━`);
  const rows = await fetchUntranslated(table);
  console.log(`  ${rows.length}개 처리 필요`);

  if (rows.length === 0) return;

  let done = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNo = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
    console.log(`  배치 ${batchNo}/${totalBatches} (${batch.length}개)`);

    try {
      const names = batch.map((r) => r.name);
      const translations = await translateBatch(names);

      // 매칭해서 업데이트
      for (const row of batch) {
        const kr = translations[row.name];
        if (kr && kr.trim().length > 0) {
          await updateRow(table, row.id, kr.trim());
          done++;
        } else {
          process.stdout.write(`    ⚠ 누락: ${row.name}\n`);
          failed++;
        }
      }
    } catch (e) {
      console.error(`    ✗ 배치 실패: ${(e as Error).message}`);
      failed += batch.length;
    }
  }

  console.log(`  ✓ ${done}개 완료, ${failed}개 실패/누락`);
}

async function main() {
  console.log(`모델: ${MODEL}`);
  console.log(`배치 크기: ${BATCH_SIZE}`);

  await processTable("distilleries");
  await processTable("bottlings");

  console.log("\n✓ 전체 완료");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
