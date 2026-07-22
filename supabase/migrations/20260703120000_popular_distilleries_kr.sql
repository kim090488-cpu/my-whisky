-- ────────────────────────────────────────────────────────────────────
-- popular_distilleries view: name_kr 컬럼 노출
-- ────────────────────────────────────────────────────────────────────
-- create or replace는 컬럼 순서 변경 불가 → 드롭 후 재생성.

drop view if exists public.popular_distilleries;

create view public.popular_distilleries
with (security_invoker = true)
as
select
  d.id, d.name, d.name_kr, d.country, d.region, d.status,
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
