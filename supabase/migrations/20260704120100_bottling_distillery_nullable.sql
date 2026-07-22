-- ────────────────────────────────────────────────────────────────────
-- bottlings.distillery_id 를 NULLABLE 로 변경
-- 사용자가 증류소를 모르는 경우에도 보틀링 등록 가능하게 함
-- bottling_card_stats 등 뷰는 이미 left join 이라 추가 변경 불필요
-- ────────────────────────────────────────────────────────────────────

alter table public.bottlings
  alter column distillery_id drop not null;
