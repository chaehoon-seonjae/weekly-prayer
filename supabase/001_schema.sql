-- 001_schema.sql
-- 계정 기반 전환 1단계: 신규 테이블·함수·트리거·RLS. 추가만 하므로 옛 프론트에 영향 없음.
-- 재실행 가능(idempotent).

create extension if not exists pgcrypto;

-- ---------- 테이블 ----------

create table if not exists public.profiles (
  id               uuid primary key default gen_random_uuid(),
  auth_user_id     uuid unique references auth.users(id) on delete set null,  -- NULL = 아직 가입하지 않은 기존 순원
  nickname         text not null,
  profile_image    text,
  display_order    int,
  legacy_member_id int unique,                                                  -- members.id 추적용(이관 후 참고)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.prayers
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade;
create index if not exists idx_prayers_profile on public.prayers(profile_id);

create table if not exists public.qt_records (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  qt_date    date not null,
  created_at timestamptz not null default now(),
  unique (profile_id, qt_date)
);

create table if not exists public.reflections (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  reflection_date date not null,
  content         text not null check (length(trim(content)) > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (profile_id, reflection_date)
);
create index if not exists idx_reflections_date on public.reflections(reflection_date desc);

create table if not exists public.reflection_reactions (
  id            uuid primary key default gen_random_uuid(),
  reflection_id uuid not null references public.reflections(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('grace', 'pray')),
  created_at    timestamptz not null default now(),
  unique (reflection_id, profile_id, reaction_type)
);

-- ---------- 함수 ----------

-- 로그인한 사용자의 profiles.id
create or replace function public.current_profile_id()
returns uuid
language sql stable security invoker
set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid()
$$;

-- "기도했어요": 타인 행의 prayed_count만 증가시키는 유일한 경로 (RLS는 컬럼 단위 제한 불가)
create or replace function public.increment_prayed(p_prayer_id bigint)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.prayers
     set prayed_count = coalesce(prayed_count, 0) + 1
   where id = p_prayer_id
  returning prayed_count into v_count;
  if v_count is null then
    raise exception 'prayer not found: %', p_prayer_id;
  end if;
  return v_count;
end
$$;
revoke execute on function public.increment_prayed(bigint) from public, anon;
grant  execute on function public.increment_prayed(bigint) to authenticated;

-- 가입 시 profiles 자동 생성. 닉네임: 카카오 name → full_name → 이메일 앞부분 → '새 친구'
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (auth_user_id, nickname, profile_image)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '새 친구'
    ),
    nullif(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (auth_user_id) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS ----------
-- 모든 정책은 authenticated 한정. anon은 정책이 없어 전부 차단.
-- prayers / meetings의 RLS는 003_cutover.sql에서 활성화 (옛 프론트 보호).

alter table public.profiles             enable row level security;
alter table public.qt_records           enable row level security;
alter table public.reflections          enable row level security;
alter table public.reflection_reactions enable row level security;

-- profiles: 전원 읽기(닉네임 표시), 본인만 수정, INSERT는 트리거만
drop policy if exists profiles_select_all  on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_select_all  on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- qt_records: 완전 비공개
drop policy if exists qt_records_select_self on public.qt_records;
drop policy if exists qt_records_insert_self on public.qt_records;
create policy qt_records_select_self on public.qt_records for select to authenticated
  using (profile_id = public.current_profile_id());
create policy qt_records_insert_self on public.qt_records for insert to authenticated
  with check (profile_id = public.current_profile_id());

-- reflections: 전원 읽기, 본인 쓰기, INSERT는 당일 QT 완료 시에만
drop policy if exists reflections_select_all           on public.reflections;
drop policy if exists reflections_insert_self_after_qt on public.reflections;
drop policy if exists reflections_update_self          on public.reflections;
drop policy if exists reflections_delete_self          on public.reflections;
create policy reflections_select_all on public.reflections for select to authenticated using (true);
create policy reflections_insert_self_after_qt on public.reflections for insert to authenticated
  with check (
    profile_id = public.current_profile_id()
    and exists (
      select 1 from public.qt_records q
       where q.profile_id = public.current_profile_id()
         and q.qt_date = reflection_date
    )
  );
create policy reflections_update_self on public.reflections for update to authenticated
  using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());
create policy reflections_delete_self on public.reflections for delete to authenticated
  using (profile_id = public.current_profile_id());

-- reflection_reactions: 전원 읽기(카운트), 본인 insert/delete (토글)
drop policy if exists reactions_select_all  on public.reflection_reactions;
drop policy if exists reactions_insert_self on public.reflection_reactions;
drop policy if exists reactions_delete_self on public.reflection_reactions;
create policy reactions_select_all  on public.reflection_reactions for select to authenticated using (true);
create policy reactions_insert_self on public.reflection_reactions for insert to authenticated
  with check (profile_id = public.current_profile_id());
create policy reactions_delete_self on public.reflection_reactions for delete to authenticated
  using (profile_id = public.current_profile_id());

-- ---------- 검증 ----------
-- 기대: profiles/qt_records/reflections/reflection_reactions = true, members/meetings/prayers = false
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
-- 기대: 11
select count(*) as policy_count from pg_policies where schemaname = 'public';
-- 기대: current_profile_id, handle_new_user, increment_prayed
select proname from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('current_profile_id', 'increment_prayed', 'handle_new_user') order by 1;
-- 기대: 1행
select tgname from pg_trigger where tgname = 'on_auth_user_created';
