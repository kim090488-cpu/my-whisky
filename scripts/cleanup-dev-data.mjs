#!/usr/bin/env node
// Cleanup: delete dev-*@mywhisky.test users. Cascade removes all their tastings/posts/likes/comments/follows.
// Also removes target user's follows toward those dummy users.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => [l.split('=')[0], l.split('=').slice(1).join('=')])
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log('== Cleanup dev-*@mywhisky.test ==');
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const dummies = (list?.users ?? []).filter(u => /^dev-.+@mywhisky\.test$/.test(u.email ?? ''));
  console.log(`found ${dummies.length} dummy users`);

  for (const u of dummies) {
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) console.error(`  delete err ${u.email}:`, error.message);
    else console.log(`  deleted: ${u.email}`);
  }
  console.log('== Done ==');
}

main().catch(e => {
  console.error('cleanup failed:', e.message);
  process.exit(1);
});
