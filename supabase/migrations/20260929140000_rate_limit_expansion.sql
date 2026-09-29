-- ────────────────────────────────────────────────
-- Rate limit 확대 (Play Store 릴리스 전 v3 후속)
--   v3 마이그레이션에서 만든 enforce_hourly_rate_limit(limit, column) 재사용.
--   INSERT 스팸 방지 — 로그인 유저 대상, service_role/admin 통과.
-- ────────────────────────────────────────────────

-- ── tastings (테이스팅 노트) ──
-- 정상 사용자는 하루 몇 잔 시음. 시간당 15건이면 충분히 여유.
drop trigger if exists tastings_rate_limit on public.tastings;
create trigger tastings_rate_limit
  before insert on public.tastings
  for each row
  execute function public.enforce_hourly_rate_limit(15, 'user_id');

-- ── tasting_comments (테이스팅 댓글) ──
drop trigger if exists tasting_comments_rate_limit on public.tasting_comments;
create trigger tasting_comments_rate_limit
  before insert on public.tasting_comments
  for each row
  execute function public.enforce_hourly_rate_limit(30, 'user_id');

-- ── community_posts (커뮤니티 게시글) ──
-- 게시글은 리더샵 스팸 벡터라 좀 더 타이트하게.
drop trigger if exists community_posts_rate_limit on public.community_posts;
create trigger community_posts_rate_limit
  before insert on public.community_posts
  for each row
  execute function public.enforce_hourly_rate_limit(10, 'user_id');

-- ── community_post_comments ──
drop trigger if exists community_post_comments_rate_limit on public.community_post_comments;
create trigger community_post_comments_rate_limit
  before insert on public.community_post_comments
  for each row
  execute function public.enforce_hourly_rate_limit(30, 'user_id');

-- ── post_comments (모먼트 댓글) ──
drop trigger if exists post_comments_rate_limit on public.post_comments;
create trigger post_comments_rate_limit
  before insert on public.post_comments
  for each row
  execute function public.enforce_hourly_rate_limit(30, 'user_id');
