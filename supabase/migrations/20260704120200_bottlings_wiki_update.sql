-- ────────────────────────────────────────────────────────────────────
-- bottlings update 정책을 위키 스타일로 완화
-- 작성자만 수정 → 정지 안 된 인증 사용자 누구나 수정 가능
-- 카탈로그 정보의 잘못된 항목을 커뮤니티가 함께 정정하기 위함
-- ────────────────────────────────────────────────────────────────────

drop policy if exists "bottlings update creator" on public.bottlings;

create policy "bottlings update authed not suspended"
  on public.bottlings for update
  using (auth.uid() is not null and not public.is_user_suspended())
  with check (auth.uid() is not null and not public.is_user_suspended());
