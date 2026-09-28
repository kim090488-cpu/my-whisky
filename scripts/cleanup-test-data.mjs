import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envPath = new URL("../.env.local", import.meta.url);
const env = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const TABLES_TO_CLEAR = [
  // FK dependencies: children first
  "community_post_likes",
  "community_post_comments",
  "community_posts",
  "post_likes",
  "post_comments",
  "posts",
  "tasting_likes",
  "tasting_comments",
  "tastings",
  "collection_items",
  "follows",
  "notifications",
  "user_blocks",
  "push_subscriptions",
];

const STORAGE_BUCKETS = ["tasting-photos", "post-photos"];

const MODE = process.argv.includes("--commit") ? "commit" : "dry-run";

async function countRow(table) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) return { table, error: error.message };
  return { table, count: count ?? 0 };
}

async function countBucket(bucket) {
  const { data, error } = await supabase.storage.from(bucket).list("", { limit: 1 });
  if (error) return { bucket, error: error.message };
  return { bucket, hasFiles: (data ?? []).length > 0 };
}

async function deleteAll(table) {
  // supabase-js needs a filter — use a tautology on any column that always exists
  const { data: sampleRow } = await supabase.from(table).select("*").limit(1);
  if (!sampleRow || sampleRow.length === 0) return { table, deleted: 0, note: "empty" };
  const cols = Object.keys(sampleRow[0]);
  const idCol = cols.includes("id") ? "id" : cols[0];
  const { error, count } = await supabase.from(table).delete({ count: "exact" }).not(idCol, "is", null);
  if (error) return { table, error: error.message };
  return { table, deleted: count ?? 0 };
}

async function emptyBucket(bucket) {
  // List all files and delete
  let removedTotal = 0;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list("", {
      limit: 1000,
      offset,
    });
    if (error) return { bucket, error: error.message, removedTotal };
    if (!data || data.length === 0) break;
    const paths = data.map((f) => f.name);
    // Handle nested folders
    const { data: subFolders } = await supabase.storage.from(bucket).list("", { limit: 1000 });
    const foldersOnly = (subFolders ?? []).filter((f) => !f.metadata);
    for (const folder of foldersOnly) {
      const { data: nested } = await supabase.storage.from(bucket).list(folder.name, { limit: 1000 });
      const nestedPaths = (nested ?? []).map((f) => `${folder.name}/${f.name}`);
      if (nestedPaths.length > 0) {
        const { error: delErr } = await supabase.storage.from(bucket).remove(nestedPaths);
        if (delErr) return { bucket, error: delErr.message, removedTotal };
        removedTotal += nestedPaths.length;
      }
    }
    // Delete top-level file objects
    const fileNames = data.filter((f) => f.metadata).map((f) => f.name);
    if (fileNames.length > 0) {
      const { error: delErr } = await supabase.storage.from(bucket).remove(fileNames);
      if (delErr) return { bucket, error: delErr.message, removedTotal };
      removedTotal += fileNames.length;
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  return { bucket, removedTotal };
}

console.log(`\n=== Cleanup script  mode=${MODE.toUpperCase()} ===\n`);

console.log("Pre-flight counts:");
for (const t of TABLES_TO_CLEAR) {
  const r = await countRow(t);
  console.log(`  ${t.padEnd(28)} ${r.error ? "ERR: " + r.error : r.count + " rows"}`);
}
for (const b of STORAGE_BUCKETS) {
  const r = await countBucket(b);
  console.log(`  bucket ${b.padEnd(21)} ${r.error ? "ERR: " + r.error : r.hasFiles ? "has files" : "empty"}`);
}

if (MODE === "dry-run") {
  console.log("\nDry run only. Re-run with --commit to actually delete.\n");
  process.exit(0);
}

console.log("\nDeleting rows...");
for (const t of TABLES_TO_CLEAR) {
  const r = await deleteAll(t);
  console.log(`  ${t.padEnd(28)} ${r.error ? "ERR: " + r.error : (r.note ?? `deleted ${r.deleted}`)}`);
}

console.log("\nEmptying storage buckets...");
for (const b of STORAGE_BUCKETS) {
  const r = await emptyBucket(b);
  console.log(`  ${b.padEnd(21)} ${r.error ? "ERR: " + r.error : "removed " + r.removedTotal + " files"}`);
}

console.log("\nPost-cleanup counts:");
for (const t of TABLES_TO_CLEAR) {
  const r = await countRow(t);
  console.log(`  ${t.padEnd(28)} ${r.error ? "ERR: " + r.error : r.count + " rows"}`);
}

console.log("\nDone.\n");
