-- ────────────────────────────────────────────────
-- 알림 설정: 유저별 종류 무음
--   profiles 에 boolean 플래그 3개 추가 + 트리거에서 수신자 설정 확인
--   기본값 true — 마이그레이션 후 기존 유저 모두 켜진 상태
-- ────────────────────────────────────────────────
alter table public.profiles
  add column notify_like    boolean not null default true,
  add column notify_comment boolean not null default true,
  add column notify_follow  boolean not null default true;

-- ────────────────────────────────────────────────
-- 좋아요 트리거 재정의: 수신자의 notify_like 확인
-- ────────────────────────────────────────────────
create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  allowed   boolean;
begin
  select user_id into recipient from public.tastings where id = new.tasting_id;
  if recipient is null or recipient = new.user_id then return new; end if;

  select notify_like into allowed from public.profiles where id = recipient;
  if allowed is distinct from true then return new; end if;

  insert into public.notifications (user_id, kind, actor_id, target_table, target_id, payload)
  values (
    recipient, 'like', new.user_id,
    'tasting', new.tasting_id,
    jsonb_build_object('tasting_id', new.tasting_id)
  );
  return new;
end;
$$;

-- ────────────────────────────────────────────────
-- 댓글 트리거 재정의: 수신자별로 notify_comment 확인
--   노트 작성자 / 부모 댓글 작성자 각각 별도 체크
-- ────────────────────────────────────────────────
create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  note_owner    uuid;
  note_allowed  boolean;
  parent_owner  uuid;
  parent_allowed boolean;
begin
  select user_id into note_owner from public.tastings where id = new.tasting_id;

  if note_owner is not null and note_owner <> new.user_id then
    select notify_comment into note_allowed from public.profiles where id = note_owner;
    if note_allowed is true then
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
  end if;

  if new.parent_id is not null then
    select user_id into parent_owner from public.tasting_comments where id = new.parent_id;
    if parent_owner is not null
       and parent_owner <> new.user_id
       and parent_owner <> note_owner then
      select notify_comment into parent_allowed from public.profiles where id = parent_owner;
      if parent_allowed is true then
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
  end if;

  return new;
end;
$$;

-- ────────────────────────────────────────────────
-- 팔로우 트리거 재정의: followee 의 notify_follow 확인
-- ────────────────────────────────────────────────
create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  if new.follower_id = new.followee_id then return new; end if;

  select notify_follow into allowed from public.profiles where id = new.followee_id;
  if allowed is distinct from true then return new; end if;

  insert into public.notifications (user_id, kind, actor_id, target_table, target_id)
  values (new.followee_id, 'follow', new.follower_id, 'user', new.follower_id);
  return new;
end;
$$;
