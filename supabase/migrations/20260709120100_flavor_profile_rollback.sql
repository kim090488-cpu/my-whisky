-- ────────────────────────────────────────────────────────────────────
-- 20260709120000_flavor_profile.sql 롤백
-- 기존 7축 flavor wheel (sweetness/smokiness/fruitiness/spiciness/smoothness/complexity/finish_length)이
-- 이미 review_schema_v2에 있어서 신규 6축 컬럼은 중복/사용 안 됨 — 제거
-- ────────────────────────────────────────────────────────────────────

drop view if exists public.bottling_flavor_avgs;

alter table public.tastings
  drop column if exists flavor_peat,
  drop column if exists flavor_smoke,
  drop column if exists flavor_fruit,
  drop column if exists flavor_spice,
  drop column if exists flavor_sweet,
  drop column if exists flavor_oak;
