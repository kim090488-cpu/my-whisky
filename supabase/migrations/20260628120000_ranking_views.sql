-- ────────────────────────────────────────────────
-- 랭킹 뷰들 (MVP — 매 요청 계산)
-- 데이터 규모 커지면 materialized view + pg_cron 으로 전환.
-- security_invoker=true → RLS 호출자 컨텍스트 (public 노트만 집계됨)
-- ────────────────────────────────────────────────

-- 트렌딩 테이스팅: 최근 7일 좋아요 + 전체 좋아요 가중
create or replace view public.trending_tastings
with (security_invoker = true)
as
select
  t.id, t.bottling_id, t.user_id, t.score, t.tasted_at,
  t.like_count, t.comment_count, t.overall, t.visibility,
  coalesce((
    select count(*)::int
    from public.tasting_likes l
    where l.tasting_id = t.id
      and l.created_at > now() - interval '7 days'
  ), 0) as recent_likes
from public.tastings t
where t.visibility = 'public';

-- 탑 리뷰어: 노트 많고 받은 좋아요 많은 사용자
create or replace view public.top_reviewers
with (security_invoker = true)
as
select
  p.id, p.username, p.display_name, p.avatar_url, p.follower_count,
  (
    select count(*)::int from public.tastings t
    where t.user_id = p.id and t.visibility = 'public'
  ) as public_note_count,
  (
    select coalesce(sum(t.like_count), 0)::int from public.tastings t
    where t.user_id = p.id and t.visibility = 'public'
  ) as total_likes_received,
  (
    select round(avg(t.score)::numeric, 1) from public.tastings t
    where t.user_id = p.id and t.visibility = 'public' and t.score is not null
  ) as avg_score
from public.profiles p;

-- 인기 증류소: 노트 수 + 평균 점수
create or replace view public.popular_distilleries
with (security_invoker = true)
as
select
  d.id, d.name, d.country, d.region, d.status,
  (
    select count(*)::int
    from public.tastings t
    join public.bottlings b on t.bottling_id = b.id
    where b.distillery_id = d.id and t.visibility = 'public'
  ) as note_count,
  (
    select round(avg(t.score)::numeric, 1)
    from public.tastings t
    join public.bottlings b on t.bottling_id = b.id
    where b.distillery_id = d.id and t.visibility = 'public' and t.score is not null
  ) as avg_score,
  (
    select count(*)::int from public.bottlings b where b.distillery_id = d.id
  ) as bottling_count
from public.distilleries d;
