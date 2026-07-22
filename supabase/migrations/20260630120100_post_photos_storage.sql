-- ────────────────────────────────────────────────
-- Storage 버킷 'post-photos' (Public)
-- 사진 경로: <user_id>/<uuid>.jpg  (user_id 폴더 강제)
-- posts.photos text[] 컬럼에 storage_path 저장
-- ────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
  values ('post-photos', 'post-photos', true)
  on conflict (id) do nothing;

drop policy if exists "post-photos public read"   on storage.objects;
drop policy if exists "post-photos authed upload" on storage.objects;
drop policy if exists "post-photos own delete"    on storage.objects;

create policy "post-photos public read"
  on storage.objects for select
  using (bucket_id = 'post-photos');

create policy "post-photos authed upload"
  on storage.objects for insert
  with check (
    bucket_id = 'post-photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.is_user_suspended()
  );

create policy "post-photos own delete"
  on storage.objects for delete
  using (bucket_id = 'post-photos' and owner = auth.uid());
