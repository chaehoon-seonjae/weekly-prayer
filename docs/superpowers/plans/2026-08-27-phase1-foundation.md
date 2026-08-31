# Phase 1 — 기반(스키마·마이그레이션·모듈 구조·인증) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supabase에 계정 기반 스키마를 추가·이관하고, ES 모듈 구조의 프론트 골격 위에 세션이 유지되는 이메일 로그인/로그아웃/프로필 화면을 완성한다.

**Architecture:** 브라우저 네이티브 ES 모듈(`js/main.js` 진입점). Supabase를 아는 코드는 `js/supabase.js`와 각 모듈의 `api` 성격 함수에만 둔다. 화면 모듈은 `state.js`에 `registerPage()`로 등록되고 `render()`가 `appState.view`로 디스패치한다(순환 import 방지). 인증 상태 전환의 단일 진입점은 `onAuthStateChange`.

**Tech Stack:** HTML/CSS/JS(프레임워크·번들러 없음), supabase-js v2 (UMD CDN), Supabase Auth/PostgreSQL/RLS, Node 22 내장 테스트 러너(`node --test`).

**Spec:** `docs/superpowers/specs/2026-08-27-account-based-supabase-migration-design.md`

## Global Constraints

- **`main`에 머지·배포 금지 (Phase 5 전까지).** Netlify가 `main`을 자동 배포하면 운영 중인 기도제목 앱이 중단된다. 브랜치 `feat/account-based`에서 작업하고 로컬 서버로만 확인한다.
- SQL(001, 002)은 **추가만** 하므로 운영 Supabase에 바로 실행해도 옛 프론트가 계속 동작한다. `prayers`/`meetings`에 RLS를 켜거나 `members`를 건드리는 것은 Phase 5(`003_cutover.sql`)에서만.
- Supabase URL/Key는 `js/supabase.js` **한 곳에만**. Secret/Service Role Key는 어디에도 넣지 않는다.
- 순수 함수 모듈은 `window`, `document`, `supabase`, `Date.now()`를 import·참조하지 않는다(Node에서 테스트되어야 함).
- 모든 사용자 노출 문구는 한국어. 기존 톤("~했어요", "~해 주세요") 유지.
- 기존 파일 `app.js`, `qt.js`, `prayer.js`, `_tmp_check.js`는 이 Phase에서 **삭제하지 않는다**(Phase 2~5에서 이식 후 삭제). `index.html`에서 참조만 끊는다.
- 운영 DB 확인값(2026-08-27): `members.id`·`meetings.id`·`prayers.id`·`prayers.member_id`는 정수. `profiles`/`qt_*` 테이블은 존재하지 않음(구 `qt_schema.sql` 미적용). 순원 9명, 순모임 10회, 기도제목 23건.
- 스펙 4장 `ui/`에 `screens.js`(로딩/연결 오류/프로필 대기 화면)를 추가한다. 스펙에 없던 파일이지만 세 화면이 어느 모듈에도 속하지 않아 분리했다.
- 스펙 3장의 `getSession()` 호출은 생략하고 `onAuthStateChange`의 `INITIAL_SESSION` 이벤트로 대체한다(supabase-js v2가 구독 직후 발생시킴). 초기 진입 경로를 하나로 유지하기 위함이며 효과는 동일.

---

## 파일 구조 (이 Phase에서 생성/변경)

| 파일 | 책임 |
|---|---|
| `package.json` (생성) | `"type":"module"`, `npm test` → `node --test 'tests/**/*.test.js'`(Node 22.19에서 디렉터리 인자 `tests/`는 MODULE_NOT_FOUND). 의존성 없음 |
| `tests/dom.test.js`, `tests/auth-errors.test.js` (생성) | 순수 함수 테스트 |
| `supabase/001_schema.sql` (생성) | 신규 테이블·함수·트리거·RLS |
| `supabase/002_migrate.sql` (생성) | members→profiles, prayers.profile_id 채움, auth.users 백필, 연결 스니펫 |
| `supabase/rls_check.sql` (생성) | RLS 부정 케이스 검증 |
| `index.html` (수정) | 모듈 진입점 1개, CSS 경로 변경, 제목 변경 |
| `css/style.css` (이동) | `style.css` → `css/style.css` (내용 변경 없음) |
| `assets/plants/.gitkeep` (생성) | 디렉터리 확보 |
| `js/supabase.js` | 클라이언트 단일 생성 |
| `js/state.js` | `appState`, `registerPage`, `render`, `navigate`, `renderShell`, `resetState` |
| `js/ui/dom.js` | `escapeHtml`, `setApp` |
| `js/ui/toast.js` | `showToast` |
| `js/ui/sheet.js` | `openSheet`, `closeSheet` (prayer.js에서 이동) |
| `js/ui/nav.js` | `renderBottomNav`, `bindBottomNav` |
| `js/ui/screens.js` | `renderLoading`, `renderConnectionError`, `renderProfilePending` |
| `js/auth/errors.js` | `mapAuthError` (순수) |
| `js/auth/session.js` | `onAuthStateChange`, `signInWithEmail`, `signUpWithEmail`, `signInWithKakao`, `signOut` |
| `js/auth/profile.js` | `loadProfile`, `loadProfiles`, `updateNickname`, `renderMyPage` |
| `js/auth/loginPage.js` | `renderLoginPage` |
| `js/main.js` | 진입점: 페이지 등록, 인증 이벤트 → 화면 전환, bootstrap |

---

### Task 0: 브랜치 준비

**Files:** 없음

- [ ] **Step 1: 작업 브랜치 생성**

```bash
git checkout -b feat/account-based
```

- [ ] **Step 2: 확인**

Run: `git branch --show-current`
Expected: `feat/account-based`

---

### Task 1: 테스트 인프라 + `ui/dom.js`

**Files:**
- Create: `package.json`
- Create: `js/ui/dom.js`
- Test: `tests/dom.test.js`

**Interfaces:**
- Produces: `escapeHtml(value: unknown): string` — `& < > " '`를 엔티티로 치환, `null/undefined` → `''`. `setApp(html: string): void` — `#app`의 innerHTML 설정.

- [ ] **Step 1: package.json 생성**

```json
{
  "name": "qt-and-prayer",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test 'tests/**/*.test.js'"
  }
}
```

- [ ] **Step 2: 실패하는 테스트 작성** — `tests/dom.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../js/ui/dom.js';

test('escapeHtml: HTML 특수문자 5종을 엔티티로 치환한다', () => {
  assert.equal(escapeHtml(`<b>&"'</b>`), '&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');
});

test('escapeHtml: null/undefined는 빈 문자열', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('escapeHtml: 문자열이 아닌 값은 문자열로 변환한다', () => {
  assert.equal(escapeHtml(42), '42');
});
```

- [ ] **Step 3: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../js/ui/dom.js'`

- [ ] **Step 4: 구현** — `js/ui/dom.js`

```js
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function setApp(html) {
  document.getElementById('app').innerHTML = html;
}
```

- [ ] **Step 5: 통과 확인**

Run: `npm test`
Expected: `# pass 3`, `# fail 0`

- [ ] **Step 6: 커밋**

```bash
git add package.json js/ui/dom.js tests/dom.test.js
git commit -m "chore: node --test 기반 테스트 셋업 및 ui/dom.js 추가"
```

---

### Task 2: `auth/errors.js` — Supabase 인증 오류 한글 매핑

**Files:**
- Create: `js/auth/errors.js`
- Test: `tests/auth-errors.test.js`

**Interfaces:**
- Produces: `mapAuthError(error: string | { message?: string } | null): string` — 알려진 3개 메시지는 한글로, 그 외는 원문, 비어 있으면 기본 문구.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/auth-errors.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapAuthError } from '../js/auth/errors.js';

test('알려진 오류 3종을 한글로 매핑한다', () => {
  assert.equal(mapAuthError('Invalid login credentials'), '이메일 또는 비밀번호가 올바르지 않아요');
  assert.equal(mapAuthError('User already registered'), '이미 가입된 이메일이에요');
  assert.equal(mapAuthError('Email not confirmed'), '이메일 인증을 완료해 주세요');
});

test('Error 객체의 message도 처리한다', () => {
  assert.equal(mapAuthError(new Error('Invalid login credentials')), '이메일 또는 비밀번호가 올바르지 않아요');
});

test('모르는 메시지는 원문을 그대로 돌려준다', () => {
  assert.equal(mapAuthError('Password should be at least 6 characters'), 'Password should be at least 6 characters');
});

test('비어 있으면 기본 문구', () => {
  assert.equal(mapAuthError(null), '로그인 중 문제가 발생했어요');
  assert.equal(mapAuthError(''), '로그인 중 문제가 발생했어요');
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../js/auth/errors.js'`

- [ ] **Step 3: 구현** — `js/auth/errors.js`

```js
const MESSAGES = [
  ['Invalid login credentials', '이메일 또는 비밀번호가 올바르지 않아요'],
  ['User already registered', '이미 가입된 이메일이에요'],
  ['Email not confirmed', '이메일 인증을 완료해 주세요'],
];

export function mapAuthError(error) {
  const raw = typeof error === 'string' ? error : error?.message || '';
  const hit = MESSAGES.find(([en]) => raw.includes(en));
  if (hit) return hit[1];
  return raw || '로그인 중 문제가 발생했어요';
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: `# pass 7`, `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add js/auth/errors.js tests/auth-errors.test.js
git commit -m "feat(auth): Supabase 인증 오류 메시지 한글 매핑"
```

---

### Task 3: `001_schema.sql` — 신규 테이블·함수·트리거·RLS

**Files:**
- Create: `supabase/001_schema.sql`

**Interfaces:**
- Produces (DB): 테이블 `profiles`, `qt_records`, `reflections`, `reflection_reactions`; 컬럼 `prayers.profile_id uuid null`; 함수 `current_profile_id() returns uuid`, `increment_prayed(p_prayer_id bigint) returns int`; 트리거 `on_auth_user_created`.

- [ ] **Step 1: 백업 (마이그레이션 0단계)**

Supabase 대시보드 → Table Editor → `members`, `meetings`, `prayers` 각각 "Export to CSV". 파일 3개를 로컬(레포 밖)에 보관한다.

- [ ] **Step 2: SQL 파일 작성** — `supabase/001_schema.sql`

```sql
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
-- 컬럼 단위 제한: 본인 행이라도 nickname / profile_image / updated_at 외 컬럼(legacy_member_id, display_order 등)은 수정 불가
revoke update on public.profiles from authenticated;
grant  update (nickname, profile_image, updated_at) on public.profiles to authenticated;

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
```

- [ ] **Step 3: 운영 Supabase에서 실행**

Supabase 대시보드 → SQL Editor → 파일 내용 전체 붙여넣기 → Run.
Expected: 오류 없음. 마지막 4개 검증 결과가 각 주석의 기대값과 일치.

- [ ] **Step 4: 옛 프론트 정상 동작 확인**

현재 배포된 사이트(또는 로컬에서 기존 `index.html`)를 열어 기도제목 목록이 여전히 표시되는지 확인.
Expected: 변화 없음 (추가만 했으므로).

- [ ] **Step 5: 커밋**

```bash
git add supabase/001_schema.sql
git commit -m "feat(db): 계정 기반 스키마·함수·트리거·RLS 추가 (001)"
```

---

### Task 4: `002_migrate.sql` — 데이터 이관 + 연결 스니펫

**Files:**
- Create: `supabase/002_migrate.sql`

**Interfaces:**
- Consumes: Task 3의 테이블/컬럼.
- Produces (DB): `profiles`에 순원 9명(자리표시자), `prayers.profile_id` 전부 채워짐, 기존 `auth.users`마다 `profiles` 행 존재.

- [ ] **Step 1: SQL 파일 작성** — `supabase/002_migrate.sql`

```sql
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
-- SQL Editor는 마지막 문장 결과만 표시하므로, 아래 4개는 한 줄씩 개별 실행한다(모두 읽기 전용).
-- 기대: 0
select count(*) as unmapped_prayers from public.prayers where profile_id is null;
-- 기대: true
select (select count(*) from public.members)
     = (select count(*) from public.profiles where legacy_member_id is not null) as members_all_migrated;
-- 기대: 0행 (003에서 unique(meeting_id, profile_id) 추가 가능)
select meeting_id, profile_id, count(*) from public.prayers where profile_id is not null group by 1, 2 having count(*) > 1;
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

-- B를 참조하는 행이 남아 있으면 지우지 않는다(부분 실행 시 cascade 손실 방지). 그 경우 아래 update가 unique 충돌로 중단된다.
delete from public.profiles p
 where p.auth_user_id = '<AUTH_USER_ID>' and p.legacy_member_id is null
   and not exists (select 1 from public.prayers              where profile_id = p.id)
   and not exists (select 1 from public.qt_records           where profile_id = p.id)
   and not exists (select 1 from public.reflections          where profile_id = p.id)
   and not exists (select 1 from public.reflection_reactions where profile_id = p.id);

update public.profiles
   set auth_user_id = '<AUTH_USER_ID>', updated_at = now()
 where id = '<LEGACY_PROFILE_ID>' and auth_user_id is null;
commit;

-- 기대: 1행, auth_user_id가 채워져 있음 (SQL Editor는 마지막 문장 결과만 표시하므로 commit 뒤에 둔다)
select id, nickname, auth_user_id, legacy_member_id from public.profiles where id = '<LEGACY_PROFILE_ID>';
*/
```

- [ ] **Step 2: 운영 Supabase에서 실행**

SQL Editor에 파일 전체 붙여넣기(주석 블록 포함 그대로) → Run.
Expected: 오류 없음. 이어서 검증 쿼리 4개를 **한 줄씩 개별 실행** — `unmapped_prayers = 0`, `members_all_migrated = true`, 중복 0행, `users_without_profile = 0`.

- [ ] **Step 3: 이관 결과 눈으로 확인**

SQL Editor:
```sql
select p.nickname, p.legacy_member_id, count(pr.id) as prayers
  from public.profiles p left join public.prayers pr on pr.profile_id = p.id
 group by p.id order by p.display_order nulls last;
```
Expected: 9행(순원) + 백필된 계정 수. 기도제목 합계 23.

- [ ] **Step 4: 옛 프론트 정상 동작 확인**

배포 사이트에서 기도제목 목록·작성이 여전히 동작하는지 확인. Expected: 변화 없음.

- [ ] **Step 5: 커밋**

```bash
git add supabase/002_migrate.sql
git commit -m "feat(db): members→profiles 이관 및 연결 스니펫 (002)"
```

---

### Task 5: 공통 모듈 — `supabase.js`, `ui/toast.js`, `ui/sheet.js`, `ui/nav.js`, `ui/screens.js`, `state.js`

**Files:**
- Create: `js/supabase.js`, `js/ui/toast.js`, `js/ui/sheet.js`, `js/ui/nav.js`, `js/ui/screens.js`, `js/state.js`
- Reference: `prayer.js:427-447` (openSheet/closeSheet 원본)

**Interfaces:**
- Consumes: `escapeHtml`, `setApp` (Task 1)
- Produces:
  - `supabase` — supabase-js 클라이언트 인스턴스
  - `showToast(message: string): void`
  - `openSheet(html: string): HTMLElement`, `closeSheet(): void`
  - `renderBottomNav(activeView: 'qt'|'prayer'|'my'): string`, `bindBottomNav(onSelect: (view) => void): void`
  - `renderLoading(): void`, `renderConnectionError(message: string): void`, `renderProfilePending(): void`
  - `appState` (아래 형태), `resetState(): void`, `registerPage(view, renderFn): void`, `render(): void`, `navigate(view): void`, `renderShell(contentHtml: string): void`

브라우저 전용 모듈이라 자동 테스트 없음. Task 7에서 화면으로 검증한다.

- [ ] **Step 1: `js/supabase.js`**

```js
// Supabase 클라이언트 단일 생성. URL/Key는 이 파일에만 둔다. (Publishable key — 클라이언트 노출 허용)
const SUPABASE_URL = 'https://jjubqeqqtvjvxlbnnuyt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vKXSP4T6JYQrZmSpdbf-zg_6msfRmgJ';

if (!window.supabase) {
  throw new Error('supabase-js가 로드되지 않았습니다. index.html의 CDN <script>를 확인해 주세요.');
}

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
```

- [ ] **Step 2: `js/ui/toast.js`**

```js
let timer;

export function showToast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), 1800);
}
```

- [ ] **Step 3: `js/ui/sheet.js`** (prayer.js의 openSheet/closeSheet 이동, 동작 동일)

```js
export function openSheet(html) {
  const overlay = document.getElementById('overlay');
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.id = 'activeSheet';
  sheet.innerHTML = '<div class="sheet-handle"></div>' + html;
  document.body.appendChild(sheet);
  overlay.classList.add('show');
  requestAnimationFrame(() => sheet.classList.add('show'));
  overlay.onclick = closeSheet;
  return sheet;
}

export function closeSheet() {
  const overlay = document.getElementById('overlay');
  const sheet = document.getElementById('activeSheet');
  overlay.classList.remove('show');
  if (sheet) {
    sheet.classList.remove('show');
    setTimeout(() => sheet.remove(), 250);
  }
}
```

- [ ] **Step 4: `js/ui/nav.js`**

```js
const ITEMS = [
  { key: 'qt', label: 'QT', icon: '🌱' },
  { key: 'prayer', label: '기도제목', icon: '🙏' },
  { key: 'my', label: 'MY', icon: '👤' },
];

export function renderBottomNav(activeView) {
  return `
    <nav class="app-nav">
      ${ITEMS.map(item => `
        <button type="button" class="${activeView === item.key ? 'active' : ''}" data-nav="${item.key}">
          <span class="icon">${item.icon}</span>
          <span>${item.label}</span>
        </button>
      `).join('')}
    </nav>
  `;
}

export function bindBottomNav(onSelect) {
  document.querySelectorAll('[data-nav]').forEach(button => {
    button.onclick = () => onSelect(button.dataset.nav);
  });
}
```

- [ ] **Step 5: `js/ui/screens.js`**

```js
import { escapeHtml, setApp } from './dom.js';

export function renderLoading() {
  setApp(`
    <div class="week-header" style="opacity:.5"></div>
    <div class="cards" style="margin-top:20px;">
      ${[1, 2, 3].map(() => `
        <div class="skeleton">
          <div class="sk-line" style="width:30%"></div>
          <div class="sk-line" style="width:90%"></div>
          <div class="sk-line" style="width:70%"></div>
        </div>
      `).join('')}
    </div>
  `);
}

export function renderConnectionError(message) {
  setApp(`
    <div class="week-header">
      <div class="eyebrow">연결 상태</div>
      <h1>불러오지 못했어요</h1>
      <div class="date" style="margin-top:8px; line-height:1.6;">${escapeHtml(message)}</div>
    </div>
    <div class="empty-card">
      <div class="sun-icon">☁️</div>
      <div>네트워크 상태를 확인한 뒤 새로고침해 주세요.</div>
    </div>
  `);
}

export function renderProfilePending() {
  setApp(`
    <div class="empty-card" style="margin-top:40px;">
      <div class="sun-icon">🌤️</div>
      <div>프로필을 준비하고 있어요.<br/>잠시 후 새로고침해 주세요.</div>
    </div>
  `);
}
```

- [ ] **Step 6: `js/state.js`**

```js
import { setApp } from './ui/dom.js';
import { renderBottomNav, bindBottomNav } from './ui/nav.js';

function initialState() {
  return {
    view: 'qt',                 // 'qt' | 'prayer' | 'my'
    qtTab: 'my',                // 'my' | 'feed'
    auth: { user: null, profile: null },
    qt: { records: [], month: new Date() },
    feed: { items: [] },
    prayer: { meetings: [], prayers: [], profiles: [], currentMeetingId: null, collapsed: {} },
  };
}

export const appState = initialState();

export function resetState() {
  Object.assign(appState, initialState());
}

// 화면 모듈이 자기 렌더 함수를 등록한다. state.js는 화면 모듈을 import하지 않는다(순환 방지).
const pages = new Map();

export function registerPage(view, renderFn) {
  pages.set(view, renderFn);
}

export function render() {
  const page = pages.get(appState.view);
  if (!page) throw new Error(`등록되지 않은 화면: ${appState.view}`);
  page();
}

export function navigate(view) {
  appState.view = view;
  render();
}

// 본문 + 하단 탭을 함께 그리고 탭 이벤트를 바인딩한다. 각 화면은 이 함수 뒤에 자기 이벤트를 바인딩한다.
export function renderShell(contentHtml) {
  setApp(`${contentHtml}${renderBottomNav(appState.view)}`);
  bindBottomNav(navigate);
}
```

- [ ] **Step 7: 구문 검사**

Run: `for f in js/supabase.js js/ui/toast.js js/ui/sheet.js js/ui/nav.js js/ui/screens.js js/state.js; do node --check "$f" && echo "ok $f"; done`
Expected: 6개 모두 `ok`

- [ ] **Step 8: 커밋**

```bash
git add js/supabase.js js/ui/toast.js js/ui/sheet.js js/ui/nav.js js/ui/screens.js js/state.js
git commit -m "feat: ES 모듈 공통 계층(supabase 클라이언트, ui, state) 추가"
```

---

### Task 6: `auth/session.js`, `auth/profile.js`(API 부분)

**Files:**
- Create: `js/auth/session.js`
- Create: `js/auth/profile.js` (렌더 함수는 Task 8에서 추가)

**Interfaces:**
- Consumes: `supabase` (Task 5)
- Produces:
  - `onAuthStateChange(handler: (event: string, session: Session|null) => void): () => void` — 구독 해제 함수 반환. **핸들러는 `setTimeout(…, 0)`으로 지연 호출**한다(supabase-js 문서: 콜백 안에서 동기적으로 supabase 호출 시 교착 가능).
  - `signInWithEmail(email, password): Promise<{ user, session }>`
  - `signUpWithEmail(email, password): Promise<{ user, session }>` — 이메일 확인이 켜져 있으면 `session === null`
  - `signInWithKakao(): Promise<void>` — 리다이렉트 시작
  - `signOut(): Promise<void>`
  - `loadProfile(authUserId: string): Promise<Profile|null>`
  - `loadProfiles(): Promise<Profile[]>` — `display_order` 오름차순(null 뒤), 그다음 `nickname`
  - `updateNickname(profileId: string, nickname: string): Promise<Profile>`
  - `Profile = { id, auth_user_id, nickname, profile_image, display_order, legacy_member_id, created_at, updated_at }`

- [ ] **Step 1: `js/auth/session.js`**

```js
import { supabase } from '../supabase.js';

// 인증 상태 변화의 단일 진입점. INITIAL_SESSION(구독 직후) / SIGNED_IN / SIGNED_OUT 등이 들어온다.
export function onAuthStateChange(handler) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    // 콜백 안에서 동기적으로 supabase를 호출하면 교착될 수 있어 다음 틱으로 미룬다.
    setTimeout(() => handler(event, session), 0);
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithKakao() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: location.origin + location.pathname },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
```

- [ ] **Step 2: `js/auth/profile.js`** (API 부분만)

```js
import { supabase } from '../supabase.js';

export async function loadProfile(authUserId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('nickname', { ascending: true });
  if (error) throw error;
  return data;
}

export async function updateNickname(profileId, nickname) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ nickname, updated_at: new Date().toISOString() })
    .eq('id', profileId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 3: 구문 검사**

Run: `node --check js/auth/session.js && node --check js/auth/profile.js && echo ok`
Expected: `ok`

- [ ] **Step 4: 커밋**

```bash
git add js/auth/session.js js/auth/profile.js
git commit -m "feat(auth): 세션·프로필 API 모듈 추가"
```

---

### Task 7: 로그인 페이지 + `main.js` + `index.html` 모듈 전환 → 로그인/세션 유지/로그아웃 검증

**Files:**
- Create: `js/auth/loginPage.js`, `js/main.js`, `assets/plants/.gitkeep`
- Move: `style.css` → `css/style.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: Task 1·2·5·6의 모든 export
- Produces: `renderLoginPage(message?: string, isError?: boolean): void`. `main.js`는 `registerPage('qt'|'prayer'|'my', …)`로 3화면을 등록(qt/prayer는 이 Phase에선 "준비 중" 자리표시자, `my`는 Task 8에서 `renderMyPage`로 교체).

- [ ] **Step 1: `js/auth/loginPage.js`**

```js
import { escapeHtml, setApp } from '../ui/dom.js';
import { mapAuthError } from './errors.js';
import { signInWithEmail, signUpWithEmail, signInWithKakao } from './session.js';

export function renderLoginPage(message = '', isError = true) {
  setApp(`
    <div class="qt-shell">
      <div class="auth-card">
        <div class="my-header">
          <div class="my-avatar">🌱</div>
          <div>
            <div class="my-name">QT &amp; Prayer</div>
            <div class="my-sub">로그인하고 순모임과 함께해요</div>
          </div>
        </div>
        <div class="field-row">
          <input id="authEmail" type="email" placeholder="이메일" autocomplete="email" />
          <input id="authPassword" type="password" placeholder="비밀번호" autocomplete="current-password" />
          <button type="button" data-auth="login">로그인</button>
          <button type="button" data-auth="signup" style="background:linear-gradient(180deg,#d9efe0,#bfe7c9); color:#235436;">회원가입</button>
          <button type="button" data-auth="kakao" style="background:#FEE500; color:#191919;">카카오로 시작하기</button>
        </div>
        ${message ? `<div class="${isError ? 'error-block' : 'nudge'}">${escapeHtml(message)}</div>` : ''}
      </div>
    </div>
  `);
  bindLoginEvents();
}

function readForm() {
  return {
    email: document.getElementById('authEmail')?.value.trim() || '',
    password: document.getElementById('authPassword')?.value || '',
  };
}

function bindLoginEvents() {
  document.querySelectorAll('[data-auth]').forEach(button => {
    button.onclick = async () => {
      const action = button.dataset.auth;
      try {
        if (action === 'kakao') {
          await signInWithKakao();
          return; // 리다이렉트됨
        }
        const { email, password } = readForm();
        if (!email || !password) {
          renderLoginPage('이메일과 비밀번호를 입력해 주세요.');
          return;
        }
        if (action === 'signup') {
          const { session } = await signUpWithEmail(email, password);
          if (!session) {
            renderLoginPage('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.', false);
          }
          // session이 있으면 SIGNED_IN 이벤트가 화면을 전환한다.
          return;
        }
        await signInWithEmail(email, password);
        // 성공 시 SIGNED_IN 이벤트가 화면을 전환한다.
      } catch (error) {
        console.error(error);
        renderLoginPage(mapAuthError(error));
      }
    };
  });
}
```

- [ ] **Step 2: `js/main.js`**

```js
import { appState, resetState, registerPage, render, renderShell } from './state.js';
import { renderLoading, renderConnectionError, renderProfilePending } from './ui/screens.js';
import { onAuthStateChange } from './auth/session.js';
import { loadProfile, loadProfiles } from './auth/profile.js';
import { renderLoginPage } from './auth/loginPage.js';

// Phase 1 자리표시자. Phase 2(prayer)·3(qt)·Task 8(my)에서 실제 화면으로 교체한다.
function placeholderPage(title) {
  return () => renderShell(`
    <div class="qt-shell">
      <div class="qt-card">
        <div class="qt-card-title">${title}</div>
        <div class="qt-side-note">준비 중이에요.</div>
      </div>
    </div>
  `);
}

registerPage('qt', placeholderPage('QT'));
registerPage('prayer', placeholderPage('기도제목'));
registerPage('my', placeholderPage('MY'));

// 로그인 직후 1회: 프로필 확인 → bootstrap(공용 데이터 로드) → 첫 화면
async function onSignedIn(session) {
  // INITIAL_SESSION과 SIGNED_IN이 연달아 오거나 탭 포커스 복귀 시 SIGNED_IN이 다시 오므로,
  // 같은 사용자면 재진입하지 않는다. user는 await 전에 동기적으로 설정해 경쟁을 막는다.
  if (appState.auth.user?.id === session.user.id) return;
  appState.auth.user = session.user;
  try {
    const profile = await loadProfile(session.user.id);
    if (!profile) {
      renderProfilePending();
      return;
    }
    appState.auth.profile = profile;
    // bootstrap — Phase 2·3에서 meetings / prayers / qt_records 로드를 여기에 추가한다.
    appState.prayer.profiles = await loadProfiles();
    appState.view = 'qt';
    render();
  } catch (error) {
    console.error(error);
    renderConnectionError(error.message || '알 수 없는 오류');
  }
}

function onSignedOut() {
  resetState();
  renderLoginPage();
}

function init() {
  renderLoading();
  onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
      if (session) onSignedIn(session);
      else renderLoginPage();
    } else if (event === 'SIGNED_OUT') {
      onSignedOut();
    }
    // TOKEN_REFRESHED, USER_UPDATED 등은 무시
  });
}

init();
```

- [ ] **Step 3: CSS 이동, assets 디렉터리, index.html 수정**

```bash
mkdir -p css assets/plants
git mv style.css css/style.css
touch assets/plants/.gitkeep
```

`index.html` 전체를 다음으로 교체:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>QT & Prayer</title>
  <link rel="stylesheet" href="./css/style.css">
</head>
<body>
  <div id="app"></div>
  <div class="overlay" id="overlay"></div>
  <div class="toast" id="toast"></div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script type="module" src="./js/main.js"></script>
</body>
</html>
```

(기존 파일 첫 줄의 BOM(`﻿`)이 있으면 제거한다. `app.js`/`qt.js`/`prayer.js` `<script>` 태그는 제거되지만 파일은 남긴다.)

- [ ] **Step 4: 구문 검사 + 테스트**

Run: `node --check js/auth/loginPage.js && node --check js/main.js && npm test`
Expected: 체크 통과, `# pass 7`

- [ ] **Step 5: 로컬 서버로 브라우저 검증 — 로그인**

Run (레포 루트에서): `python3 -m http.server 5500`
브라우저에서 `http://localhost:5500` 열기. 콘솔(DevTools)을 열어둔다.

Expected:
1. 스켈레톤 로딩이 잠깐 보인 뒤 **로그인 화면**(이메일/비밀번호/로그인/회원가입/카카오 버튼)이 표시된다. 콘솔에 모듈 로드 오류 없음.
2. 빈 채로 [로그인] → 빨간 블록 "이메일과 비밀번호를 입력해 주세요."
3. 새 테스트 이메일(예: `test-a@example.com`) + 비밀번호 6자 이상으로 [회원가입]:
   - Supabase → Authentication → Providers → Email의 "Confirm email"이 **꺼져** 있으면 → 바로 QT 자리표시자 화면 + 하단 탭 3개
   - **켜져** 있으면 → 초록 안내 "가입 확인 메일을 보냈어요…". 개발 편의상 끄는 것을 권장(대시보드에서 토글 후 다시 시도)
4. 잘못된 비밀번호로 [로그인] → "이메일 또는 비밀번호가 올바르지 않아요"
5. 올바른 정보로 [로그인] → QT 자리표시자 화면. 하단 탭 QT/기도제목/MY 전환 시 각 "준비 중이에요." 카드가 뜨고 활성 탭 색이 바뀐다.

- [ ] **Step 6: 브라우저 검증 — 세션 유지 & 트리거**

1. **새로고침** → 로그인 화면을 거치지 않고(스켈레톤 후) 바로 QT 화면. ← README "로그인 유지"
2. Supabase SQL Editor:
   ```sql
   select p.nickname, p.auth_user_id, u.email
     from public.profiles p join auth.users u on u.id = p.auth_user_id
    order by p.created_at desc limit 5;
   ```
   Expected: 방금 가입한 계정의 행이 있고 `nickname = 'test-a'`(이메일 앞부분). ← `handle_new_user` 트리거 동작

- [ ] **Step 7: 브라우저 검증 — 카카오 버튼(설정 전 예상 동작)**

[카카오로 시작하기] 클릭.
Expected: Kakao 공급자가 아직 활성화되지 않았으므로 빨간 블록에 Supabase 원문 오류(예: `Unsupported provider: provider is not enabled`)가 표시된다. 콘솔에 unhandled rejection 없음. (공급자 활성화·검증은 Phase 5.)

- [ ] **Step 8: 커밋**

```bash
git add index.html css/style.css assets/plants/.gitkeep js/auth/loginPage.js js/main.js
git commit -m "feat: ES 모듈 진입점·로그인 페이지·세션 복원 (index.html 모듈 전환)"
```

---

### Task 8: MY 페이지 — 프로필 표시·닉네임 수정·로그아웃

**Files:**
- Modify: `js/auth/profile.js` (렌더 함수 추가)
- Modify: `js/main.js` (`my` 자리표시자를 `renderMyPage`로 교체)

**Interfaces:**
- Consumes: `appState`, `renderShell` (Task 5), `updateNickname`·`signOut` (Task 6), `showToast` (Task 5), `escapeHtml` (Task 1)
- Produces: `renderMyPage(): void`

- [ ] **Step 1: `js/auth/profile.js`에 렌더 함수 추가** (파일 상단 import 교체 + 하단에 추가)

파일 맨 위 import를 다음으로 바꾼다:
```js
import { supabase } from '../supabase.js';
import { appState, renderShell } from '../state.js';
import { escapeHtml } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { signOut } from './session.js';
```

파일 맨 아래에 추가:
```js
export function renderMyPage() {
  const { user, profile } = appState.auth;
  const name = profile?.nickname || '여러분';
  const avatar = profile?.profile_image
    ? `<img src="${escapeHtml(profile.profile_image)}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />`
    : `<div class="my-avatar">${escapeHtml(name.slice(0, 1))}</div>`;
  const joined = user?.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '정보 없음';

  renderShell(`
    <div class="qt-shell">
      <div class="my-card">
        <div class="my-header">
          ${avatar}
          <div>
            <div class="my-name">${escapeHtml(name)}</div>
            <div class="my-sub">${escapeHtml(user?.email || '카카오 계정')}</div>
          </div>
        </div>
        <div class="field-row">
          <label class="text-muted" for="profileNickname">닉네임</label>
          <input id="profileNickname" value="${escapeHtml(profile?.nickname || '')}" maxlength="20" placeholder="닉네임을 입력해 주세요" />
          <button type="button" data-update-profile>닉네임 수정</button>
        </div>
        <div class="text-muted" style="margin-top:14px;">가입일: ${joined}</div>
        <button type="button" class="logout-btn" data-logout>로그아웃</button>
      </div>
    </div>
  `);
  bindMyEvents();
}

function bindMyEvents() {
  const updateButton = document.querySelector('[data-update-profile]');
  if (updateButton) {
    updateButton.onclick = async () => {
      const nickname = document.getElementById('profileNickname')?.value.trim();
      if (!nickname) {
        showToast('닉네임을 입력해 주세요.');
        return;
      }
      try {
        appState.auth.profile = await updateNickname(appState.auth.profile.id, nickname);
        renderMyPage();
        showToast('닉네임이 수정되었어요.');
      } catch (error) {
        console.error(error);
        showToast('닉네임 수정에 실패했어요.');
      }
    };
  }

  const logoutButton = document.querySelector('[data-logout]');
  if (logoutButton) {
    logoutButton.onclick = async () => {
      try {
        await signOut();
        // 화면 전환은 SIGNED_OUT 이벤트(main.js)가 담당
        showToast('로그아웃 되었어요.');
      } catch (error) {
        console.error(error);
        showToast('로그아웃에 실패했어요.');
      }
    };
  }
}
```

- [ ] **Step 2: `js/main.js` 수정**

import 줄 교체:
```js
import { loadProfile, loadProfiles, renderMyPage } from './auth/profile.js';
```
등록 줄 교체:
```js
registerPage('my', renderMyPage);
```

- [ ] **Step 3: 구문 검사 + 테스트**

Run: `node --check js/auth/profile.js && node --check js/main.js && npm test`
Expected: 통과, `# pass 7`

- [ ] **Step 4: 브라우저 검증**

`http://localhost:5500` (로그인 상태) → 하단 [MY] 탭.

Expected:
1. 아바타(첫 글자), 닉네임 `test-a`, 이메일, 가입일, 닉네임 입력칸, [닉네임 수정], [로그아웃]이 보인다.
2. 닉네임을 `테스터A`로 바꾸고 [닉네임 수정] → 토스트 "닉네임이 수정되었어요." + 상단 이름이 즉시 `테스터A`로 바뀐다. 새로고침 후에도 유지(DB 반영).
3. 빈 닉네임으로 [닉네임 수정] → 토스트 "닉네임을 입력해 주세요."
4. [로그아웃] → 토스트 후 **로그인 화면**으로 전환. 새로고침해도 로그인 화면(세션 삭제 확인).
5. 다시 로그인 → QT 화면으로 진입, MY 탭에 `테스터A` 유지.

- [ ] **Step 5: 커밋**

```bash
git add js/auth/profile.js js/main.js
git commit -m "feat(auth): MY 페이지 — 프로필 표시·닉네임 수정·로그아웃"
```

---

### Task 9: `rls_check.sql` — RLS 부정 케이스 검증

**Files:**
- Create: `supabase/rls_check.sql`

**Interfaces:**
- Consumes: Task 3의 테이블·정책·함수. 테스트 계정 2개(`test-a@example.com`, `test-b@example.com` — B는 이 Task에서 가입).

- [ ] **Step 1: 두 번째 테스트 계정 가입**

로컬 앱(`http://localhost:5500`)에서 로그아웃 후 `test-b@example.com`으로 회원가입 → 로그인 확인 → 로그아웃.

- [ ] **Step 2: 두 계정의 auth_user_id 조회**

SQL Editor:
```sql
select u.id as auth_user_id, u.email, p.id as profile_id, p.nickname
  from auth.users u join public.profiles p on p.auth_user_id = u.id
 where u.email in ('test-a@example.com', 'test-b@example.com');
```
Expected: 2행. 두 `auth_user_id`를 메모.

- [ ] **Step 3: SQL 파일 작성** — `supabase/rls_check.sql`

```sql
-- rls_check.sql
-- RLS "막혀야 할 것이 막히는지" 검증.
-- 사용법: <USER_A>, <USER_B>를 auth.users.id로 치환한 뒤 SQL Editor에서 전체 실행.
-- 결과는 임시 테이블에 모아 마지막 select 한 번으로 본다(SQL Editor는 마지막 문장 결과만 표시).
-- 테스트 데이터는 날짜 2000-01-01로 넣고 끝에 정리한다. 실행 후 남는 데이터 없음.
-- Phase 2 이후: prayers RLS(003) 활성화 뒤 "B가 A의 prayers UPDATE → 0행" 케이스를 추가한다.

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
```

- [ ] **Step 4: 실행**

`<USER_A>`, `<USER_B>`를 Step 2의 값으로 치환해 SQL Editor에서 전체 실행.
Expected: 마지막 결과 표에 **11행**, `pass` 컬럼이 모두 `true`. 오류 없이 끝나야 하며, 실행 전후 데이터 변화 없음:
```sql
select count(*) from public.reflections where reflection_date = date '2000-01-01';  -- 0
select count(*) from public.qt_records  where qt_date = date '2000-01-01';          -- 0
```

- [ ] **Step 5: 커밋**

```bash
git add supabase/rls_check.sql
git commit -m "test(db): RLS 부정 케이스 검증 스크립트"
```

---

## Phase 1 완료 기준 (스펙 8장)

- [ ] 이메일 로그인 → 3탭(QT/기도제목/MY) 진입 (Task 7)
- [ ] 새로고침해도 로그인 유지 (Task 7 Step 6)
- [ ] 로그아웃 시 로그인 화면 (Task 8)
- [ ] `npm test` 통과 — 7개 (Task 1·2)
- [ ] `001`·`002` 운영 반영, 옛 프론트 정상 (Task 3·4)
- [ ] `rls_check.sql` 전부 pass (Task 9)

## 다음 Phase로 넘길 것
- Phase 2(기도제목): `prayer/api.js`·`meeting.js`·`page.js`·`sheets.js`, `main.js`의 bootstrap에 `meetings`/`prayers` 로드 추가, `prayer` 자리표시자 교체, `prayer.js` 삭제, `rls_check.sql`에 prayers 케이스 추가
- Phase 3(QT): `qt/*`, bootstrap에 `qt_records` 로드 추가, `qt` 자리표시자 교체, `qt.js` 삭제. **달력은 일요일 시작으로 통일**(기존 헤더/그리드 불일치 버그)
- Phase 4(묵상): `reflection/*`
- Phase 5: 카카오 공급자 설정·검증, `_tmp_check.js`·`app.js`·`supabase/qt_schema.sql` 삭제, README 갱신, `main` 머지·배포, `003_cutover.sql`
  - **003 실행 직전 필수**: 002 반영 이후 옛 프론트가 작성한 `prayers`는 `profile_id`가 NULL이므로 `002_migrate.sql`의 (2)단계 UPDATE를 재실행하고 `unmapped_prayers = 0`을 재확인한 뒤 `set not null`을 건다.
