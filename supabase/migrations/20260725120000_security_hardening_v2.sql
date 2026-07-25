-- ────────────────────────────────────────────────
-- 보안 하드닝 v2 (2026-07-25)
--   2026-07-25 전수 감사에서 발견된 정책 결함 보강:
--     H1  push_subscriptions UPDATE에 WITH CHECK — 토큰 하이재킹 차단
--     H3  posts / post_likes / post_comments INSERT·UPDATE에 정지 사용자 차단
--     M1  notifications: WITH CHECK + read_at 이외 컬럼 갱신 금지 트리거
--     M2  post_comments UPDATE에 WITH CHECK
--     M4  price_records UPDATE에 WITH CHECK
--     L1  collection_items UPDATE에 WITH CHECK
--     L2  reports UPDATE(admin)에 WITH CHECK
--     L3  bottlings.created_by 변조 방지 트리거
-- ────────────────────────────────────────────────

-- ── H1) push_subscriptions UPDATE — user_id 하이재킹 차단 ──
drop policy if exists "push_subscriptions self update" on public.push_subscriptions;
create policy "push_subscriptions self update"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── H3) posts 계열 — 정지 사용자 차단 ──
drop policy if exists "posts insert self" on public.posts;
create policy "posts insert self" on public.posts
  for insert with check (auth.uid() = user_id and not public.is_user_suspended());

drop policy if exists "posts update self" on public.posts;
create policy "posts update self" on public.posts
  for update
  using (auth.uid() = user_id and not public.is_user_suspended())
  with check (auth.uid() = user_id and not public.is_user_suspended());

drop policy if exists "post_likes insert self" on public.post_likes;
create policy "post_likes insert self" on public.post_likes
  for insert with check (auth.uid() = user_id and not public.is_user_suspended());

-- ── M2 + H3) post_comments UPDATE에 WITH CHECK + 정지 차단, INSERT도 정지 차단 ──
drop policy if exists "post_comments insert authed" on public.post_comments;
create policy "post_comments insert authed" on public.post_comments
  for insert with check (
    auth.uid() is not null
    and auth.uid() = user_id
    and not public.is_user_suspended()
  );

drop policy if exists "post_comments update own" on public.post_comments;
create policy "post_comments update own" on public.post_comments
  for update
  using (auth.uid() = user_id and not public.is_user_suspended())
  with check (auth.uid() = user_id and not public.is_user_suspended());

-- ── M1) notifications — WITH CHECK + read_at 이외 갱신 금지 ──
drop policy if exists "notifications update self" on public.notifications;
create policy "notifications update self"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- service_role(send-push Edge Function)은 auth.uid()가 null이라 트리거 통과.
-- 사용자 세션만 read_at 이외 컬럼 변경 시 예외 발생.
create or replace function public.prevent_notification_tamper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.user_id       is distinct from old.user_id
     or new.actor_id   is distinct from old.actor_id
     or new.kind       is distinct from old.kind
     or new.target_table is distinct from old.target_table
     or new.target_id  is distinct from old.target_id
     or new.payload    is distinct from old.payload
     or new.sent_at    is distinct from old.sent_at
     or new.error      is distinct from old.error
     or new.created_at is distinct from old.created_at
  then
    raise exception '알림은 read_at만 갱신할 수 있어요';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_prevent_tamper on public.notifications;
create trigger notifications_prevent_tamper
  before update on public.notifications
  for each row execute function public.prevent_notification_tamper();

-- ── M4) price_records UPDATE에 WITH CHECK ──
drop policy if exists "price_records update own 24h" on public.price_records;
create policy "price_records update own 24h"
  on public.price_records for update
  using (auth.uid() = user_id and created_at > now() - interval '24 hours')
  with check (auth.uid() = user_id and created_at > now() - interval '24 hours');

-- ── L1) collection_items UPDATE에 WITH CHECK ──
drop policy if exists "collection update self" on public.collection_items;
create policy "collection update self" on public.collection_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── L2) reports UPDATE(admin)에 WITH CHECK ──
drop policy if exists "reports update admin" on public.reports;
create policy "reports update admin"
  on public.reports for update
  using (public.is_admin())
  with check (public.is_admin());

-- ── L3) bottlings.created_by 변조 방지 (위키 스타일 UPDATE라 owner audit 필요) ──
create or replace function public.preserve_bottling_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  new.created_by := old.created_by;
  return new;
end;
$$;

drop trigger if exists bottlings_preserve_created_by on public.bottlings;
create trigger bottlings_preserve_created_by
  before update on public.bottlings
  for each row execute function public.preserve_bottling_created_by();
