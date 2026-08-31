# Phase 2 — 기도제목 계정 기반 재작성 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기도제목 탭을 "이름 선택" 방식에서 "로그인한 본인 = 작성자" 방식으로 재작성하고, Supabase `meetings`/`prayers`/`profiles`를 bootstrap에서 로드해 목록·작성·수정·삭제·기도했어요·전체 복사가 모두 DB에 반영되게 한다.

**Architecture:** Phase 1의 ES 모듈 골격 위에 `js/prayer/` 4개 모듈을 추가한다. `api.js`만 Supabase를 알고, `meeting.js`·`compile.js`는 순수 함수(Node 테스트), `page.js`·`sheets.js`는 화면. `main.js`의 bootstrap이 `Promise.all`로 `profiles`/`meetings`/`prayers`를 한 번에 로드하고 `registerPage('prayer', renderPrayerPage)`로 자리표시자를 교체한다. 기존 `prayer.js`(전역 함수 버전)는 이식 후 삭제한다.

**Tech Stack:** HTML/CSS/JS(프레임워크·번들러 없음), supabase-js v2 (UMD CDN), Supabase PostgreSQL, Node 22 내장 테스트 러너.

**Spec:** `docs/superpowers/specs/2026-08-27-account-based-supabase-migration-design.md` (§2 데이터 모델, §4 모듈 구조·데이터 흐름, §8 로드맵 Phase 2)
**선행:** Phase 1 계획 `docs/superpowers/plans/2026-08-27-phase1-foundation.md` 완료 상태(브랜치 `feat/account-based`, 001·002 운영 반영, `npm test` 7개 통과).

## Global Constraints

- **`main`에 머지·배포 금지 (Phase 5 전까지).** 브랜치 `feat/account-based`에서 계속 작업. 로컬 서버(`python3 -m http.server 5500`)로만 확인.
- **SQL은 추가만.** 이 Phase의 유일한 SQL `002b_prayers_member_nullable.sql`은 `alter column member_id drop not null`(멱등, 옛 프론트 무영향). `prayers`/`meetings` RLS 활성화·`members` 변경은 003(Phase 5)에서만.
- **`prayers`에 `unique(meeting_id, profile_id)`는 아직 없다**(003에서 추가). 따라서 upsert(`onConflict`) 대신 **명시적 insert / update 분기**. `prayers.id`는 정수(bigint), `items`는 `jsonb` 배열 `[{ title, detail }]`, `prayed_count int`, `created_at`/`updated_at` 존재, `member_id`는 옛 프론트 호환용으로 `profiles.legacy_member_id`(없으면 `null`)를 넣는다.
- **`prayers`에 RLS가 없으므로** 이 Phase에서 "타인 글 수정 차단"은 UI(수정 버튼 미노출)로만 보장된다. 서버 강제는 003의 RLS. `rls_check.sql`의 prayers 케이스도 003과 함께 Phase 5에서 추가한다.
- 순수 함수 모듈(`js/prayer/meeting.js`, `js/prayer/compile.js`, `js/util/date.js`의 `formatDateKey`)은 `window`, `document`, `supabase`, `Date.now()`를 참조하지 않는다. "오늘"은 `'YYYY-MM-DD'` 문자열 인자로 받는다.
- 계층 규칙: `ui/*`는 `state.js`·api를 import하지 않는다. `state.js`는 화면 모듈을 import하지 않는다(`registerPage`). `api.js`만 `supabase.js`를 import한다.
- 스펙 §4에 없던 파일 추가 2개: `js/util/date.js`(`formatDateKey`, `todayKey` — Phase 3 QT도 사용), `js/prayer/compile.js`(전체 복사 텍스트 조립·`getDetailLines` 순수 함수 — 테스트 대상이라 `sheets.js`에서 분리).
- 모든 사용자 노출 문구는 한국어. 기존 문구는 `prayer.js` 원문 그대로 유지(아래 코드에 포함). 기존 CSS 클래스(`week-header`, `meeting-nav`, `cards`, `card`, `pray-btn`, `copy-bar`, `sheet` 계열, `prayer-item-block` 계열, `confirm-box` 계열, `preview-box` 등)는 `css/style.css`에 이미 존재 — CSS 변경 없음.
- Phase 1 이월 항목 2건을 이 Phase에서 처리한다: (a) `main.js` `onSignedIn`이 연결 오류 후 재시도 가능하도록 실패 시 `appState.auth.user = null`; (b) `rls_check.sql`에 "SQL Editor 전용" 경고 주석과 예상 밖 오류를 `false`로 기록하는 `when others` 분기.
- 기존 동작 변경(의도된 것): 순원 선택 시트(`openMemberSheet`) 제거 — 작성자는 항상 본인. "더보기/접기" 토글의 첫 클릭 무반응 버그(`!undefined === true`) 수정. 작성 시트 textarea에 `escapeHtml` 적용.
- 기존 파일 `app.js`, `qt.js`, `_tmp_check.js`는 건드리지 않는다(Phase 3·5). `prayer.js`는 Task 7에서 삭제.

---

## 파일 구조 (이 Phase에서 생성/변경)

| 파일 | 책임 |
|---|---|
| `js/util/date.js` (생성) | `formatDateKey(date): 'YYYY-MM-DD'`, `todayKey()` |
| `js/prayer/meeting.js` (생성, 순수) | 날짜 포맷, 최근 일요일, 정렬, 기본/인접 순모임, 과거·미래·최신·현재 판정, 라벨 |
| `js/prayer/compile.js` (생성, 순수) | `getDetailLines(item)`, `buildCompiledText(meeting, cards)` |
| `js/prayer/api.js` (생성) | `loadMeetings`, `loadPrayers`, `insertPrayer`, `updatePrayerItems`, `deletePrayer`, `incrementPrayed` |
| `js/prayer/sheets.js` (생성) | 작성/수정 시트, 삭제 확인 시트, 전체 복사 미리보기 시트 |
| `js/prayer/page.js` (생성) | 기도제목 목록 화면 `renderPrayerPage()` + 이벤트 |
| `js/main.js` (수정) | bootstrap에 meetings/prayers 로드, `registerPage('prayer', renderPrayerPage)`, 연결 오류 시 재시도 가능 |
| `supabase/002b_prayers_member_nullable.sql` (생성) | `member_id` NOT NULL 해제 |
| `supabase/rls_check.sql` (수정) | 경고 주석·`when others` 분기 |
| `tests/date.test.js`, `tests/prayer-meeting.test.js`, `tests/prayer-compile.test.js` (생성) | 순수 함수 테스트 |
| `prayer.js` (삭제) | 전역 함수 버전 — 이식 완료 후 제거 |
| 스펙 §5 표 (수정) | 2b 단계 행 추가 |

---

### Task 1: `js/util/date.js` — 날짜 키 유틸

**Files:**
- Create: `js/util/date.js`
- Test: `tests/date.test.js`

**Interfaces:**
- Produces: `formatDateKey(date: Date): string` — 로컬 시간 기준 `'YYYY-MM-DD'`. `todayKey(): string` — `formatDateKey(new Date())` (브라우저 전용, 테스트 안 함).

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/date.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDateKey } from '../js/util/date.js';

test('formatDateKey: 월·일을 두 자리로 채운다', () => {
  assert.equal(formatDateKey(new Date(2026, 7, 5)), '2026-08-05');
});

test('formatDateKey: 연말·연초 경계', () => {
  assert.equal(formatDateKey(new Date(2026, 0, 31)), '2026-01-31');
  assert.equal(formatDateKey(new Date(2025, 11, 1)), '2025-12-01');
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../js/util/date.js'`

- [ ] **Step 3: 구현** — `js/util/date.js`

```js
// 날짜 키 유틸. formatDateKey는 순수 함수(로컬 시간 기준), todayKey는 브라우저에서만 호출한다.
export function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayKey() {
  return formatDateKey(new Date());
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: `# pass 9`, `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add js/util/date.js tests/date.test.js
git commit -m "feat: 날짜 키 유틸(formatDateKey, todayKey) 추가"
```

---

### Task 2: `js/prayer/meeting.js` — 순모임 순수 함수

**Files:**
- Create: `js/prayer/meeting.js`
- Test: `tests/prayer-meeting.test.js`

**Interfaces:**
- Consumes: `formatDateKey` (Task 1)
- Produces (모두 순수; `meeting = { id: number, meeting_date: 'YYYY-MM-DD', meeting_number: number }`):
  - `fmtDate(d: string): string` — `'2026.08.09'`
  - `shortDate(d: string): string` — `'08/09'`
  - `mostRecentSundayISO(todayKey: string): string`
  - `sortMeetingsAsc(meetings): meeting[]` — 새 배열
  - `defaultMeetingId(meetings, todayKey): number | null` — 최근 일요일 이하 중 가장 최근, 없으면 가장 최근 순모임, 빈 배열이면 `null`
  - `adjacentMeeting(meetings, currentId, direction: -1 | 1): meeting | null`
  - `classifyMeeting(meeting, meetings, todayKey): { isPast, isFuture, isLatest, isCurrent }`
  - `headerLabel(flags): string`, `navLabel(flags): string`

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/prayer-meeting.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fmtDate, shortDate, mostRecentSundayISO, sortMeetingsAsc,
  defaultMeetingId, adjacentMeeting, classifyMeeting, headerLabel, navLabel,
} from '../js/prayer/meeting.js';

// 2026-08-23은 일요일. 2026-08-27(목)의 최근 일요일은 08-23.
const MEETINGS = [
  { id: 2, meeting_date: '2026-08-16', meeting_number: 39 },
  { id: 4, meeting_date: '2026-08-30', meeting_number: 41 },
  { id: 1, meeting_date: '2026-08-09', meeting_number: 38 },
  { id: 3, meeting_date: '2026-08-23', meeting_number: 40 },
];
const TODAY = '2026-08-27';

test('fmtDate / shortDate', () => {
  assert.equal(fmtDate('2026-08-09'), '2026.08.09');
  assert.equal(shortDate('2026-08-09'), '08/09');
});

test('mostRecentSundayISO: 평일은 직전 일요일, 일요일은 그 자신', () => {
  assert.equal(mostRecentSundayISO('2026-08-27'), '2026-08-23');
  assert.equal(mostRecentSundayISO('2026-08-23'), '2026-08-23');
  assert.equal(mostRecentSundayISO('2026-08-01'), '2026-07-26');
});

test('sortMeetingsAsc: 날짜 오름차순, 원본 불변', () => {
  const sorted = sortMeetingsAsc(MEETINGS);
  assert.deepEqual(sorted.map(m => m.id), [1, 2, 3, 4]);
  assert.equal(MEETINGS[0].id, 2);
});

test('defaultMeetingId: 최근 일요일 이하 중 가장 최근', () => {
  assert.equal(defaultMeetingId(MEETINGS, TODAY), 3);
  assert.equal(defaultMeetingId(MEETINGS, '2026-08-20'), 2);
});

test('defaultMeetingId: 전부 미래면 가장 최근 순모임, 빈 배열이면 null', () => {
  assert.equal(defaultMeetingId(MEETINGS, '2026-07-01'), 4);
  assert.equal(defaultMeetingId([], TODAY), null);
});

test('adjacentMeeting: 이전/다음, 끝이면 null, 모르는 id면 null', () => {
  assert.equal(adjacentMeeting(MEETINGS, 3, -1).id, 2);
  assert.equal(adjacentMeeting(MEETINGS, 3, 1).id, 4);
  assert.equal(adjacentMeeting(MEETINGS, 4, 1), null);
  assert.equal(adjacentMeeting(MEETINGS, 99, 1), null);
});

test('classifyMeeting: 현재/과거/미래·최신 판정', () => {
  const current = classifyMeeting(MEETINGS[3], MEETINGS, TODAY); // id 3
  assert.deepEqual(current, { isPast: false, isFuture: false, isLatest: false, isCurrent: true });
  const past = classifyMeeting(MEETINGS[0], MEETINGS, TODAY); // id 2
  assert.deepEqual(past, { isPast: true, isFuture: false, isLatest: false, isCurrent: false });
  const future = classifyMeeting(MEETINGS[1], MEETINGS, TODAY); // id 4
  assert.deepEqual(future, { isPast: false, isFuture: true, isLatest: true, isCurrent: false });
});

test('headerLabel / navLabel: 기존 우선순위 유지', () => {
  const current = { isPast: false, isFuture: false, isLatest: false, isCurrent: true };
  const past = { isPast: true, isFuture: false, isLatest: false, isCurrent: false };
  const latestFuture = { isPast: false, isFuture: true, isLatest: true, isCurrent: false };
  const futureNotLatest = { isPast: false, isFuture: true, isLatest: false, isCurrent: false };
  assert.equal(headerLabel(current), '이번 주 순모임');
  assert.equal(headerLabel(past), '지난 순모임');
  assert.equal(headerLabel(latestFuture), '마지막 순모임');
  assert.equal(headerLabel(futureNotLatest), '다음 순모임');
  assert.equal(navLabel(current), '이번 순모임');
  assert.equal(navLabel(past), '지난 순모임');
  assert.equal(navLabel(latestFuture), '마지막 순모임');
  assert.equal(navLabel(futureNotLatest), '다음 순모임');
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../js/prayer/meeting.js'`

- [ ] **Step 3: 구현** — `js/prayer/meeting.js`

```js
// 순모임 관련 순수 함수. 날짜는 'YYYY-MM-DD' 문자열, meeting = { id, meeting_date, meeting_number }.
import { formatDateKey } from '../util/date.js';

export function fmtDate(d) {
  const [y, m, day] = d.split('-');
  return `${y}.${m}.${day}`;
}

export function shortDate(d) {
  const [, m, day] = d.split('-');
  return `${m}/${day}`;
}

export function mostRecentSundayISO(todayKey) {
  const [y, m, d] = todayKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - date.getDay());
  return formatDateKey(date);
}

export function sortMeetingsAsc(meetings) {
  return [...meetings].sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
}

export function defaultMeetingId(meetings, todayKey) {
  if (!meetings.length) return null;
  const sunday = mostRecentSundayISO(todayKey);
  const desc = sortMeetingsAsc(meetings).reverse();
  return (desc.find(m => m.meeting_date <= sunday) || desc[0]).id;
}

export function adjacentMeeting(meetings, currentId, direction) {
  const arr = sortMeetingsAsc(meetings);
  const idx = arr.findIndex(m => m.id === currentId);
  if (idx < 0) return null;
  return arr[idx + direction] || null;
}

export function classifyMeeting(meeting, meetings, todayKey) {
  const sunday = mostRecentSundayISO(todayKey);
  const arr = sortMeetingsAsc(meetings);
  return {
    isPast: meeting.meeting_date < sunday,
    isFuture: meeting.meeting_date > sunday,
    isLatest: meeting.id === arr[arr.length - 1]?.id,
    isCurrent: meeting.id === defaultMeetingId(meetings, todayKey),
  };
}

// 상단 헤더 eyebrow (기존 prayer.js 우선순위: latest → future → past → current)
export function headerLabel(flags) {
  if (flags.isLatest) return '마지막 순모임';
  if (flags.isFuture) return '다음 순모임';
  if (flags.isPast) return '지난 순모임';
  return '이번 주 순모임';
}

// 이전/다음 스트립 중앙 라벨 (기존 우선순위: current → latest → future → past)
export function navLabel(flags) {
  if (flags.isCurrent) return '이번 순모임';
  if (flags.isLatest) return '마지막 순모임';
  if (flags.isFuture) return '다음 순모임';
  return '지난 순모임';
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: `# pass 17`, `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add js/prayer/meeting.js tests/prayer-meeting.test.js
git commit -m "feat(prayer): 순모임 순수 함수 모듈(meeting.js) 추가"
```

---

### Task 3: `js/prayer/compile.js` — 상세 줄 파싱 + 전체 복사 텍스트

**Files:**
- Create: `js/prayer/compile.js`
- Test: `tests/prayer-compile.test.js`

**Interfaces:**
- Consumes: `fmtDate` (Task 2)
- Produces (순수):
  - `getDetailLines(item: { detail?: string, details?: string[] }): string[]` — `details` 배열 우선, 없으면 `detail` 문자열을 줄 단위로, 공백 제거·빈 줄 제외
  - `buildCompiledText(meeting, cards: { nickname: string, items: { title: string, detail?: string }[] }[]): string` — 기존 `prayer.js`의 `buildCompiledText`와 동일한 형식

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/prayer-compile.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDetailLines, buildCompiledText } from '../js/prayer/compile.js';

test('getDetailLines: details 배열 우선, 공백 제거·빈 값 제외', () => {
  assert.deepEqual(getDetailLines({ details: [' a ', '', 'b'] }), ['a', 'b']);
});

test('getDetailLines: detail 문자열은 줄 단위로 나눈다', () => {
  assert.deepEqual(getDetailLines({ detail: '첫째\n\n둘째 \n' }), ['첫째', '둘째']);
});

test('getDetailLines: 둘 다 없으면 빈 배열', () => {
  assert.deepEqual(getDetailLines({}), []);
  assert.deepEqual(getDetailLines(null), []);
});

test('buildCompiledText: 카카오톡 붙여넣기 형식', () => {
  const meeting = { id: 3, meeting_date: '2026-08-23', meeting_number: 40 };
  const cards = [
    { nickname: '지영', items: [{ title: '건강', detail: '허리\n잠' }, { title: '가족', detail: '' }] },
    { nickname: '선재', items: [{ title: '취업' }] },
  ];
  const expected =
    '♥ 우리 순 기도제목 ♥\n' +
    '2026.08.23 40번째 순모임\n' +
    '\n♥지영\n' +
    '1. 건강\n' +
    '- 허리\n' +
    '- 잠\n' +
    '2. 가족\n' +
    '\n♥선재\n' +
    '1. 취업\n';
  assert.equal(buildCompiledText(meeting, cards), expected);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../js/prayer/compile.js'`

- [ ] **Step 3: 구현** — `js/prayer/compile.js`

```js
// 기도제목 항목 파싱과 전체 복사 텍스트 조립. 순수 함수.
import { fmtDate } from './meeting.js';

export function getDetailLines(item) {
  if (Array.isArray(item?.details)) {
    return item.details.map(v => String(v || '').trim()).filter(Boolean);
  }
  if (typeof item?.detail === 'string') {
    return item.detail.split(/\n+/).map(v => v.trim()).filter(Boolean);
  }
  return [];
}

// cards: 표시 순서대로 [{ nickname, items: [{ title, detail }] }]
export function buildCompiledText(meeting, cards) {
  let out = `♥ 우리 순 기도제목 ♥\n${fmtDate(meeting.meeting_date)} ${meeting.meeting_number}번째 순모임\n`;
  cards.forEach(card => {
    out += `\n♥${card.nickname}\n`;
    card.items.forEach((it, i) => {
      out += `${i + 1}. ${it.title}\n`;
      getDetailLines(it).forEach(detail => { out += `- ${detail}\n`; });
    });
  });
  return out;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: `# pass 21`, `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add js/prayer/compile.js tests/prayer-compile.test.js
git commit -m "feat(prayer): 전체 복사 텍스트·상세 줄 파싱 순수 함수 추가"
```

---

### Task 4: `002b_prayers_member_nullable.sql` + 스펙 §5 갱신

**Files:**
- Create: `supabase/002b_prayers_member_nullable.sql`
- Modify: `docs/superpowers/specs/2026-08-27-account-based-supabase-migration-design.md` (§5 단계 표)

**Interfaces:**
- Produces (DB): `prayers.member_id`가 NULL 허용 → 새 프론트가 `legacy_member_id` 없는 사용자(신규 가입자)의 기도제목을 insert 가능.

- [ ] **Step 1: SQL 파일 작성** — `supabase/002b_prayers_member_nullable.sql`

```sql
-- 002b_prayers_member_nullable.sql
-- 새 프론트는 prayers를 profile_id로 작성하며, member_id는 옛 프론트 호환용으로
-- profiles.legacy_member_id(없으면 NULL)를 넣는다. 옛 앱이 만든 NOT NULL 제약이 있으면 해제한다.
-- 추가형(제약 완화)이므로 옛 프론트 영향 없음. 이미 nullable이어도 오류 없이 통과(재실행 가능).

alter table public.prayers alter column member_id drop not null;

-- 기대: YES
select is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'prayers' and column_name = 'member_id';
```

- [ ] **Step 2: 스펙 §5 표에 행 추가**

`docs/superpowers/specs/2026-08-27-account-based-supabase-migration-design.md`의 §5 표에서 `| 2 | \`002_migrate.sql\` |` 행 바로 아래에 다음 행을 삽입:

```
| 2b | `002b_prayers_member_nullable.sql` | `prayers.member_id` NOT NULL 해제(새 프론트가 `member_id` 없이 작성). 옛 프론트 호환을 위해 새 프론트는 `member_id = profiles.legacy_member_id`(없으면 NULL)를 함께 기록 | 정상 |
```

- [ ] **Step 3: 운영 Supabase에서 실행**

SQL Editor에 파일 전체 붙여넣기 → Run.
Expected: 마지막 결과 `is_nullable = YES`. 옛 프론트(배포 사이트) 기도제목 목록 정상.

- [ ] **Step 4: 커밋**

```bash
git add supabase/002b_prayers_member_nullable.sql docs/superpowers/specs/2026-08-27-account-based-supabase-migration-design.md
git commit -m "feat(db): prayers.member_id NOT NULL 해제 (002b)"
```

---

### Task 5: `js/prayer/api.js` — Supabase 접근 계층

**Files:**
- Create: `js/prayer/api.js`

**Interfaces:**
- Consumes: `supabase` (`js/supabase.js`)
- Produces (모두 `error`면 throw):
  - `loadMeetings(): Promise<{ id, meeting_date, meeting_number }[]>` — `meeting_date` 내림차순
  - `loadPrayers(): Promise<Prayer[]>`, `Prayer = { id, meeting_id, profile_id, member_id, items, prayed_count, updated_at }`
  - `insertPrayer({ meetingId, profileId, legacyMemberId, items }): Promise<Prayer>`
  - `updatePrayerItems(prayerId, items): Promise<Prayer>`
  - `deletePrayer(prayerId): Promise<void>`
  - `incrementPrayed(prayerId): Promise<number>` — RPC `increment_prayed`, 새 카운트 반환

브라우저/Supabase 전용 — `node --check`로 검증, 동작은 Task 6 브라우저 검증.

- [ ] **Step 1: `js/prayer/api.js`**

```js
import { supabase } from '../supabase.js';

export async function loadMeetings() {
  const { data, error } = await supabase
    .from('meetings')
    .select('id, meeting_date, meeting_number')
    .order('meeting_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function loadPrayers() {
  const { data, error } = await supabase
    .from('prayers')
    .select('id, meeting_id, profile_id, member_id, items, prayed_count, updated_at');
  if (error) throw error;
  return data;
}

// 새 기도제목. unique(meeting_id, profile_id)는 003에서 생기므로 upsert 대신 insert.
// member_id는 옛 프론트 호환용(legacy_member_id, 없으면 null).
export async function insertPrayer({ meetingId, profileId, legacyMemberId, items }) {
  const { data, error } = await supabase
    .from('prayers')
    .insert({
      meeting_id: meetingId,
      profile_id: profileId,
      member_id: legacyMemberId ?? null,
      items,
      prayed_count: 0,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePrayerItems(prayerId, items) {
  const { data, error } = await supabase
    .from('prayers')
    .update({ items, updated_at: new Date().toISOString() })
    .eq('id', prayerId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePrayer(prayerId) {
  const { error } = await supabase.from('prayers').delete().eq('id', prayerId);
  if (error) throw error;
}

// "기도했어요": 타인 행의 prayed_count를 올리는 유일한 경로(security definer RPC). 새 값을 반환한다.
export async function incrementPrayed(prayerId) {
  const { data, error } = await supabase.rpc('increment_prayed', { p_prayer_id: prayerId });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: 구문 검사**

Run: `node --check js/prayer/api.js && npm test`
Expected: 체크 통과, `# pass 21`

- [ ] **Step 3: 커밋**

```bash
git add js/prayer/api.js
git commit -m "feat(prayer): Supabase 접근 계층(api.js) 추가"
```

---

### Task 6: `js/prayer/sheets.js` — 작성/수정·삭제 확인·전체 복사 시트

**Files:**
- Create: `js/prayer/sheets.js`
- Reference: 기존 `prayer.js:188-237`(미리보기·삭제 확인), `prayer.js:239-393`(작성 시트) — 아래 코드는 그 이식본이며 원문을 볼 필요는 없다

**Interfaces:**
- Consumes: `openSheet`, `closeSheet` (`js/ui/sheet.js`); `showToast`; `escapeHtml`; `appState`, `render` (`js/state.js`); `insertPrayer`, `updatePrayerItems`, `deletePrayer` (Task 5); `getDetailLines`, `buildCompiledText` (Task 3)
- Produces:
  - `openWriteSheet({ meeting, existing }: { meeting, existing: Prayer | null }): void` — 저장 성공 시 `appState.prayer.prayers` 갱신(교체 또는 추가), `appState.prayer.collapsed[id] = true`, `closeSheet()`, `render()`, 토스트
  - `openDeleteConfirm(prayer: Prayer): void` — 삭제 성공 시 `appState.prayer.prayers`에서 제거, `closeSheet()`, `render()`, 토스트
  - `openPreviewSheet(meeting, cards: { nickname, items }[]): void` — 클립보드 복사

- [ ] **Step 1: `js/prayer/sheets.js`**

```js
import { openSheet, closeSheet } from '../ui/sheet.js';
import { showToast } from '../ui/toast.js';
import { escapeHtml } from '../ui/dom.js';
import { appState, render } from '../state.js';
import { insertPrayer, updatePrayerItems, deletePrayer } from './api.js';
import { getDetailLines, buildCompiledText } from './compile.js';

function replacePrayerInState(saved) {
  const list = appState.prayer.prayers;
  const idx = list.findIndex(p => p.id === saved.id);
  if (idx >= 0) list[idx] = saved;
  else list.push(saved);
}

// 작성(existing === null) / 수정(existing = 내 Prayer 행). 작성자는 항상 로그인한 본인.
export function openWriteSheet({ meeting, existing }) {
  const profile = appState.auth.profile;
  const isEdit = Boolean(existing);
  const html = `
    <div class="sheet-title">${escapeHtml(profile.nickname)}님의 기도제목</div>
    <div class="sheet-sub">${isEdit ? '내용을 수정해주세요' : '한 주간 나누고 싶은 기도제목을 적어주세요'}</div>
    <div id="itemsWrap"></div>
    <button type="button" class="add-item-btn" id="btnAddItem">＋ 기도제목 추가</button>
    <div class="save-row">
      ${isEdit ? '<button type="button" class="danger-btn" id="btnDelete">삭제</button>' : ''}
      <button type="button" class="save-btn" id="btnSave">저장하기</button>
    </div>
  `;
  const sheet = openSheet(html);
  const wrap = sheet.querySelector('#itemsWrap');

  // 편집 초안: [{ title, details: string[] }]
  const draftItems = existing
    ? existing.items.map(it => ({ title: it.title || '', details: getDetailLines(it) }))
    : [{ title: '', details: [] }];

  function paintItems() {
    wrap.innerHTML = draftItems.map((it, i) => `
      <div class="prayer-item-block" data-i="${i}">
        ${draftItems.length > 1 ? `<button type="button" class="remove-item" data-remove="${i}">✕</button>` : ''}
        <div class="idx">${i + 1}</div>
        <textarea rows="2" placeholder="기도제목을 적어주세요" data-title="${i}">${escapeHtml(it.title)}</textarea>
        <div class="detail-list">
          ${(it.details.length ? it.details : ['']).map((detail, di) => `
            <div class="detail-row">
              <textarea rows="2" placeholder="상세 내용" data-detail="${i}" data-detail-index="${di}">${escapeHtml(detail)}</textarea>
              <button type="button" class="detail-remove" data-remove-detail="${i}" data-detail-index="${di}">✕</button>
            </div>
          `).join('')}
        </div>
        <button type="button" class="add-detail-btn" data-add-detail="${i}">＋ 상세 내용 추가</button>
      </div>
    `).join('');

    wrap.querySelectorAll('[data-title]').forEach(t => {
      t.oninput = () => { draftItems[Number(t.dataset.title)].title = t.value; };
    });
    wrap.querySelectorAll('[data-detail]').forEach(t => {
      t.oninput = () => {
        const item = draftItems[Number(t.dataset.detail)];
        item.details[Number(t.dataset.detailIndex)] = t.value;
      };
    });
    wrap.querySelectorAll('[data-add-detail]').forEach(b => {
      b.onclick = () => {
        const item = draftItems[Number(b.dataset.addDetail)];
        if (item.details.length === 0) item.details.push(''); // 화면의 빈 첫 줄을 실제 항목으로
        item.details.push('');
        paintItems();
      };
    });
    wrap.querySelectorAll('[data-remove-detail]').forEach(b => {
      b.onclick = () => {
        const item = draftItems[Number(b.dataset.removeDetail)];
        item.details.splice(Number(b.dataset.detailIndex), 1);
        paintItems();
      };
    });
    wrap.querySelectorAll('[data-remove]').forEach(b => {
      b.onclick = () => {
        draftItems.splice(Number(b.dataset.remove), 1);
        paintItems();
      };
    });
  }

  paintItems();

  sheet.querySelector('#btnAddItem').onclick = () => {
    draftItems.push({ title: '', details: [] });
    paintItems();
  };

  sheet.querySelector('#btnSave').onclick = async () => {
    const cleaned = draftItems
      .map(it => ({
        title: it.title.trim(),
        detail: it.details.map(v => String(v || '').trim()).filter(Boolean).join('\n'),
      }))
      .filter(it => it.title.length > 0);

    if (cleaned.length === 0) {
      showToast('기도제목을 한 가지 이상 입력해주세요');
      return;
    }

    try {
      const saved = isEdit
        ? await updatePrayerItems(existing.id, cleaned)
        : await insertPrayer({
            meetingId: meeting.id,
            profileId: profile.id,
            legacyMemberId: profile.legacy_member_id,
            items: cleaned,
          });
      replacePrayerInState(saved);
      appState.prayer.collapsed[saved.id] = true;
      closeSheet();
      render();
      showToast(isEdit ? '✓ 기도제목을 수정했어요' : '✓ 기도제목을 나눴어요');
    } catch (error) {
      console.error(error);
      showToast('저장 중 오류가 발생했어요');
    }
  };

  const delBtn = sheet.querySelector('#btnDelete');
  if (delBtn) {
    delBtn.onclick = () => {
      closeSheet();
      setTimeout(() => openDeleteConfirm(existing), 260);
    };
  }
}

export function openDeleteConfirm(prayer) {
  const html = `
    <div class="confirm-box">
      <p>이번 주 내 기도제목을<br/>삭제할까요?</p>
      <div class="confirm-actions">
        <button type="button" class="confirm-cancel" id="btnCancel">취소</button>
        <button type="button" class="confirm-delete" id="btnConfirmDelete">삭제하기</button>
      </div>
    </div>
  `;
  const sheet = openSheet(html);
  sheet.querySelector('#btnCancel').onclick = closeSheet;
  sheet.querySelector('#btnConfirmDelete').onclick = async () => {
    try {
      await deletePrayer(prayer.id);
      appState.prayer.prayers = appState.prayer.prayers.filter(p => p.id !== prayer.id);
      closeSheet();
      render();
      showToast('삭제되었어요');
    } catch (error) {
      console.error(error);
      showToast('삭제 중 오류가 발생했어요');
    }
  };
}

export function openPreviewSheet(meeting, cards) {
  const text = buildCompiledText(meeting, cards);
  const html = `
    <div class="sheet-title">전체 기도제목 미리보기</div>
    <div class="sheet-sub">카카오톡에 그대로 붙여넣을 수 있어요</div>
    <div class="preview-box">${escapeHtml(text)}</div>
    <button type="button" class="save-btn" id="btnDoCopy" style="margin-top:16px;">전체 기도제목 복사</button>
  `;
  const sheet = openSheet(html);
  sheet.querySelector('#btnDoCopy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    closeSheet();
    showToast('✓ 기도제목을 복사했어요');
  };
}
```

- [ ] **Step 2: 구문 검사 + import 정적 확인**

Run: `node --check js/prayer/sheets.js && grep -n "^export" js/ui/sheet.js js/ui/toast.js js/ui/dom.js js/state.js js/prayer/api.js js/prayer/compile.js`
Expected: 체크 통과. grep 결과에 `openSheet`, `closeSheet`, `showToast`, `escapeHtml`, `appState`, `render`, `insertPrayer`, `updatePrayerItems`, `deletePrayer`, `getDetailLines`, `buildCompiledText`가 모두 보임.

- [ ] **Step 3: 커밋**

```bash
git add js/prayer/sheets.js
git commit -m "feat(prayer): 작성/수정·삭제 확인·전체 복사 시트 이식 (계정 기반)"
```

---

### Task 7: `js/prayer/page.js` + `main.js` 연결 → 브라우저 검증

**Files:**
- Create: `js/prayer/page.js`
- Modify: `js/main.js` (import 3줄, `registerPage('prayer', …)` 1줄, `onSignedIn` bootstrap 블록·catch 블록)

**Interfaces:**
- Consumes: `appState`, `render`, `renderShell`; `escapeHtml`; `showToast`; `incrementPrayed` (Task 5); `getDetailLines` (Task 3); `adjacentMeeting`, `classifyMeeting`, `headerLabel`, `navLabel`, `fmtDate`, `shortDate`, `defaultMeetingId` (Task 2); `todayKey` (Task 1); `openWriteSheet`, `openPreviewSheet` (Task 6; `openDeleteConfirm`은 시트 내부에서만 호출); `loadMeetings`, `loadPrayers` (Task 5)
- Produces: `renderPrayerPage(): void`. `appState.prayer` 사용 규약: `meetings`(DB 형태), `prayers`(DB 형태), `profiles`(Phase 1 로드), `currentMeetingId: number|null`, `collapsed: { [prayerId]: boolean }`.

- [ ] **Step 1: `js/prayer/page.js`**

```js
import { appState, render, renderShell } from '../state.js';
import { escapeHtml } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { todayKey } from '../util/date.js';
import { incrementPrayed } from './api.js';
import { getDetailLines } from './compile.js';
import { adjacentMeeting, classifyMeeting, headerLabel, navLabel, fmtDate, shortDate } from './meeting.js';
import { openWriteSheet, openPreviewSheet } from './sheets.js';

function prayedKey(meetingId, prayerId) {
  return `prayed:${meetingId}:${prayerId}`;
}

export function renderPrayerPage() {
  const { meetings, prayers, profiles, currentMeetingId, collapsed } = appState.prayer;
  const myProfileId = appState.auth.profile.id;
  const meeting = meetings.find(m => m.id === currentMeetingId);

  if (!meeting) {
    renderShell(`
      <div class="empty-card" style="margin-top:40px;">
        <div class="sun-icon">☁️</div>
        <div>등록된 순모임이 없어요.</div>
      </div>
    `);
    return;
  }

  const flags = classifyMeeting(meeting, meetings, todayKey());
  const meetingPrayers = prayers.filter(p => p.meeting_id === meeting.id);
  // profiles 순서(display_order → nickname)대로 카드 구성. 자리표시자 프로필도 분모에 포함.
  const cards = profiles
    .map(profile => ({ profile, prayer: meetingPrayers.find(p => p.profile_id === profile.id) }))
    .filter(c => c.prayer);
  const total = profiles.length;
  const done = cards.length;
  const allDone = total > 0 && done === total;
  const mine = meetingPrayers.find(p => p.profile_id === myProfileId) || null;
  const canWrite = !flags.isPast;

  let dotsHtml = '';
  for (let i = 0; i < total; i += 1) {
    dotsHtml += `<span class="dot ${i < done ? 'filled' : ''}"></span>`;
  }

  const headerHtml = `
    <div class="week-header">
      <div class="eyebrow">${headerLabel(flags)}</div>
      <h1 class="mono">${meeting.meeting_number}번째 순모임</h1>
      <div class="date mono">${fmtDate(meeting.meeting_date)}</div>
      <div class="progress-row">
        <div class="dots">${dotsHtml}</div>
        <div class="progress-text mono">${done} / ${total} 작성 완료</div>
      </div>
      ${allDone ? '<div class="complete-banner">☀️ 이번 주 기도제목이 모두 모였어요</div>' : ''}
    </div>
  `;

  const prev = adjacentMeeting(meetings, meeting.id, -1);
  const next = adjacentMeeting(meetings, meeting.id, 1);
  const stripHtml = `
    <div class="meeting-nav">
      <div class="nav-side ${prev ? '' : 'disabled'}" data-direction="-1">
        <span class="nav-arrow">‹</span>
        <span class="nav-date">${prev ? shortDate(prev.meeting_date) : ''}</span>
      </div>
      <div class="nav-center">
        <div class="label">${navLabel(flags)}</div>
        <div class="date">${shortDate(meeting.meeting_date)}</div>
        <div class="line"></div>
      </div>
      <div class="nav-side next ${next ? '' : 'disabled'}" data-direction="1">
        <span class="nav-date">${next ? shortDate(next.meeting_date) : ''}</span>
        <span class="nav-arrow">›</span>
      </div>
    </div>
  `;

  let ctaHtml = '';
  if (canWrite) {
    ctaHtml = mine
      ? '<button type="button" class="cta-btn" disabled>✓ 이번 주 기도제목을 나눴어요</button>'
      : '<button type="button" class="cta-btn" id="btnWrite">＋ 이번 주 기도제목 나누기</button>';
    if (!allDone) {
      ctaHtml += `<div class="nudge">아직 <b>${total - done}명</b>이 기도제목을 준비 중이에요. 천천히 나눠주셔도 괜찮아요 🌤️</div>`;
    }
  }

  let cardsHtml = '';
  if (done === 0) {
    cardsHtml = `
      <div class="empty-card">
        <div class="sun-icon">🌤️</div>
        <div>아직 아무도 기도제목을 나누지 않았어요.<br/>가장 먼저 나눠보는 건 어떨까요?</div>
      </div>`;
  } else {
    cardsHtml = '<div class="cards">' + cards.map(({ profile, prayer }) => {
      const items = Array.isArray(prayer.items) ? prayer.items : [];
      const isCollapsed = collapsed[prayer.id] !== false && items.length > 3;
      const hasPrayed = Boolean(localStorage.getItem(prayedKey(meeting.id, prayer.id)));
      const isMine = prayer.profile_id === myProfileId;
      return `
        <div class="card ${isCollapsed ? 'collapsed' : ''}" data-prayer="${prayer.id}">
          <div class="card-top">
            <div class="card-name">${escapeHtml(profile.nickname)}</div>
            ${canWrite && isMine ? `<button type="button" class="kebab" data-edit="${prayer.id}">⋯</button>` : ''}
          </div>
          <div class="item-list">
            ${items.map((it, i) => `
              <div class="item">
                <div class="item-title" data-idx="${i + 1}">${escapeHtml(it.title)}</div>
                ${getDetailLines(it).map(detail => `<div class="item-detail">${escapeHtml(detail)}</div>`).join('')}
              </div>
            `).join('')}
          </div>
          ${items.length > 3 ? `<span class="more-toggle" data-toggle="${prayer.id}">${isCollapsed ? '더보기' : '접기'}</span>` : ''}
          <div class="card-bottom">
            <button type="button" class="pray-btn ${hasPrayed ? 'done' : ''}" data-pray="${prayer.id}">
              <span class="glow"></span>
              🙏 ${hasPrayed ? '함께 기도했어요' : '기도했어요'} <span class="count mono">· ${prayer.prayed_count || 0}</span>
            </button>
          </div>
        </div>
      `;
    }).join('') + '</div>';
  }

  const copyBarHtml = canWrite ? `
    <div class="copy-bar">
      <div class="copy-bar-inner">
        <button type="button" class="copy-btn ${allDone ? 'ready' : ''}" id="btnCopyAll">
          ${allDone ? '전체 기도제목 복사' : `지금까지 작성된 ${done}명 기도제목 복사`}
        </button>
      </div>
    </div>
  ` : '';

  renderShell(headerHtml + stripHtml + ctaHtml + cardsHtml + copyBarHtml);
  bindPrayerEvents({ meeting, meetings, mine, cards });
}

function bindPrayerEvents({ meeting, meetings, mine, cards }) {
  document.querySelectorAll('.nav-side[data-direction]').forEach(el => {
    if (el.classList.contains('disabled')) return;
    el.onclick = () => {
      const target = adjacentMeeting(meetings, meeting.id, Number(el.dataset.direction));
      if (target) {
        appState.prayer.currentMeetingId = target.id;
        render();
      }
    };
  });

  const btnWrite = document.getElementById('btnWrite');
  if (btnWrite) btnWrite.onclick = () => openWriteSheet({ meeting, existing: null });

  document.querySelectorAll('[data-edit]').forEach(el => {
    el.onclick = () => {
      if (mine && String(mine.id) === el.dataset.edit) openWriteSheet({ meeting, existing: mine });
    };
  });

  document.querySelectorAll('[data-toggle]').forEach(el => {
    el.onclick = () => {
      const id = Number(el.dataset.toggle);
      // 기본값(undefined)은 '접힘'. 접힘이면 펼치고, 펼침이면 접는다.
      const isCollapsed = appState.prayer.collapsed[id] !== false;
      appState.prayer.collapsed[id] = !isCollapsed;
      render();
    };
  });

  document.querySelectorAll('[data-pray]').forEach(el => {
    el.onclick = async () => {
      const id = Number(el.dataset.pray);
      try {
        const nextCount = await incrementPrayed(id);
        const prayer = appState.prayer.prayers.find(p => p.id === id);
        if (prayer) prayer.prayed_count = nextCount;
        localStorage.setItem(prayedKey(meeting.id, id), '1');
        const glow = el.querySelector('.glow');
        if (glow) glow.classList.add('play');
        el.classList.add('done');
        el.innerHTML = `<span class="glow"></span> 🙏 함께 기도했어요 <span class="count mono">· ${nextCount}</span>`;
        setTimeout(() => render(), 550);
      } catch (error) {
        console.error(error);
        showToast('저장 중 오류가 발생했어요');
      }
    };
  });

  const btnCopy = document.getElementById('btnCopyAll');
  if (btnCopy) {
    btnCopy.onclick = () => openPreviewSheet(
      meeting,
      cards.map(({ profile, prayer }) => ({ nickname: profile.nickname, items: prayer.items || [] })),
    );
  }
}
```

- [ ] **Step 2: `js/main.js` 수정**

(a) import 블록 — 기존 `import { renderLoginPage } from './auth/loginPage.js';` 줄 아래에 추가:
```js
import { todayKey } from './util/date.js';
import { loadMeetings, loadPrayers } from './prayer/api.js';
import { defaultMeetingId } from './prayer/meeting.js';
import { renderPrayerPage } from './prayer/page.js';
```

(b) 등록 줄 교체:
```js
registerPage('prayer', placeholderPage('기도제목'));
```
→
```js
registerPage('prayer', renderPrayerPage);
```

(c) `onSignedIn` 안의 bootstrap 두 줄
```js
    // bootstrap — Phase 2·3에서 meetings / prayers / qt_records 로드를 여기에 추가한다.
    appState.prayer.profiles = await loadProfiles();
```
→
```js
    // bootstrap — 공용 데이터 1회 로드. Phase 3에서 qt_records를 추가한다.
    const [profiles, meetings, prayers] = await Promise.all([loadProfiles(), loadMeetings(), loadPrayers()]);
    appState.prayer.profiles = profiles;
    appState.prayer.meetings = meetings;
    appState.prayer.prayers = prayers;
    appState.prayer.currentMeetingId = defaultMeetingId(meetings, todayKey());
```

(d) `onSignedIn`의 catch 블록 (Phase 1 이월: 연결 오류 후 탭 재포커스 `SIGNED_IN`에서 재시도 가능하도록)
```js
  } catch (error) {
    console.error(error);
    renderConnectionError(error.message || '알 수 없는 오류');
  }
```
→
```js
  } catch (error) {
    console.error(error);
    appState.auth.user = null; // 재진입 가드를 풀어 다음 SIGNED_IN에서 다시 시도할 수 있게 한다
    renderConnectionError(error.message || '알 수 없는 오류');
  }
```

- [ ] **Step 3: 구문 검사 + 테스트**

Run: `node --check js/prayer/page.js && node --check js/main.js && npm test`
Expected: 통과, `# pass 21`

- [ ] **Step 4: 브라우저 검증 — 목록·이동** (`python3 -m http.server 5500` → `http://localhost:5500`, `test-a`로 로그인)

하단 [기도제목] 탭.
Expected:
1. 헤더에 `N번째 순모임`, 날짜, `n / m 작성 완료`(m = 프로필 수, 9명 자리표시자 + 가입 계정 수). 기존 이관된 기도제목 카드들이 순원 이름(닉네임)으로 표시.
2. 카드 이름은 `profiles.nickname`(기존 순원 이름), 항목 4개 이상 카드는 접혀 있고 [더보기] 클릭 **한 번**에 펼쳐진다(기존 버그 수정 확인).
3. 좌우 스트립(‹ ›)으로 이전/다음 순모임 이동, 끝에서 비활성. 지난 순모임에서는 작성 버튼·⋯·복사 바가 없다.
4. 타인 카드에는 ⋯(수정) 버튼이 없다.

- [ ] **Step 5: 브라우저 검증 — 작성·수정·삭제·기도했어요·복사** (현재 순모임 = 최근 일요일 이하 가장 최근 meeting; 없으면 SQL Editor에서 `insert into public.meetings (meeting_date, meeting_number) values ('<가장 최근 일요일>', <다음 번호>);` 후 새로고침)

1. [＋ 이번 주 기도제목 나누기] → 시트 제목 `test-a님의 기도제목`(순원 선택 화면 없음). 항목 2개, 상세 1개 입력 → [저장하기] → 토스트 "✓ 기도제목을 나눴어요", 내 카드가 목록에 생기고 CTA가 `✓ 이번 주 기도제목을 나눴어요`(비활성)로 바뀜. 새로고침 후에도 유지(DB).
2. 내 카드 ⋯ → 내용 수정 → [저장하기] → "✓ 기도제목을 수정했어요", 반영.
3. 아무 카드의 [🙏 기도했어요] → 카운트 +1, 버튼이 "함께 기도했어요"로. 새로고침 후 카운트 유지. 다시 눌러도 +1(횟수 제한 없음).
4. [지금까지 작성된 n명 기도제목 복사] → 미리보기 시트에 `♥ 우리 순 기도제목 ♥ …` 텍스트 → [전체 기도제목 복사] → "✓ 기도제목을 복사했어요", 클립보드에 붙여넣기 가능.
5. 내 카드 ⋯ → [삭제] → 확인 시트 → [삭제하기] → "삭제되었어요", 카드 사라지고 CTA가 작성 버튼으로 복귀.
6. SQL Editor에서 확인: `select id, meeting_id, profile_id, member_id, prayed_count from public.prayers order by id desc limit 3;` — 새로 만든(그리고 삭제한) 행이 없고, 기도했어요를 누른 행의 `prayed_count`가 올라가 있다.

- [ ] **Step 6: 브라우저 검증 — 계정 B 시점**

로그아웃 → `test-b@example.com` 로그인(없으면 회원가입) → 기도제목 탭.
Expected: test-a가 작성한 카드(있다면)에 ⋯ 없음. B가 작성 → A로 다시 로그인하면 B의 카드가 보이고 ⋯ 없음.

- [ ] **Step 7: 커밋**

```bash
git add js/prayer/page.js js/main.js
git commit -m "feat(prayer): 기도제목 목록 화면 계정 기반 재작성 및 bootstrap 연결"
```

---

### Task 8: 옛 `prayer.js` 삭제 + `rls_check.sql` 진단 보강

**Files:**
- Delete: `prayer.js`
- Modify: `supabase/rls_check.sql` (상단 주석 1줄, DO 블록 2개의 예외 절)

**Interfaces:** 없음 (정리 작업)

- [ ] **Step 1: `prayer.js`가 어디서도 로드·참조되지 않음을 확인**

Run: `grep -rn "prayer\.js\|renderPrayerView\|openMemberSheet" --include=*.html --include=*.js . | grep -v node_modules | grep -v "^./js/" | grep -v "^./_tmp_check.js" | grep -v "^./app.js"`
Expected: `./prayer.js` 자신의 줄만 나오거나 아무 것도 없음. (`app.js`는 `window.renderPrayerView`를 optional-call하지만 `index.html`이 `app.js`를 로드하지 않으므로 무관 — `app.js`는 Phase 5에서 삭제.)

- [ ] **Step 2: 삭제**

```bash
git rm prayer.js
```

- [ ] **Step 3: `supabase/rls_check.sql` 수정**

(a) 파일 상단 주석 블록의 `-- Phase 2 이후: prayers RLS(003) 활성화 뒤 ...` 줄 아래에 추가:
```sql
-- ⚠️ Supabase SQL Editor 전용. Editor는 스크립트 전체를 한 트랜잭션으로 실행하므로 중간 오류 시 전부 롤백된다.
--    psql 등에서 BEGIN 없이 실행하면 중단 시 테스트 데이터(2000-01-01 행, prayed_count +1)가 남을 수 있다.
```

(b) 첫 DO 블록의 예외 절
```sql
exception
  when insufficient_privilege then
    insert into rls_results (case_name, pass) values ('QT 없이 묵상 INSERT 차단', true);
end $$;
```
→
```sql
exception
  when insufficient_privilege then
    insert into rls_results (case_name, pass) values ('QT 없이 묵상 INSERT 차단', true);
  when others then
    insert into rls_results (case_name, pass) values ('QT 없이 묵상 INSERT 차단 (예상 밖 오류: ' || sqlerrm || ')', false);
end $$;
```

(c) 둘째 DO 블록의 예외 절
```sql
exception
  when insufficient_privilege then
    insert into rls_results (case_name, pass) values ('타인 명의 qt_records INSERT 차단', true);
end $$;
```
→
```sql
exception
  when insufficient_privilege then
    insert into rls_results (case_name, pass) values ('타인 명의 qt_records INSERT 차단', true);
  when others then
    insert into rls_results (case_name, pass) values ('타인 명의 qt_records INSERT 차단 (예상 밖 오류: ' || sqlerrm || ')', false);
end $$;
```

- [ ] **Step 4: 확인**

Run: `npm test && grep -c "when others" supabase/rls_check.sql && test ! -f prayer.js && echo "prayer.js removed"`
Expected: `# pass 21`, `2`, `prayer.js removed`

- [ ] **Step 5: 커밋**

```bash
git add supabase/rls_check.sql
git commit -m "chore: 옛 prayer.js 제거, rls_check 진단 보강"
```

---

## Phase 2 완료 기준 (스펙 §8)

- [ ] 목록·작성·수정·삭제·기도했어요·전체 복사가 Supabase에 반영 (Task 7 Step 4–6)
- [ ] 타인 글에 수정 버튼 미노출 (Task 7 Step 4·6) — 서버 강제(RLS)는 Phase 5 003
- [ ] `npm test` 21개 통과 (Task 1–3)
- [ ] `002b` 운영 반영, 옛 프론트 정상 (Task 4)
- [ ] `prayer.js` 삭제 (Task 8)

## 다음 Phase로 넘길 것
- Phase 3(QT): `qt/api.js`·`streak.js`·`growth.js`·`calendar.js`·`page.js`, bootstrap에 `qt_records` 로드, `qt` 자리표시자 교체, `qt.js` 삭제. **달력 일요일 시작 통일**. `formatDateKey`/`todayKey`는 `js/util/date.js` 재사용.
- Phase 4(묵상): `reflection/*`. reflections UPDATE 정책의 QT 게이트 재검증, `reflection_reactions.profile_id` 인덱스 검토.
- Phase 5: `rls_check.sql`에 prayers 케이스 추가(003 정책 생성 후), **배포 직후와 003 직전** 002 (2)단계 재실행(옛 프론트가 쓴 `profile_id` NULL 행 매핑), `app.js`·`_tmp_check.js`·`qt_schema.sql` 삭제, README 갱신, 카카오, 배포.
