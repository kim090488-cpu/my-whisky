#!/usr/bin/env node
// Post-migration smoke test: verify data + storage integrity on target Supabase project.
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local (override with ENV_PATH).
// Counts rows via PostgREST HEAD (count=exact) and walks storage buckets recursively.

import { readFileSync } from 'node:fs';

const envPath = process.env.ENV_PATH || './.env.local';
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8').split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => [l.split('=')[0], l.split('=').slice(1).join('=')])
);

const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !SVC) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

async function restCount(table) {
  const res = await fetch(`${URL_BASE}/rest/v1/${table}?select=*`, {
    method: 'HEAD',
    headers: {
      apikey: SVC,
      Authorization: `Bearer ${SVC}`,
      Prefer: 'count=exact',
    },
  });
  const range = res.headers.get('content-range');
  if (!res.ok) return { error: `${res.status}: ${await res.text().catch(() => '')}` };
  const total = range ? Number(range.split('/')[1]) : null;
  return { count: total };
}

async function listBuckets() {
  const res = await fetch(`${URL_BASE}/storage/v1/bucket`, {
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
  });
  if (!res.ok) return [];
  return res.json();
}

async function countBucketObjects(bucket, prefix = '') {
  let total = 0;
  const seenFolders = new Set();
  async function walk(p) {
    let offset = 0;
    while (true) {
      const res = await fetch(`${URL_BASE}/storage/v1/object/list/${bucket}`, {
        method: 'POST',
        headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 1000, offset, prefix: p, sortBy: { column: 'name', order: 'asc' } }),
      });
      if (!res.ok) return;
      const items = await res.json();
      if (items.length === 0) break;
      for (const item of items) {
        const path = p ? `${p}/${item.name}` : item.name;
        if (item.id === null || !item.metadata) {
          if (!seenFolders.has(path)) { seenFolders.add(path); await walk(path); }
        } else {
          total++;
        }
      }
      if (items.length < 1000) break;
      offset += 1000;
    }
  }
  await walk(prefix);
  return total;
}

const PUBLIC_TABLES = [
  'profiles', 'distilleries', 'bottlings', 'tastings', 'tasting_likes',
  'tasting_comments', 'collection_items', 'follows', 'posts', 'post_likes',
  'post_comments', 'notifications', 'bottling_images', 'bottling_external_reviews',
  'bottling_edits', 'bottling_edit_likes', 'price_records', 'currency_rates',
  'reports', 'admin_actions',
];

function pad(s, n) { return String(s).padEnd(n); }
function padLeft(s, n) { return String(s).padStart(n); }

(async () => {
  console.log('=== Supabase Migration Smoke Test ===');
  console.log('URL:', URL_BASE);
  console.log('');

  console.log('── public schema row counts ──');
  let totalRows = 0;
  for (const t of PUBLIC_TABLES) {
    const r = await restCount(t);
    if (r.error) console.log(`  ${pad(t, 30)} ERROR: ${r.error}`);
    else {
      console.log(`  ${pad(t, 30)} ${padLeft(r.count ?? '?', 8)} rows`);
      totalRows += r.count || 0;
    }
  }
  console.log(`  ${pad('TOTAL', 30)} ${padLeft(totalRows, 8)} rows`);
  console.log('');

  console.log('── storage buckets ──');
  const buckets = await listBuckets();
  if (buckets.length === 0) console.log('  (no buckets or error)');
  for (const b of buckets) {
    const cnt = await countBucketObjects(b.name);
    console.log(`  ${pad(b.name, 30)} ${padLeft(cnt, 8)} objects (${b.public ? 'public' : 'private'})`);
  }
  console.log('');

  console.log('=== done ===');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
