-- ────────────────────────────────────────────────────────────────────
-- bottling_barcodes: 1 bottling ↔ N barcodes
--
-- 배경: 국내 유통되는 위스키는 같은 병에 여러 개의 바코드가 붙는 경우가 흔함
--   - 제조사 원본 EAN-13 (해외 인쇄)
--   - 한글 수입 스티커 바코드 (수입원 부착)
--   - 유통사 자체 바코드 (롯데·이마트 등)
--   - 면세/병행수입 SKU 차이
--
-- 기존 bottlings.barcode(text, unique)는 1:1 강제라 덮어쓰기 발생.
-- 별도 테이블로 분리해 여러 개 저장하고 각 바코드마다 source 태그.
-- ────────────────────────────────────────────────────────────────────

create table if not exists public.bottling_barcodes (
  id          uuid primary key default gen_random_uuid(),
  bottling_id uuid not null references public.bottlings(id) on delete cascade,
  barcode     text not null check (length(barcode) between 1 and 64),
  source      text not null default 'unknown'
                check (source in ('manufacturer', 'importer', 'retailer', 'unknown')),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create unique index if not exists bottling_barcodes_barcode_uniq
  on public.bottling_barcodes (barcode);
create index if not exists bottling_barcodes_bottling_idx
  on public.bottling_barcodes (bottling_id);

alter table public.bottling_barcodes enable row level security;

drop policy if exists "bottling_barcodes read all" on public.bottling_barcodes;
create policy "bottling_barcodes read all" on public.bottling_barcodes
  for select using (true);

drop policy if exists "bottling_barcodes insert authed" on public.bottling_barcodes;
create policy "bottling_barcodes insert authed" on public.bottling_barcodes
  for insert
  with check (
    auth.uid() is not null
    and not public.is_user_suspended()
    and (created_by is null or created_by = auth.uid())
  );

-- 위키 스타일: 잘못 등록된 바코드는 정지 안 된 인증 사용자 누구나 정리 가능
drop policy if exists "bottling_barcodes delete authed" on public.bottling_barcodes;
create policy "bottling_barcodes delete authed" on public.bottling_barcodes
  for delete using (
    auth.uid() is not null
    and not public.is_user_suspended()
  );

-- 기존 bottlings.barcode 데이터 이관 (있으면)
insert into public.bottling_barcodes (bottling_id, barcode, source, created_by)
select id, barcode, 'unknown', created_by
from public.bottlings
where barcode is not null
on conflict (barcode) do nothing;

-- 이관 완료 후 기존 컬럼·인덱스 제거
drop index if exists public.bottlings_barcode_uniq;
alter table public.bottlings drop column if exists barcode;
