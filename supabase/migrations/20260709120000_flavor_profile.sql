-- ────────────────────────────────────────────────────────────────────
-- 테이스팅 노트에 위스키 6축 맛 프로필 추가
-- 피트(peaty) · 스모키(smoky) · 과일(fruity) · 스파이스(spicy) · 단맛(sweet) · 오크(oaky)
-- 모두 0-5 NULLABLE — 기존 노트와 호환, 입력자가 선택적으로 채움
-- ────────────────────────────────────────────────────────────────────

alter table public.tastings
  add column if not exists flavor_peat   smallint check (flavor_peat   between 0 and 5),
  add column if not exists flavor_smoke  smallint check (flavor_smoke  between 0 and 5),
  add column if not exists flavor_fruit  smallint check (flavor_fruit  between 0 and 5),
  add column if not exists flavor_spice  smallint check (flavor_spice  between 0 and 5),
  add column if not exists flavor_sweet  smallint check (flavor_sweet  between 0 and 5),
  add column if not exists flavor_oak    smallint check (flavor_oak    between 0 and 5);

-- 보틀링 단위 평균 (공개 노트만, NULL은 무시)
create or replace view public.bottling_flavor_avgs as
select
  bottling_id,
  round(avg(flavor_peat)  ::numeric, 1) as avg_peat,
  round(avg(flavor_smoke) ::numeric, 1) as avg_smoke,
  round(avg(flavor_fruit) ::numeric, 1) as avg_fruit,
  round(avg(flavor_spice) ::numeric, 1) as avg_spice,
  round(avg(flavor_sweet) ::numeric, 1) as avg_sweet,
  round(avg(flavor_oak)   ::numeric, 1) as avg_oak,
  count(*) filter (
    where flavor_peat  is not null
       or flavor_smoke is not null
       or flavor_fruit is not null
       or flavor_spice is not null
       or flavor_sweet is not null
       or flavor_oak   is not null
  ) as rated_count
from public.tastings
where visibility = 'public'
group by bottling_id;

comment on view public.bottling_flavor_avgs is
  '보틀링별 6축 맛 프로필 공개 평균. NULL 응답은 평균 계산에서 자동 제외 (avg 함수 동작).';
