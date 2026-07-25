#!/usr/bin/env node
// Storage migration: OLD Supabase storage -> NEW.
// Walks each bucket recursively, downloads each object, uploads to NEW same path.

import { readFileSync } from 'node:fs';

const envPath = process.env.ENV_PATH || './.env.local';
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8').split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => [l.split('=')[0], l.split('=').slice(1).join('=')])
);

const OLD_URL = env.OLD_SUPABASE_URL || process.env.OLD_SUPABASE_URL;
const NEW_URL = env.NEW_SUPABASE_URL || process.env.NEW_SUPABASE_URL;
const OLD_SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const NEW_SVC = env.NEW_SUPABASE_SERVICE_ROLE_KEY;

if (!OLD_URL || !NEW_URL) { console.error('Missing OLD_SUPABASE_URL / NEW_SUPABASE_URL in env'); process.exit(1); }
if (!OLD_SVC || !NEW_SVC) { console.error('Missing service role keys'); process.exit(1); }

async function listObjects(baseUrl, svc, bucket, prefix = '') {
  const res = await fetch(`${baseUrl}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: { 'apikey': svc, 'Authorization': `Bearer ${svc}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 1000, prefix, offset: 0 })
  });
  if (!res.ok) throw new Error(`list ${bucket}/${prefix} failed: ${res.status}`);
  return res.json();
}

async function walkBucket(baseUrl, svc, bucket, prefix = '') {
  const items = await listObjects(baseUrl, svc, bucket, prefix);
  const files = [];
  for (const item of items) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    // Supabase list returns folders as items with id === null and no metadata
    if (item.id === null || !item.metadata) {
      const sub = await walkBucket(baseUrl, svc, bucket, path);
      files.push(...sub);
    } else {
      files.push({ path, size: item.metadata?.size, mimeType: item.metadata?.mimetype });
    }
  }
  return files;
}

async function downloadObject(baseUrl, svc, bucket, path) {
  const res = await fetch(`${baseUrl}/storage/v1/object/${bucket}/${path}`, {
    headers: { 'apikey': svc, 'Authorization': `Bearer ${svc}` }
  });
  if (!res.ok) throw new Error(`download ${bucket}/${path} failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  const contentType = res.headers.get('content-type');
  return { buf, contentType };
}

async function uploadObject(baseUrl, svc, bucket, path, buf, contentType) {
  const res = await fetch(`${baseUrl}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      'apikey': svc,
      'Authorization': `Bearer ${svc}`,
      'Content-Type': contentType || 'application/octet-stream',
      'x-upsert': 'true'
    },
    body: buf
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`upload ${bucket}/${path} failed: ${res.status} — ${txt.slice(0, 200)}`);
  }
}

async function migrateBucket(bucket) {
  console.error(`\n=== bucket: ${bucket} ===`);
  const files = await walkBucket(OLD_URL, OLD_SVC, bucket);
  console.error(`  found ${files.length} files`);

  let ok = 0, failed = 0, skipped = 0;
  for (const f of files) {
    try {
      const { buf, contentType } = await downloadObject(OLD_URL, OLD_SVC, bucket, f.path);
      await uploadObject(NEW_URL, NEW_SVC, bucket, f.path, buf, contentType);
      ok++;
      if (ok % 10 === 0) console.error(`  progress: ${ok}/${files.length}`);
    } catch (e) {
      if (e.message.includes('The resource already exists')) {
        skipped++;
      } else {
        failed++;
        if (failed <= 5) console.error(`  fail ${f.path}: ${e.message.slice(0, 200)}`);
      }
    }
  }
  console.error(`  [${bucket}] copied: ${ok}, skipped: ${skipped}, failed: ${failed}`);
}

(async () => {
  console.error('=== Phase 6: storage migration OLD -> NEW ===');
  const buckets = ['bottling-images', 'tasting-photos'];
  // post-photos bucket exists in migrations but no posts data yet
  for (const b of buckets) {
    await migrateBucket(b).catch(e => console.error(`  FATAL ${b}: ${e.message}`));
  }
  console.error('\n=== done ===');
})();
