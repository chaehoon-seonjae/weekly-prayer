-- 002c_legacy_tables_authenticated_policies.sql
-- 배경: 대시보드에서 meetings(및 아마 prayers)에 RLS가 켜져 있어 authenticated 역할이 0행을 받는다
--       (anon은 읽힘 → anon 전용 정책만 존재). 새 프론트는 authenticated로 동작하므로
--       스펙 §2 매트릭스의 authenticated 정책을 추가한다. RLS가 꺼진 테이블에서는 정책이 무해(inert).
-- 추가만 한다: 기존 정책·RLS 상태는 건드리지 않는다. 재실행 가능.

-- ---------- 진단(먼저 한 줄씩 실행해 현재 상태를 확인) ----------
-- 기대: 어느 테이블이 rowsecurity = true 인지 확인
select tablename, rowsecurity from pg_tables
 where schemaname = 'public' and tablename in ('meetings', 'prayers', 'members') order by 1;
-- 기대: 기존 정책과 대상 역할(roles) 확인 — {anon}만 있으면 아래 정책이 필요하다
select tablename, policyname, roles, cmd from pg_policies
 where schemaname = 'public' and tablename in ('meetings', 'prayers', 'members') order by 1, 2;

-- ---------- meetings: 전원 읽기 ----------
drop policy if exists meetings_select_authenticated on public.meetings;
create policy meetings_select_authenticated on public.meetings
  for select to authenticated using (true);

-- ---------- prayers: 전원 읽기, 본인 쓰기 (스펙 §2) ----------
drop policy if exists prayers_select_authenticated on public.prayers;
drop policy if exists prayers_insert_self         on public.prayers;
drop policy if exists prayers_update_self         on public.prayers;
drop policy if exists prayers_delete_self         on public.prayers;
create policy prayers_select_authenticated on public.prayers
  for select to authenticated using (true);
create policy prayers_insert_self on public.prayers
  for insert to authenticated with check (profile_id = public.current_profile_id());
create policy prayers_update_self on public.prayers
  for update to authenticated
  using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());
create policy prayers_delete_self on public.prayers
  for delete to authenticated using (profile_id = public.current_profile_id());

-- ---------- 검증 ----------
-- 기대: meetings 1개 + prayers 4개 = 5행, roles가 {authenticated}
select tablename, policyname, roles, cmd from pg_policies
 where schemaname = 'public' and policyname in (
   'meetings_select_authenticated', 'prayers_select_authenticated',
   'prayers_insert_self', 'prayers_update_self', 'prayers_delete_self') order by 1, 2;
