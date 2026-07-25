#!/usr/bin/env node
// dev-*@mywhisky.test 유저의 posts / tastings에 unsplash 사진 URL 붙이기 (피드 시각화용)
// 사진 없는 것만 update. 이미 사진 있는 것은 skip.

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

// 위스키·바 분위기 unsplash public 사진들
const PHOTO_POOL = [
  'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=800&h=800&fit=crop',
  'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800&h=800&fit=crop',
  'https://images.unsplash.com/photo-1568213816046-0ee1c42bd559?w=800&h=800&fit=crop',
  'https://images.unsplash.com/photo-1608885898957-a559228e8749?w=800&h=800&fit=crop',
  'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&h=800&fit=crop',
  'https://images.unsplash.com/photo-1516997121675-4c2d1684aa3e?w=800&h=800&fit=crop',
  'https://images.unsplash.com/photo-1582819509237-d6e7c98fbaa8?w=800&h=800&fit=crop',
  'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&h=800&fit=crop',
  'https://images.unsplash.com/photo-1585975754487-53a11c48d05f?w=800&h=800&fit=crop',
  'https://images.unsplash.com/photo-1571263854523-c8a1c86efa38?w=800&h=800&fit=crop',
];

function pickPhotos() {
  const n = 1 + Math.floor(Math.random() * 3); // 1~3장
  const shuffled = [...PHOTO_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

async function main() {
  console.log('== dev seed: photos ==');

  // dummy 유저 찾기
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const dummyIds = (list?.users ?? [])
    .filter(u => /^dev-.+@mywhisky\.test$/.test(u.email ?? ''))
    .map(u => u.id);
  console.log(`dummy users: ${dummyIds.length}`);
  if (dummyIds.length === 0) return;

  // Posts 업데이트 (photos 비어있는 것만)
  const { data: posts } = await supabase
    .from('posts')
    .select('id, photos')
    .in('user_id', dummyIds);
  const postsToUpdate = (posts ?? []).filter(p => !p.photos || p.photos.length === 0);
  console.log(`posts to update: ${postsToUpdate.length}`);
  for (const p of postsToUpdate) {
    const photos = pickPhotos();
    const { error } = await supabase.from('posts').update({ photos }).eq('id', p.id);
    if (error) console.error(`  post ${p.id}:`, error.message);
  }

  // Tastings에도 사진 붙이기 (피드에 노트도 뜨게 - 절반만)
  const { data: tastings } = await supabase
    .from('tastings')
    .select('id, photos')
    .in('user_id', dummyIds);
  const tastingsToUpdate = (tastings ?? []).filter(t => !t.photos || t.photos.length === 0);
  const half = Math.ceil(tastingsToUpdate.length / 2);
  console.log(`tastings to update: ${half} of ${tastingsToUpdate.length}`);
  for (const t of tastingsToUpdate.slice(0, half)) {
    const photos = pickPhotos();
    const { error } = await supabase.from('tastings').update({ photos }).eq('id', t.id);
    if (error) console.error(`  tasting ${t.id}:`, error.message);
  }

  console.log('== done ==');
  console.log('앱에서 피드 pull-to-refresh 하면 반영');
}

main().catch(e => { console.error(e.message); process.exit(1); });
