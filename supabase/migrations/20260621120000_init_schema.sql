-- ────────────────────────────────────────────────
-- extensions (citext = case-insensitive text, username 중복 방지에 사용)
-- ────────────────────────────────────────────────
create extension if not exists citext;

-- ────────────────────────────────────────────────
-- profiles: auth.users 확장 — 닉네임·아바타·소개
-- ────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     citext not null unique,
  display_name text,
  bio          text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index profiles_username_lower_idx on public.profiles (lower(username));

-- ────────────────────────────────────────────────
-- distilleries: 증류소 마스터 (위키 스타일 — 누구나 제안, 큐레이션은 추후)
-- ────────────────────────────────────────────────
create type distillery_status as enum ('active', 'silent', 'closed', 'demolished', 'planned');
create type whisky_country as enum (
  'scotland', 'ireland', 'usa', 'canada', 'japan', 'india',
  'taiwan', 'australia', 'france', 'sweden', 'germany',
  'south_korea', 'other'
);

create table public.distilleries (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  country       whisky_country not null,
  region        text,                    -- "Speyside", "Islay", "Highland" 등
  status        distillery_status not null default 'active',
  founded_year  smallint,
  closed_year   smallint,
  website       text,
  lat           double precision,
  lng           double precision,
  description   text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index distilleries_name_country_uniq on public.distilleries (lower(name), country);
create index distilleries_country_region_idx on public.distilleries (country, region);

-- ────────────────────────────────────────────────
-- bottlings: 특정 출시 제품 ("Macallan 18 Sherry Oak 2022")
-- ────────────────────────────────────────────────
create type bottler_kind as enum ('official', 'independent', 'private');
create type cask_type as enum (
  'bourbon', 'sherry', 'port', 'wine', 'rum',
  'virgin_oak', 'refill', 'mixed', 'other', 'unknown'
);

create table public.bottlings (
  id              uuid primary key default gen_random_uuid(),
  distillery_id   uuid not null references public.distilleries(id) on delete cascade,
  name            text not null,           -- "18 Year Old Sherry Oak"
  age_years       smallint,                -- NULL이면 NAS
  abv             numeric(4,1),            -- 40.0, 43.0, 46.0, 60.5 등
  vintage_year    smallint,
  bottling_year   smallint,
  cask_type       cask_type default 'unknown',
  bottler         bottler_kind not null default 'official',
  bottler_name    text,                    -- IB일 때 "Signatory Vintage" 등
  bottle_size_ml  smallint default 700,
  total_bottles   integer,                 -- 한정판 병수
  barcode         text,
  label_image_url text,
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index bottlings_distillery_idx on public.bottlings (distillery_id);
create index bottlings_age_idx on public.bottlings (distillery_id, age_years);
create unique index bottlings_barcode_uniq on public.bottlings (barcode) where barcode is not null;

-- ────────────────────────────────────────────────
-- tastings: 사용자 테이스팅 노트 (보틀링 1개를 여러 번 마실 수 있음)
-- ────────────────────────────────────────────────
create type tasting_visibility as enum ('public', 'followers', 'private');

create table public.tastings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  bottling_id   uuid not null references public.bottlings(id) on delete cascade,
  tasted_at     date not null default current_date,
  score         smallint check (score between 0 and 100),  -- 100점 만점 (Whiskybase 스타일)
  nose          text,
  palate        text,
  finish        text,
  overall       text,
  color         text,
  photos        text[] not null default '{}',
  visibility    tasting_visibility not null default 'public',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index tastings_user_idx on public.tastings (user_id, tasted_at desc);
create index tastings_bottling_idx on public.tastings (bottling_id);
create index tastings_public_idx on public.tastings (bottling_id, tasted_at desc) where visibility = 'public';

-- ────────────────────────────────────────────────
-- collection_items: 내 컬렉션 / 위시리스트
-- ────────────────────────────────────────────────
create type collection_status as enum ('owned', 'opened', 'finished', 'wishlist');

create table public.collection_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  bottling_id     uuid not null references public.bottlings(id) on delete cascade,
  status          collection_status not null default 'owned',
  quantity        smallint not null default 1 check (quantity >= 0),
  purchase_price  numeric(10,2),
  purchase_currency text default 'KRW',
  purchase_date   date,
  purchase_place  text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index collection_items_user_bottling_uniq
  on public.collection_items (user_id, bottling_id);

create index collection_items_user_status_idx
  on public.collection_items (user_id, status);

-- ────────────────────────────────────────────────
-- updated_at 자동 갱신
-- ────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger distilleries_set_updated_at
  before update on public.distilleries
  for each row execute function public.set_updated_at();

create trigger bottlings_set_updated_at
  before update on public.bottlings
  for each row execute function public.set_updated_at();

create trigger tastings_set_updated_at
  before update on public.tastings
  for each row execute function public.set_updated_at();

create trigger collection_items_set_updated_at
  before update on public.collection_items
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────
-- RLS
--   distilleries/bottlings: 위키 스타일 — 누구나 read, 로그인 사용자가 추가, 본인 또는 admin 수정
--   tastings: visibility 따라 read, 본인만 write
--   collection_items: 본인만 read/write (프라이버시)
--   profiles: read 공개, 본인만 update
-- ────────────────────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.distilleries     enable row level security;
alter table public.bottlings        enable row level security;
alter table public.tastings         enable row level security;
alter table public.collection_items enable row level security;

-- profiles
create policy "profiles read all" on public.profiles
  for select using (true);
create policy "profiles insert self" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles update self" on public.profiles
  for update using (auth.uid() = id);

-- distilleries (위키 스타일)
create policy "distilleries read all" on public.distilleries
  for select using (true);
create policy "distilleries insert authed" on public.distilleries
  for insert with check (auth.uid() is not null and auth.uid() = created_by);
create policy "distilleries update creator" on public.distilleries
  for update using (auth.uid() = created_by);

-- bottlings (위키 스타일)
create policy "bottlings read all" on public.bottlings
  for select using (true);
create policy "bottlings insert authed" on public.bottlings
  for insert with check (auth.uid() is not null and auth.uid() = created_by);
create policy "bottlings update creator" on public.bottlings
  for update using (auth.uid() = created_by);

-- tastings (visibility 기반)
create policy "tastings read public" on public.tastings
  for select using (
    visibility = 'public'
    or auth.uid() = user_id
    -- followers 정책은 follows 테이블 도입 후 별도 마이그레이션에서 추가
  );
create policy "tastings insert self" on public.tastings
  for insert with check (auth.uid() = user_id);
create policy "tastings update self" on public.tastings
  for update using (auth.uid() = user_id);
create policy "tastings delete self" on public.tastings
  for delete using (auth.uid() = user_id);

-- collection_items (완전 private)
create policy "collection read self" on public.collection_items
  for select using (auth.uid() = user_id);
create policy "collection insert self" on public.collection_items
  for insert with check (auth.uid() = user_id);
create policy "collection update self" on public.collection_items
  for update using (auth.uid() = user_id);
create policy "collection delete self" on public.collection_items
  for delete using (auth.uid() = user_id);

-- ────────────────────────────────────────────────
-- profile 자동 생성 트리거
-- ────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'user_' || substr(new.id::text, 1, 8),
    coalesce(new.raw_user_meta_data->>'display_name', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
