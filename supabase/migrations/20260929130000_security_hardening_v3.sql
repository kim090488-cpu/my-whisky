-- ────────────────────────────────────────────────
-- Security hardening v3 (Play Store 릴리스 전)
--   1. profiles CHECK 제약 (username·display_name·bio 형식/길이)
--   2. feedback platform CHECK 제약
--   3. rate limit: feedback / bottlings / profile update 시간당 제한
-- ────────────────────────────────────────────────

-- ── 1. profiles 형식/길이 CHECK ──
-- 기존 데이터 위반 여부를 not valid 로 추가 후 validate — 새 데이터부터 강제
-- (username: 3~30자 한글·영문 소문자·숫자·언더스코어)

do $$ begin
  alter table public.profiles
    add constraint profiles_username_shape
    check (username ~ '^[a-z0-9_가-힣]{3,30}$') not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_display_name_len
    check (display_name is null or length(display_name) between 1 and 30) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_bio_len
    check (bio is null or length(bio) <= 300) not valid;
exception when duplicate_object then null;
end $$;

-- 기존 데이터가 이미 규칙을 만족하면 validate 로 fully-enforced 상태 승격.
-- 위반 데이터가 있으면 여기서 실패 → 수동 정리 후 재시도.
alter table public.profiles validate constraint profiles_username_shape;
alter table public.profiles validate constraint profiles_display_name_len;
alter table public.profiles validate constraint profiles_bio_len;

-- ── 2. feedback platform 값 제한 ──
do $$ begin
  alter table public.feedback
    add constraint feedback_platform_values
    check (platform is null or platform in ('ios', 'android', 'web'));
exception when duplicate_object then null;
end $$;

-- ── 3. Rate limit (시간당 insert 카운트) ──
-- 로그인 유저 스팸 방지. 각 테이블별 임계치는 넉넉히 잡음.
--   feedback:  20 / hour (스팸 방지 · 진짜 문의는 무리 없음)
--   bottlings: 30 / hour (열심히 등록해도 30개면 충분)
--   커뮤니티 게시글은 기존 정책 유지 (변경 X)

create or replace function public.enforce_hourly_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit  int    := tg_argv[0]::int;
  v_column text   := tg_argv[1];            -- 'user_id' | 'created_by' 등
  v_uid    uuid   := auth.uid();
  v_count  int;
begin
  -- service_role · admin 은 통과 (테스트/시딩용)
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if v_uid is null then
    return new;  -- 익명 insert는 별도 RLS가 막음
  end if;

  execute format(
    'select count(*) from public.%I where %I = $1 and created_at > now() - interval ''1 hour''',
    tg_table_name, v_column
  ) into v_count using v_uid;

  if v_count >= v_limit then
    raise exception '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요. (시간당 % 건 제한)', v_limit
      using errcode = '54000';
  end if;

  return new;
end;
$$;

drop trigger if exists feedback_rate_limit on public.feedback;
create trigger feedback_rate_limit
  before insert on public.feedback
  for each row
  execute function public.enforce_hourly_rate_limit(20, 'user_id');

drop trigger if exists bottlings_rate_limit on public.bottlings;
create trigger bottlings_rate_limit
  before insert on public.bottlings
  for each row
  execute function public.enforce_hourly_rate_limit(30, 'created_by');

comment on function public.enforce_hourly_rate_limit() is
  '시간당 insert 카운트 제한. tg_argv[0]=임계치, tg_argv[1]=owner 컬럼명 (user_id/created_by).';
