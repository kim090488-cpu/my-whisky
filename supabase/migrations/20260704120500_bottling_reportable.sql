-- ────────────────────────────────────────────────────────────────────
-- 보틀링 신고 가능하게 (admin 검토 후 삭제 처리)
-- report_target enum 에 'bottling' 추가, 자가신고 차단 트리거 업데이트
-- ────────────────────────────────────────────────────────────────────

alter type public.report_target add value if not exists 'bottling';

create or replace function public.prevent_self_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  if new.target_table = 'user' then
    if new.target_id = new.reporter_id then
      raise exception '본인을 신고할 수 없어요.';
    end if;
  elsif new.target_table = 'tasting' then
    select user_id into owner_id from public.tastings where id = new.target_id;
    if owner_id is null then
      raise exception '신고할 노트를 찾을 수 없어요.';
    end if;
    if owner_id = new.reporter_id then
      raise exception '본인 노트를 신고할 수 없어요.';
    end if;
  elsif new.target_table = 'comment' then
    select user_id into owner_id from public.tasting_comments where id = new.target_id;
    if owner_id is null then
      raise exception '신고할 댓글을 찾을 수 없어요.';
    end if;
    if owner_id = new.reporter_id then
      raise exception '본인 댓글을 신고할 수 없어요.';
    end if;
  elsif new.target_table = 'bottling' then
    -- 보틀링은 위키식이라 본인 등록 카드도 신고 가능
    -- (잘못 올린 걸 admin 에게 알리는 정상 흐름)
    if not exists (select 1 from public.bottlings where id = new.target_id) then
      raise exception '신고할 보틀링을 찾을 수 없어요.';
    end if;
  end if;
  return new;
end;
$$;
