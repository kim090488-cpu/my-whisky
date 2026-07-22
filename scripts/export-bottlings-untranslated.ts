/**
 * bottlings 중 name_kr이 NULL인 행을 CSV로 추출.
 * 출력: scripts/bottlings-untranslated.csv
 */

import path from "node:path";
import fs from "node:fs";
import { config } from "dotenv";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function escapeCsv(s: string): string {
  // 콤마/따옴표/줄바꿈 들어가면 따옴표로 감싸고 내부 따옴표는 두 번 반복
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  const all: { name: string }[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("bottlings")
      .select("name")
      .is("name_kr", null)
      .order("name")
      .range(from, from + pageSize - 1);
    if (error) {
      console.error(error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const outPath = path.resolve(process.cwd(), "scripts/bottlings-untranslated.csv");
  const lines = ["name", ...all.map((r) => escapeCsv(r.name))];
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");

  console.log(`✓ ${all.length}개 추출 → ${outPath}`);
}

main();
