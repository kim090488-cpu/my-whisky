#!/usr/bin/env node
// Dev seed: 5 dummy users + 20 tastings + posts + follow/like/comment on target user
// Usage: node scripts/seed-dev-data.mjs
// Env needed in .env.local:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Target user email defaults to kim090488@gmail.com — pass TARGET_EMAIL to override.
// Cleanup: node scripts/cleanup-dev-data.mjs

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => [l.split('=')[0], l.split('=').slice(1).join('=')])
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_EMAIL = process.env.TARGET_EMAIL || 'kim090488@gmail.com';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const DUMMY_USERS = [
  { email: 'dev-alice@mywhisky.test',   display: '앨리스',   username: 'dev_alice' },
  { email: 'dev-bob@mywhisky.test',     display: '밥',       username: 'dev_bob' },
  { email: 'dev-clara@mywhisky.test',   display: '클라라',   username: 'dev_clara' },
  { email: 'dev-daniel@mywhisky.test',  display: '다니엘',   username: 'dev_daniel' },
  { email: 'dev-emma@mywhisky.test',    display: '엠마',     username: 'dev_emma' },
];

const NOTE_TEMPLATES = [
  '캐러멜과 바닐라의 부드러운 향에 이어 은은한 스모크. 여운이 길고 따뜻해요.',
  '초콜릿·오렌지필·건포도가 층층이 올라옵니다. 셰리 캐스크 특유의 진한 단맛.',
  '풀바디에 후추 스파이스와 다크 초콜릿. 물 몇 방울 넣으면 과일이 살아나요.',
  '가벼운 꿀과 사과·배 향. 아침 위스키로 딱. 피니시는 짧지만 산뜻.',
  '피트 향이 강렬한 아일라 스타일. 스모크·바닷내음·요오드. 취향 갈릴 듯.',
  '바닐라 아이스크림에 캐러멜 소스 뿌린 느낌. 편하고 접근성 좋은 데일리.',
  '오크 탄닌이 강해 처음엔 드라이한데 뒤로 갈수록 과일이 열림. 복잡한 캐릭터.',
  '자몽 껍질·백후추·미네랄. 깔끔하고 상쾌한 하이랜드 스타일.',
];

const POST_TEMPLATES = [
  '오늘 한 잔의 위로 🥃',
  '주말 저녁, 좋아하는 위스키와 함께.',
  '새로 개봉한 병 첫 인상 남겨요.',
  '이 조합 진짜 좋네요.',
  '오랜만에 마셔봤는데 여전히 명작.',
];

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function ensureUser(u) {
  // Try to find existing user first
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users?.find(x => x.email === u.email);
  if (existing) {
    console.log(`  user exists: ${u.email} → ${existing.id}`);
    return existing.id;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email: u.email,
    password: 'devpass1234',
    email_confirm: true,
    user_metadata: { display_name: u.display },
  });
  if (error) throw new Error(`createUser ${u.email}: ${error.message}`);
  console.log(`  created: ${u.email} → ${data.user.id}`);
  return data.user.id;
}

async function findTargetUser() {
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const user = list?.users?.find(x => x.email === TARGET_EMAIL);
  if (!user) throw new Error(`target user ${TARGET_EMAIL} not found`);
  return user.id;
}

async function main() {
  console.log('== Dev seed ==');
  console.log(`target user: ${TARGET_EMAIL}`);
  const targetId = await findTargetUser();
  console.log(`target id: ${targetId}\n`);

  console.log('creating dummy users...');
  const users = [];
  for (const u of DUMMY_USERS) {
    const id = await ensureUser(u);
    users.push({ ...u, id });
    // ensure profile display + username
    await supabase.from('profiles')
      .update({ display_name: u.display, username: u.username })
      .eq('id', id);
  }
  console.log(`done. ${users.length} dummy users\n`);

  // Fetch some bottlings
  const { data: bottlings } = await supabase
    .from('bottlings')
    .select('id, name')
    .limit(20);
  if (!bottlings || bottlings.length === 0) {
    console.error('no bottlings in DB');
    return;
  }
  console.log(`bottlings pool: ${bottlings.length}\n`);

  console.log('creating tastings (4 per dummy user)...');
  const createdTastings = [];
  for (const u of users) {
    for (let i = 0; i < 4; i++) {
      const b = pick(bottlings);
      const { data, error } = await supabase.from('tastings').insert({
        user_id: u.id,
        bottling_id: b.id,
        score: randInt(70, 96),
        notes: pick(NOTE_TEMPLATES),
        visibility: 'public',
        tasted_at: new Date(Date.now() - randInt(0, 60) * 86400_000).toISOString().slice(0, 10),
        sweetness:     randInt(1, 10),
        smokiness:     randInt(1, 10),
        fruitiness:    randInt(1, 10),
        spiciness:     randInt(1, 10),
        smoothness:    randInt(1, 10),
        complexity:    randInt(1, 10),
        finish_length: randInt(1, 10),
      }).select('id').single();
      if (error) console.error(`  tasting err (${u.email}):`, error.message);
      else createdTastings.push({ id: data.id, userId: u.id });
    }
    console.log(`  ${u.display}: 4 tastings`);
  }
  console.log(`total: ${createdTastings.length} tastings\n`);

  console.log('creating posts...');
  let postCount = 0;
  for (const u of users) {
    const n = randInt(1, 2);
    for (let i = 0; i < n; i++) {
      const b = pick(bottlings);
      const { error } = await supabase.from('posts').insert({
        user_id: u.id,
        body: pick(POST_TEMPLATES),
        photos: [], // no photo (mobile upload skip)
        visibility: 'public',
        bottling_id: b.id,
      });
      if (error) console.error(`  post err (${u.email}):`, error.message);
      else postCount++;
    }
  }
  console.log(`total: ${postCount} posts\n`);

  console.log('following relationships (both ways)...');
  for (const u of users) {
    // dummy → target
    await supabase.from('follows').upsert({
      follower_id: u.id, followee_id: targetId,
    }, { onConflict: 'follower_id,followee_id', ignoreDuplicates: true });
    // target → dummy
    await supabase.from('follows').upsert({
      follower_id: targetId, followee_id: u.id,
    }, { onConflict: 'follower_id,followee_id', ignoreDuplicates: true });
  }
  console.log(`  ${users.length} dummy ↔ target follows\n`);

  // Fetch target's tastings for likes/comments trigger
  const { data: targetTastings } = await supabase
    .from('tastings')
    .select('id')
    .eq('user_id', targetId)
    .limit(10);

  if (targetTastings && targetTastings.length > 0) {
    console.log(`target has ${targetTastings.length} tastings. Adding dummy likes+comments...`);
    for (const t of targetTastings) {
      // 3 random dummies like
      const likers = [...users].sort(() => Math.random() - 0.5).slice(0, 3);
      for (const l of likers) {
        await supabase.from('tasting_likes').upsert({
          tasting_id: t.id, user_id: l.id,
        }, { onConflict: 'tasting_id,user_id', ignoreDuplicates: true });
      }
      // 1~2 comments
      const commenters = [...users].sort(() => Math.random() - 0.5).slice(0, randInt(1, 2));
      for (const c of commenters) {
        await supabase.from('tasting_comments').insert({
          tasting_id: t.id,
          user_id: c.id,
          body: pick([
            '이거 저도 좋아하는 위스키예요. 리뷰 잘 봤어요!',
            '피니시 부분 완전 공감합니다.',
            '한번 사봐야겠어요. 좋은 리뷰 감사합니다.',
            '저는 이거 좀 별로였는데... 취향 차이인 듯.',
          ]),
        });
      }
    }
    console.log(`  done\n`);
  } else {
    console.log('target has no tastings. Skipping likes/comments on target.\n');
    console.log('  (Tip: create at least one tasting from mobile app, then re-run seed)\n');
  }

  console.log('== Done ==');
  console.log('- 피드에 dummy들의 tasting/post 표시');
  console.log('- 알림 탭에 dummy들의 좋아요/댓글/팔로우 표시 (target에게 tasting이 있으면)');
  console.log('- 정리: node scripts/cleanup-dev-data.mjs');
}

main().catch(e => {
  console.error('seed failed:', e.message);
  process.exit(1);
});
