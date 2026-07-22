-- ────────────────────────────────────────────────
-- 보안 강화 마이그레이션
--   1. tastings / tasting_comments / distilleries / bottlings UPDATE 정책에
--      WITH CHECK 추가 — 작성자 위조(user_id/created_by 변경) 차단
--   2. tasting_comments UPDATE에 not is_user_suspended() 추가 — 정지 우회 차단
--   3. Storage(tasting-photos, bottling-images) INSERT에 경로 강제
--      (storage.foldername(name))[1] = auth.uid()::text
-- ────────────────────────────────────────────────

-- ── 1. UPDATE WITH CHECK ──────────────────────────

drop policy if exists "tastings update self"               on public.tastings;
create policy "tastings update self"
  on public.tastings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "tasting_comments update own"        on public.tasting_comments;
create policy "tasting_comments update own"
  on public.tasting_comments for update
  using (auth.uid() = user_id and not public.is_user_suspended())
  with check (auth.uid() = user_id and not public.is_user_suspended());

drop policy if exists "distilleries update creator"        on public.distilleries;
create policy "distilleries update creator"
  on public.distilleries for update
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "bottlings update creator"           on public.bottlings;
create policy "bottlings update creator"
  on public.bottlings for update
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- profiles.update self도 동일하게: id 변경(타인 프로필로 점프) 방지
drop policy if exists "profiles update self"               on public.profiles;
create policy "profiles update self"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── 2. Storage 경로 강제 ──────────────────────────
-- tasting-photos: `${userId}/${filename}` 컨벤션 강제.
--   → 다른 user 폴더에 spam 업로드 / path squatting 차단.
-- bottling-images: `${bottlingId}/${filename}` 컨벤션이라 user_id 강제 불가능.
--   대신 정지 사용자의 storage 업로드만 차단 (DB row insert는 이미 차단됨).

drop policy if exists "tasting-photos authed upload" on storage.objects;
create policy "tasting-photos authed upload"
  on storage.objects for insert
  with check (
    bucket_id = 'tasting-photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.is_user_suspended()
  );

drop policy if exists "bottling-images authed upload" on storage.objects;
create policy "bottling-images authed upload"
  on storage.objects for insert
  with check (
    bucket_id = 'bottling-images'
    and auth.uid() is not null
    and not public.is_user_suspended()
  );
