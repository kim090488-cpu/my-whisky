#!/usr/bin/env node
// One-shot data migration: OLD Supabase project -> NEW.
// Uses Management API's /database/query endpoint (postgres superuser access).
// Preserves IDs; excludes generated columns; uses intersection of OLD/NEW columns;
// ON CONFLICT DO NOTHING for idempotency.

import { readFileSync } from 'node:fs';

const envPath = process.env.ENV_PATH || './.env.local';
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8').split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => [l.split('=')[0], l.split('=').slice(1).join('=')])
);

const OLD_REF = env.OLD_SUPABASE_PROJECT_REF;
const NEW_REF = env.NEW_SUPABASE_PROJECT_REF;
const OLD_PAT = env.OLD_SUPABASE_ACCESS_TOKEN;
const NEW_PAT = env.NEW_SUPABASE_ACCESS_TOKEN;

for (const [k, v] of Object.entries({ OLD_SUPABASE_PROJECT_REF: OLD_REF, NEW_SUPABASE_PROJECT_REF: NEW_REF, OLD_SUPABASE_ACCESS_TOKEN: OLD_PAT, NEW_SUPABASE_ACCESS_TOKEN: NEW_PAT })) {
  if (!v) { console.error(`Missing ${k} in ${envPath}`); process.exit(1); }
}

async function query(ref, pat, sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok || data.message) {
    const err = new Error(`Query failed [${res.status}]: ${JSON.stringify(data).slice(0, 500)}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

async function getColumnMeta(ref, pat, schema, table) {
  const rows = await query(ref, pat,
    `select column_name, data_type, is_generated from information_schema.columns where table_schema='${schema}' and table_name='${table}' order by ordinal_position`);
  return rows;
}

function formatValue(v, colType) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) {
    if (colType === 'ARRAY') {
      const inner = v.map(x => x === null ? 'NULL' : `'${String(x).replace(/'/g, "''")}'`).join(',');
      // Always cast to text[] so empty arrays have a resolvable type; text[] is
      // assignment-compatible with jsonb/varchar[]/etc. via implicit coercion.
      return `ARRAY[${inner}]::text[]`;
    }
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function migrateTable(schema, table, opts = {}) {
  const label = `${schema}.${table}`;

  const [oldMeta, newMeta] = await Promise.all([
    getColumnMeta(OLD_REF, OLD_PAT, schema, table),
    getColumnMeta(NEW_REF, NEW_PAT, schema, table),
  ]);

  if (oldMeta.length === 0) { console.error(`  [skip] ${label} — not in OLD`); return; }
  if (newMeta.length === 0) { console.error(`  [skip] ${label} — not in NEW`); return; }

  // Fast skip: already fully migrated?
  const [oldCntRes, newCntRes] = await Promise.all([
    query(OLD_REF, OLD_PAT, `select count(*)::int as c from ${schema}."${table}"`),
    query(NEW_REF, NEW_PAT, `select count(*)::int as c from ${schema}."${table}"`),
  ]);
  const oldCnt = oldCntRes[0].c;
  const newCnt = newCntRes[0].c;
  if (oldCnt === 0) { console.error(`  [empty] ${label}`); return; }
  if (newCnt >= oldCnt) { console.error(`  [already] ${label}: ${newCnt}/${oldCnt}`); return; }

  // Intersection minus generated columns
  const newColsSet = new Set(newMeta.filter(c => c.is_generated !== 'ALWAYS').map(c => c.column_name));
  const oldGenerated = new Set(oldMeta.filter(c => c.is_generated === 'ALWAYS').map(c => c.column_name));
  const cols = oldMeta
    .map(c => c.column_name)
    .filter(c => newColsSet.has(c) && !oldGenerated.has(c));
  const types = Object.fromEntries(oldMeta.map(c => [c.column_name, c.data_type]));

  if (cols.length === 0) { console.error(`  [skip] ${label} — no shared writable columns`); return; }

  // Fetch all rows from OLD
  const oldRows = await query(OLD_REF, OLD_PAT, `select ${cols.map(c => `"${c}"`).join(',')} from ${schema}."${table}"`);
  if (oldRows.length === 0) { console.error(`  [empty] ${label}`); return; }

  const CHUNK = 50;
  const colList = cols.map(c => `"${c}"`).join(',');
  const conflict = opts.conflictKey ? ` on conflict (${opts.conflictKey}) do nothing` : '';

  let inserted = 0, failed = 0;
  for (let i = 0; i < oldRows.length; i += CHUNK) {
    const chunk = oldRows.slice(i, i + CHUNK);
    const values = chunk.map(row =>
      '(' + cols.map(c => formatValue(row[c], types[c])).join(',') + ')'
    ).join(',');
    const sql = `insert into ${schema}."${table}" (${colList}) values ${values}${conflict}`;
    try {
      await query(NEW_REF, NEW_PAT, sql);
      inserted += chunk.length;
    } catch (e) {
      // Retry row by row
      for (const row of chunk) {
        const singleSql = `insert into ${schema}."${table}" (${colList}) values (${cols.map(c => formatValue(row[c], types[c])).join(',')})${conflict}`;
        try {
          await query(NEW_REF, NEW_PAT, singleSql);
          inserted++;
        } catch (re) {
          failed++;
          if (failed <= 3) console.error(`    row failed (pk=${row.id || row.user_id || '?'}): ${re.message.slice(0, 200)}`);
        }
      }
    }
  }
  const status = failed === 0 ? '[ok]' : '[partial]';
  console.error(`  ${status} ${label}: ${inserted}/${oldRows.length} rows${failed ? ` (${failed} failed)` : ''}`);
}

async function toggleAllTriggers(enable) {
  const action = enable ? 'enable' : 'disable';
  const sql = `select 'alter table ' || quote_ident(schemaname) || '.' || quote_ident(tablename) || ' ${action} trigger user;' as stmt from pg_tables where schemaname in ('public','auth','storage') order by schemaname, tablename`;
  const rows = await query(NEW_REF, NEW_PAT, sql);
  let ok = 0;
  for (const r of rows) {
    try { await query(NEW_REF, NEW_PAT, r.stmt); ok++; } catch (e) { /* skip */ }
  }
  console.error(`  triggers ${action}d on ${ok}/${rows.length} tables`);
}

async function resetSequences() {
  const sql = `select 'select setval(pg_get_serial_sequence(''' || quote_ident(table_schema) || '.' || quote_ident(table_name) || ''', ''' || column_name || '''), coalesce((select max(' || quote_ident(column_name) || ') from ' || quote_ident(table_schema) || '.' || quote_ident(table_name) || '), 1)) as v' as stmt
                from information_schema.columns
                where table_schema = 'public' and column_default like 'nextval%'`;
  const rows = await query(NEW_REF, NEW_PAT, sql);
  let ok = 0;
  for (const r of rows) {
    try { await query(NEW_REF, NEW_PAT, r.stmt); ok++; } catch (e) { /* skip */ }
  }
  console.error(`  reset ${ok}/${rows.length} sequences`);
}

const AUTH_TABLES = [
  { schema: 'auth', table: 'users', conflictKey: 'id' },
  { schema: 'auth', table: 'identities', conflictKey: 'id' },
];

const PUBLIC_TABLES = [
  { schema: 'public', table: 'profiles', conflictKey: 'id' },
  { schema: 'public', table: 'distilleries', conflictKey: 'id' },
  { schema: 'public', table: 'currency_rates', conflictKey: 'code' },
  { schema: 'public', table: 'bottlings', conflictKey: 'id' },
  { schema: 'public', table: 'distillery_auction_stats', conflictKey: 'distillery_id, dt, source' },
  { schema: 'public', table: 'bottling_images', conflictKey: 'id' },
  { schema: 'public', table: 'bottling_external_reviews', conflictKey: 'bottling_id, source' },
  { schema: 'public', table: 'bottling_edits', conflictKey: 'id' },
  { schema: 'public', table: 'bottling_edit_likes', conflictKey: 'id' },
  { schema: 'public', table: 'tastings', conflictKey: 'id' },
  { schema: 'public', table: 'tasting_likes', conflictKey: 'id' },
  { schema: 'public', table: 'tasting_comments', conflictKey: 'id' },
  { schema: 'public', table: 'collection_items', conflictKey: 'id' },
  { schema: 'public', table: 'price_records', conflictKey: 'id' },
  { schema: 'public', table: 'follows', conflictKey: 'id' },
  { schema: 'public', table: 'posts', conflictKey: 'id' },
  { schema: 'public', table: 'post_likes', conflictKey: 'id' },
  { schema: 'public', table: 'post_comments', conflictKey: 'id' },
  { schema: 'public', table: 'reports', conflictKey: 'id' },
  { schema: 'public', table: 'admin_actions', conflictKey: 'id' },
  { schema: 'public', table: 'notifications', conflictKey: 'id' },
];

(async () => {
  console.error('=== Phase 4/5: data migration OLD -> NEW ===');
  console.error('OLD:', OLD_REF);
  console.error('NEW:', NEW_REF);

  console.error('\n--- disabling triggers on NEW ---');
  await toggleAllTriggers(false);

  console.error('\n--- auth schema ---');
  for (const t of AUTH_TABLES) {
    await migrateTable(t.schema, t.table, t).catch(e => console.error(`  FATAL ${t.table}: ${e.message}`));
  }

  console.error('\n--- public schema ---');
  for (const t of PUBLIC_TABLES) {
    await migrateTable(t.schema, t.table, t).catch(e => console.error(`  FATAL ${t.table}: ${e.message}`));
  }

  console.error('\n--- re-enabling triggers on NEW ---');
  await toggleAllTriggers(true);

  console.error('\n--- resetting sequences ---');
  await resetSequences();

  console.error('\n=== done ===');
})();
