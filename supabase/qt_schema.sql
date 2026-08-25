-- QT / Auth / Profiles schema
-- 기존 prayers 데이터는 유지하고, 새 기능은 별도 테이블로 확장합니다.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  nickname text,
  profile_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qt_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  qt_date date not null,
  created_at timestamptz not null default now(),
  unique(user_id, qt_date)
);

create table if not exists public.qt_reflections (
  id uuid primary key default gen_random_uuid(),
  qt_record_id uuid not null unique references public.qt_records(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(qt_record_id, user_id)
);

create table if not exists public.reflection_reactions (
  id uuid primary key default gen_random_uuid(),
  reflection_id uuid not null references public.qt_reflections(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('grace', 'pray')),
  created_at timestamptz not null default now(),
  unique(reflection_id, user_id, reaction_type)
);

-- 기존 prayers 테이블에 작성자 연결을 확장할 수 있는 선택 사항
-- alter table public.prayers add column if not exists author_user_id uuid references auth.users(id);

-- RLS
alter table public.profiles enable row level security;
alter table public.qt_records enable row level security;
alter table public.qt_reflections enable row level security;
alter table public.reflection_reactions enable row level security;

create policy "profiles_self_read" on public.profiles
for select using (auth.uid() = auth_user_id);

create policy "profiles_self_write" on public.profiles
for insert with check (auth.uid() = auth_user_id);

create policy "profiles_self_update" on public.profiles
for update using (auth.uid() = auth_user_id) with check (auth.uid() = auth_user_id);

create policy "qt_records_self_read" on public.qt_records
for select using (user_id in (select id from public.profiles where auth_user_id = auth.uid()));

create policy "qt_records_self_write" on public.qt_records
for insert with check (user_id in (select id from public.profiles where auth_user_id = auth.uid()));

create policy "qt_records_self_update" on public.qt_records
for update using (user_id in (select id from public.profiles where auth_user_id = auth.uid()));

create policy "qt_reflections_self_read" on public.qt_reflections
for select using (user_id in (select id from public.profiles where auth_user_id = auth.uid()));

create policy "qt_reflections_self_write" on public.qt_reflections
for insert with check (user_id in (select id from public.profiles where auth_user_id = auth.uid()));

create policy "qt_reflections_self_update" on public.qt_reflections
for update using (user_id in (select id from public.profiles where auth_user_id = auth.uid()));

create policy "reflection_reactions_self_read" on public.reflection_reactions
for select using (user_id in (select id from public.profiles where auth_user_id = auth.uid()));

create policy "reflection_reactions_self_write" on public.reflection_reactions
for insert with check (user_id in (select id from public.profiles where auth_user_id = auth.uid()));

create policy "reflection_reactions_self_delete" on public.reflection_reactions
for delete using (user_id in (select id from public.profiles where auth_user_id = auth.uid()));

-- 공개 묵상 feed는 본인 외 공개 상식만 보여주도록 별도 view 사용 권장
create view public.public_qt_reflections as
select
  r.id,
  r.qt_record_id,
  r.user_id,
  p.nickname,
  p.profile_image,
  r.content,
  r.created_at,
  coalesce((select count(*) from public.reflection_reactions rr where rr.reflection_id = r.id and rr.reaction_type = 'grace'), 0) as grace_count,
  coalesce((select count(*) from public.reflection_reactions rr where rr.reflection_id = r.id and rr.reaction_type = 'pray'), 0) as pray_count
from public.qt_reflections r
join public.profiles p on p.id = r.user_id;

-- Optional: create indexes for date/search
create index if not exists idx_qt_records_user_date on public.qt_records(user_id, qt_date);
create index if not exists idx_qt_reflections_user on public.qt_reflections(user_id);
create index if not exists idx_reflection_reactions_reflection on public.reflection_reactions(reflection_id);
