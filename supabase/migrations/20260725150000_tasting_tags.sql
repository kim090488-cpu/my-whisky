-- ────────────────────────────────────────────────
-- 테이스팅 노트에 자유 태그 (사용자 정의)
--   예: #피트, #입문, #가성비, #셰리, #선물용
--   기존 sweetness/smokiness 등 수치와 별개로 카테고리성 태그
-- ────────────────────────────────────────────────

alter table public.tastings
  add column if not exists tags text[] not null default '{}';

-- 태그 GIN 인덱스 (배열 검색 최적화)
create index if not exists tastings_tags_gin_idx
  on public.tastings using gin (tags);

-- posts에도 동일하게
alter table public.posts
  add column if not exists tags text[] not null default '{}';

create index if not exists posts_tags_gin_idx
  on public.posts using gin (tags);

-- 태그 정규화 함수 (트리밍·소문자 아닌 원문 유지, 30자 상한, 최대 10개)
create or replace function public.normalize_tags(input text[])
returns text[]
language plpgsql
immutable
as $$
declare
  cleaned text[];
  t text;
begin
  cleaned := '{}';
  if input is null then return cleaned; end if;
  foreach t in array input loop
    t := trim(both from t);
    if t = '' or length(t) > 30 then continue; end if;
    -- 중복 제거
    if not (cleaned @> array[t]) then
      cleaned := cleaned || t;
    end if;
    -- 최대 10개
    if array_length(cleaned, 1) >= 10 then
      exit;
    end if;
  end loop;
  return cleaned;
end;
$$;

-- tastings·posts INSERT/UPDATE 시 tags 자동 정규화
create or replace function public.normalize_tastings_tags_trigger()
returns trigger
language plpgsql
as $$
begin
  new.tags := public.normalize_tags(new.tags);
  return new;
end;
$$;

drop trigger if exists tastings_normalize_tags on public.tastings;
create trigger tastings_normalize_tags
  before insert or update on public.tastings
  for each row execute function public.normalize_tastings_tags_trigger();

create or replace function public.normalize_posts_tags_trigger()
returns trigger
language plpgsql
as $$
begin
  new.tags := public.normalize_tags(new.tags);
  return new;
end;
$$;

drop trigger if exists posts_normalize_tags on public.posts;
create trigger posts_normalize_tags
  before insert or update on public.posts
  for each row execute function public.normalize_posts_tags_trigger();
