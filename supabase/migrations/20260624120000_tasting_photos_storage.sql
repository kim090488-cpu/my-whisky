-- ────────────────────────────────────────────────
-- Storage 버킷 'tasting-photos' (Public — visibility=public인 노트만 보여지므로 OK)
-- 사진 경로 구조: <user_id>/<uuid>.jpg
-- (tastings.photos text[] 컬럼은 init_schema 에 이미 존재)
-- ────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('tasting-photos', 'tasting-photos', true)
  on conflict (id) do nothing;

drop policy if exists "tasting-photos public read"   on storage.objects;
drop policy if exists "tasting-photos authed upload" on storage.objects;
drop policy if exists "tasting-photos own delete"    on storage.objects;

create policy "tasting-photos public read"
  on storage.objects for select
  using (bucket_id = 'tasting-photos');

create policy "tasting-photos authed upload"
  on storage.objects for insert
  with check (bucket_id = 'tasting-photos' and auth.uid() is not null);

create policy "tasting-photos own delete"
  on storage.objects for delete
  using (bucket_id = 'tasting-photos' and owner = auth.uid());
