-- ────────────────────────────────────────────────
-- notifications: 알림 큐 + 이력
--   DB 트리거(좋아요·댓글·팔로우 insert) → 여기 INSERT
--   Supabase Database Webhook → send-push Edge Function → Expo Push API
-- ────────────────────────────────────────────────
create type notification_kind as enum ('like', 'comment', 'follow');

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,   -- 받는 사람
  kind          notification_kind not null,
  actor_id      uuid references auth.users(id) on delete cascade,            -- 일으킨 사람
  target_table  text,
  target_id     uuid,
  payload       jsonb,
  read_at       timestamptz,
  sent_at       timestamptz,                                                  -- Edge Function 처리 시각
  error         text,
  created_at    timestamptz not null default now()
);

create index notifications_user_idx   on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_unsent_idx on public.notifications (created_at) where sent_at is null;

alter table public.notifications enable row level security;

create policy "notifications read self"
  on public.notifications for select using (auth.uid() = user_id);
create policy "notifications update self"
  on public.notifications for update using (auth.uid() = user_id);
-- insert는 security definer 트리거 또는 service_role 만

-- ────────────────────────────────────────────────
-- 좋아요 → 노트 작성자에게 알림 (자기 좋아요 제외)
-- ────────────────────────────────────────────────
create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
begin
  select user_id into recipient from public.tastings where id = new.tasting_id;
  if recipient is null or recipient = new.user_id then return new; end if;

  insert into public.notifications (user_id, kind, actor_id, target_table, target_id, payload)
  values (
    recipient, 'like', new.user_id,
    'tasting', new.tasting_id,
    jsonb_build_object('tasting_id', new.tasting_id)
  );
  return new;
end;
$$;

create trigger tasting_likes_notify
  after insert on public.tasting_likes
  for each row execute function public.notify_on_like();

-- ────────────────────────────────────────────────
-- 댓글 → 노트 작성자 + (대댓글인 경우) 부모 댓글 작성자 (자기 댓글 / 중복 제외)
-- ────────────────────────────────────────────────
create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  note_owner   uuid;
  parent_owner uuid;
begin
  select user_id into note_owner from public.tastings where id = new.tasting_id;

  if note_owner is not null and note_owner <> new.user_id then
    insert into public.notifications (user_id, kind, actor_id, target_table, target_id, payload)
    values (
      note_owner, 'comment', new.user_id,
      'comment', new.id,
      jsonb_build_object(
        'tasting_id', new.tasting_id,
        'comment_id', new.id,
        'body', substring(new.body for 100)
      )
    );
  end if;

  if new.parent_id is not null then
    select user_id into parent_owner from public.tasting_comments where id = new.parent_id;
    if parent_owner is not null
       and parent_owner <> new.user_id
       and parent_owner <> note_owner then
      insert into public.notifications (user_id, kind, actor_id, target_table, target_id, payload)
      values (
        parent_owner, 'comment', new.user_id,
        'comment', new.id,
        jsonb_build_object(
          'tasting_id', new.tasting_id,
          'comment_id', new.id,
          'reply_to', new.parent_id,
          'body', substring(new.body for 100)
        )
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger tasting_comments_notify
  after insert on public.tasting_comments
  for each row execute function public.notify_on_comment();

-- ────────────────────────────────────────────────
-- 팔로우 → followee 에게 알림
-- ────────────────────────────────────────────────
create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.follower_id = new.followee_id then return new; end if;
  insert into public.notifications (user_id, kind, actor_id, target_table, target_id)
  values (new.followee_id, 'follow', new.follower_id, 'user', new.follower_id);
  return new;
end;
$$;

create trigger follows_notify
  after insert on public.follows
  for each row execute function public.notify_on_follow();
