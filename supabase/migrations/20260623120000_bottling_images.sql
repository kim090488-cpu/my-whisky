-- ────────────────────────────────────────────────
-- bottling_images: 보틀링당 여러 라벨/병 사진
-- ────────────────────────────────────────────────
create table public.bottling_images (
  id            uuid primary key default gen_random_uuid(),
  bottling_id   uuid not null references public.bottlings(id) on delete cascade,
  storage_path  text not null,
  caption       text,
  sort_order    smallint not null default 0,
  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index bottling_images_bottling_idx
  on public.bottling_images (bottling_id, sort_order, created_at);

alter table public.bottling_images enable row level security;

create policy "bottling_images read all"
  on public.bottling_images for select using (true);

create policy "bottling_images insert authed"
  on public.bottling_images for insert
  with check (auth.uid() is not null and auth.uid() = uploaded_by);

create policy "bottling_images delete own"
  on public.bottling_images for delete
  using (auth.uid() = uploaded_by);

-- ────────────────────────────────────────────────
-- Storage 버킷 'bottling-images' (Public — 라벨은 공개 정보)
-- ────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('bottling-images', 'bottling-images', true)
  on conflict (id) do nothing;

-- 정책 재정의 안전하게: drop if exists → create
drop policy if exists "bottling-images public read"   on storage.objects;
drop policy if exists "bottling-images authed upload" on storage.objects;
drop policy if exists "bottling-images own delete"    on storage.objects;

create policy "bottling-images public read"
  on storage.objects for select
  using (bucket_id = 'bottling-images');

create policy "bottling-images authed upload"
  on storage.objects for insert
  with check (bucket_id = 'bottling-images' and auth.uid() is not null);

create policy "bottling-images own delete"
  on storage.objects for delete
  using (bucket_id = 'bottling-images' and owner = auth.uid());

-- ────────────────────────────────────────────────
-- bottling_card_stats view 갱신:
--   label_image_url 없으면 bottling_images의 첫 번째 사진을 자동으로 primary로
-- ────────────────────────────────────────────────
create or replace view public.bottling_card_stats
with (security_invoker = true)
as
select
  b.id,
  b.distillery_id,
  b.name,
  b.age_years,
  b.abv,
  b.cask_type,
  b.bottler,
  coalesce(
    b.label_image_url,
    (
      select storage_path
      from public.bottling_images bi
      where bi.bottling_id = b.id
      order by bi.sort_order, bi.created_at
      limit 1
    )
  ) as label_image_url,
  b.created_at,
  d.name    as distillery_name,
  d.country as country,
  d.region  as region,
  d.status  as distillery_status,
  (
    select round(avg(t.score)::numeric, 1)
    from public.tastings t
    where t.bottling_id = b.id
      and t.visibility = 'public'
      and t.score is not null
  ) as avg_score,
  (
    select count(*)::int
    from public.tastings t
    where t.bottling_id = b.id
      and t.visibility = 'public'
  ) as tasting_count
from public.bottlings b
join public.distilleries d on d.id = b.distillery_id;
