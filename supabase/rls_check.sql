-- rls_check.sql
-- RLS "막혀야 할 것이 막히는지" 검증.
-- 사용법: <USER_A>, <USER_B>를 auth.users.id로 치환한 뒤 SQL Editor에서 전체 실행.
-- 결과는 임시 테이블에 모아 마지막 select 한 번으로 본다(SQL Editor는 마지막 문장 결과만 표시).
-- 테스트 데이터는 날짜 2000-01-01로 넣고 끝에 정리한다. 실행 후 남는 데이터 없음.
-- Phase 2 이후: prayers RLS(003) 활성화 뒤 "B가 A의 prayers UPDATE → 0행" 케이스를 추가한다.
-- ⚠️ Supabase SQL Editor 전용. Editor는 스크립트 전체를 한 트랜잭션으로 실행하므로 중간 오류 시 전부 롤백된다.
--    psql 등에서 BEGIN 없이 실행하면 중단 시 테스트 데이터(2000-01-01 행, prayed_count +1)가 남을 수 있다.

create temp table if not exists rls_results (seq serial, case_name text, pass boolean);
truncate rls_results;
grant all on rls_results to authenticated, anon;
grant usage, select on sequence rls_results_seq_seq to authenticated, anon;

-- 준비(postgres 권한): A에게 2000-01-01 QT 기록
insert into public.qt_records (profile_id, qt_date)
select id, date '2000-01-01' from public.profiles where auth_user_id = '<USER_A>'
on conflict do nothing;

-- ===== B로 전환 =====
set role authenticated;
set request.jwt.claims = '{"sub":"<USER_B>","role":"authenticated"}';

insert into rls_results (case_name, pass)
select 'B는 자기 profile_id를 얻는다', public.current_profile_id() is not null;

insert into rls_results (case_name, pass)
select 'B는 A의 qt_records를 볼 수 없다', count(*) = 0
  from public.qt_records q join public.profiles p on p.id = q.profile_id
 where p.auth_user_id = '<USER_A>';

insert into rls_results (case_name, pass)
select 'B는 모든 profiles를 읽을 수 있다(닉네임 표시)', count(*) >= 2 from public.profiles;

with upd as (
  update public.profiles set nickname = nickname
   where auth_user_id = '<USER_A>' returning 1
)
insert into rls_results (case_name, pass)
select 'B는 A의 profiles를 수정할 수 없다(0행 영향)', count(*) = 0 from upd;

-- B는 2000-01-01에 QT가 없으므로 reflections INSERT가 RLS에 막혀야 한다 (SQLSTATE 42501)
do $$
begin
  insert into public.reflections (profile_id, reflection_date, content)
  values (public.current_profile_id(), date '2000-01-01', 'should fail');
  insert into rls_results (case_name, pass) values ('QT 없이 묵상 INSERT 차단', false);
exception
  when insufficient_privilege then
    insert into rls_results (case_name, pass) values ('QT 없이 묵상 INSERT 차단', true);
  when others then
    insert into rls_results (case_name, pass) values ('QT 없이 묵상 INSERT 차단 (예상 밖 오류: ' || sqlerrm || ')', false);
end $$;

-- B는 A 명의로 qt_records를 넣을 수 없다
do $$
declare v_a uuid;
begin
  select id into v_a from public.profiles where auth_user_id = '<USER_A>';
  insert into public.qt_records (profile_id, qt_date) values (v_a, date '2000-01-02');
  insert into rls_results (case_name, pass) values ('타인 명의 qt_records INSERT 차단', false);
exception
  when insufficient_privilege then
    insert into rls_results (case_name, pass) values ('타인 명의 qt_records INSERT 차단', true);
  when others then
    insert into rls_results (case_name, pass) values ('타인 명의 qt_records INSERT 차단 (예상 밖 오류: ' || sqlerrm || ')', false);
end $$;

-- B는 increment_prayed를 호출할 수 있다 (security definer). 끝에 되돌린다.
insert into rls_results (case_name, pass)
select 'B는 increment_prayed를 호출할 수 있다',
       public.increment_prayed((select id from public.prayers order by id limit 1)) > 0;

-- ===== A로 전환: 2000-01-01 QT가 있으므로 묵상 INSERT 가능 =====
set request.jwt.claims = '{"sub":"<USER_A>","role":"authenticated"}';

with ins as (
  insert into public.reflections (profile_id, reflection_date, content)
  values (public.current_profile_id(), date '2000-01-01', 'rls check') returning 1
)
insert into rls_results (case_name, pass)
select 'A는 QT 완료일에 묵상을 쓸 수 있다', count(*) = 1 from ins;

-- ===== anon: 전부 0행 =====
set role anon;
insert into rls_results (case_name, pass) select 'anon은 profiles를 볼 수 없다',    count(*) = 0 from public.profiles;
insert into rls_results (case_name, pass) select 'anon은 reflections를 볼 수 없다', count(*) = 0 from public.reflections;
insert into rls_results (case_name, pass) select 'anon은 qt_records를 볼 수 없다',  count(*) = 0 from public.qt_records;

-- ===== 정리(postgres 권한) =====
reset role;
reset request.jwt.claims;
delete from public.reflections where reflection_date = date '2000-01-01' and content = 'rls check';
delete from public.qt_records  where qt_date = date '2000-01-01'
  and profile_id = (select id from public.profiles where auth_user_id = '<USER_A>');
update public.prayers set prayed_count = prayed_count - 1
 where id = (select id from public.prayers order by id limit 1);

-- 결과: pass가 전부 true여야 한다 (11행)
select case_name, pass from rls_results order by seq;
