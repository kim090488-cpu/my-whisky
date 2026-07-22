/**
 * GPT가 번역한 bottlings CSV → UPDATE SQL 생성.
 *
 * 입력: process.argv[2] = CSV 경로 (헤더: name,name_ko,...)
 * 출력: scripts/bottlings-update.sql
 *
 * 각 UPDATE는 $w$...$w$ 달러 quoting으로 특수문자 안전 처리.
 * name_kr is null 가드로 재실행 시 이미 처리된 행 스킵.
 */

import fs from "node:fs";
import path from "node:path";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: tsx scripts/csv-to-bottlings-sql.ts <csv_path>");
  process.exit(1);
}

// 간단한 CSV 파서 — RFC 4180 (따옴표로 감싼 필드, 내부 따옴표는 ""로 escape)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += c;
        i++;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
        i++;
      } else if (c === ",") {
        row.push(field);
        field = "";
        i++;
      } else if (c === "\n" || c === "\r") {
        row.push(field);
        if (row.length > 0 && !(row.length === 1 && row[0] === "")) {
          rows.push(row);
        }
        row = [];
        field = "";
        // CRLF 처리
        if (c === "\r" && text[i + 1] === "\n") i += 2;
        else i++;
      } else {
        field += c;
        i++;
      }
    }
  }
  // 마지막 필드/행
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

let text = fs.readFileSync(path.resolve(csvPath), "utf8");
// UTF-8 BOM 제거
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const rows = parseCsv(text);

if (rows.length === 0) {
  console.error("Empty CSV");
  process.exit(1);
}

const header = rows[0];
const nameIdx = header.indexOf("name");
const koIdx = header.indexOf("name_ko");
if (nameIdx === -1 || koIdx === -1) {
  console.error(`Header missing 'name' or 'name_ko'. Got: ${header.join(",")}`);
  process.exit(1);
}

const data = rows.slice(1).filter((r) => r.length > Math.max(nameIdx, koIdx));

const sqlLines: string[] = [];
let skipped = 0;

for (const r of data) {
  const name = r[nameIdx]?.trim();
  const kr = r[koIdx]?.trim();
  if (!name || !kr) {
    skipped++;
    continue;
  }
  // 달러 quoting 충돌 방지: 거의 발생 안 하지만 안전하게 검사
  if (name.includes("$w$") || kr.includes("$w$")) {
    console.warn(`⚠ 스킵 (delimiter conflict): ${name}`);
    skipped++;
    continue;
  }
  sqlLines.push(
    `update public.bottlings set name_kr = $w$${kr}$w$ where name = $w$${name}$w$ and name_kr is null;`,
  );
}

const outPath = path.resolve(process.cwd(), "scripts/bottlings-update.sql");
fs.writeFileSync(outPath, sqlLines.join("\n") + "\n", "utf8");

console.log(`✓ ${sqlLines.length}개 UPDATE 생성 → ${outPath}`);
if (skipped > 0) console.log(`  ${skipped}개 스킵 (빈 값 또는 delimiter 충돌)`);
