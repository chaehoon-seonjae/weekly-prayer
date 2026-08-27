-- 002b_prayers_member_nullable.sql
-- 새 프론트는 prayers를 profile_id로 작성하며, member_id는 옛 프론트 호환용으로
-- profiles.legacy_member_id(없으면 NULL)를 넣는다. 옛 앱이 만든 NOT NULL 제약이 있으면 해제한다.
-- 추가형(제약 완화)이므로 옛 프론트 영향 없음. 이미 nullable이어도 오류 없이 통과(재실행 가능).

alter table public.prayers alter column member_id drop not null;

-- 기대: YES
select is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'prayers' and column_name = 'member_id';
