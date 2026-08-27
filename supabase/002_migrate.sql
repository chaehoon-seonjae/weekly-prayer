-- 002_migrate.sql
-- 계정 기반 전환 2단계: members → profiles(자리표시자), prayers.profile_id 채움, 기존 auth.users 백필.
-- 추가/갱신만 하므로 옛 프론트에 영향 없음. 재실행 가능.

begin;

-- (1) members → profiles 자리표시자 (auth_user_id NULL)
insert into public.profiles (nickname, display_order, legacy_member_id)
select m.name, m.display_order, m.id
  from public.members m
 where not exists (select 1 from public.profiles p where p.legacy_member_id = m.id);

-- (2) prayers.profile_id ← member_id
update public.prayers pr
   set profile_id = p.id
  from public.profiles p
 where p.legacy_member_id = pr.member_id
   and pr.profile_id is null;

-- (3) 트리거 생성 이전에 가입한 auth.users 백필
insert into public.profiles (auth_user_id, nickname, profile_image)
select u.id,
       coalesce(
         nullif(u.raw_user_meta_data->>'name', ''),
         nullif(u.raw_user_meta_data->>'full_name', ''),
         nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
         '새 친구'),
       nullif(u.raw_user_meta_data->>'avatar_url', '')
  from auth.users u
 where not exists (select 1 from public.profiles p where p.auth_user_id = u.id);

commit;

-- ---------- 검증 ----------
-- 기대: 0
select count(*) as unmapped_prayers from public.prayers where profile_id is null;
-- 기대: true
select (select count(*) from public.members)
     = (select count(*) from public.profiles where legacy_member_id is not null) as members_all_migrated;
-- 기대: 0행 (003에서 unique(meeting_id, profile_id) 추가 가능)
select meeting_id, profile_id, count(*) from public.prayers group by 1, 2 having count(*) > 1;
-- 기대: 0
select count(*) as users_without_profile
  from auth.users u where not exists (select 1 from public.profiles p where p.auth_user_id = u.id);

-- ---------- 관리자 스니펫: 가입한 순원을 자리표시자에 연결 ----------
-- 사용법:
--   1) 가입자 찾기:
--        select id, email, raw_user_meta_data->>'name' as name, created_at
--          from auth.users order by created_at desc;
--   2) 자리표시자 찾기:
--        select id, nickname, legacy_member_id from public.profiles where auth_user_id is null;
--   3) 아래 블록에서 <AUTH_USER_ID>, <LEGACY_PROFILE_ID> 두 값을 치환 후 실행.
--      트리거가 만든 임시 프로필(B)의 데이터를 자리표시자(A)로 옮기고 B를 삭제한 뒤 A에 계정을 붙인다.
/*
begin;
with b as (
  select id from public.profiles where auth_user_id = '<AUTH_USER_ID>' and legacy_member_id is null
)
update public.prayers set profile_id = '<LEGACY_PROFILE_ID>' where profile_id in (select id from b);
with b as (
  select id from public.profiles where auth_user_id = '<AUTH_USER_ID>' and legacy_member_id is null
)
update public.qt_records set profile_id = '<LEGACY_PROFILE_ID>' where profile_id in (select id from b);
with b as (
  select id from public.profiles where auth_user_id = '<AUTH_USER_ID>' and legacy_member_id is null
)
update public.reflections set profile_id = '<LEGACY_PROFILE_ID>' where profile_id in (select id from b);
with b as (
  select id from public.profiles where auth_user_id = '<AUTH_USER_ID>' and legacy_member_id is null
)
update public.reflection_reactions set profile_id = '<LEGACY_PROFILE_ID>' where profile_id in (select id from b);

delete from public.profiles where auth_user_id = '<AUTH_USER_ID>' and legacy_member_id is null;

update public.profiles
   set auth_user_id = '<AUTH_USER_ID>', updated_at = now()
 where id = '<LEGACY_PROFILE_ID>' and auth_user_id is null;

-- 기대: 1행, auth_user_id가 채워져 있음
select id, nickname, auth_user_id, legacy_member_id from public.profiles where id = '<LEGACY_PROFILE_ID>';
commit;
*/
