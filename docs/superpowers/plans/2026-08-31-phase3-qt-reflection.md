# Phase 3+4 — QT·묵상 나눔 이식 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 협업자가 `features/qt/*`에 만든 QT 화면(캘린더·상세 패널·식물 성장 시트)과 묵상 나눔 피드를 ES 모듈 구조(`js/qt/*`, `js/reflection/*`)로 이식해 배포 앱의 "준비 중" QT 탭을 되살린다. 데이터는 localStorage/옛 스키마 대신 Supabase `qt_records`/`reflections`/`reflection_reactions`(001 스키마, RLS)로 저장한다.

**Architecture:** 화면·마크업·UX는 `features/qt/qt-render.js`(협업자 작업)를 원본으로 그대로 이식하고, 데이터 계층만 교체한다. 순수 계산(`streak`/`growth`/`calendar`)은 Node 테스트, Supabase 접근은 `qt/api.js`·`reflection/api.js`로 한정, 화면은 `appState.qt`를 읽는다. `registerPage('qt', renderQtView)`가 `appState.qtTab`으로 나의 QT/묵상 나눔을 분기한다.

**Tech Stack:** HTML/CSS/JS(프레임워크 없음), supabase-js v2, Node 22 내장 테스트. CSS는 이미 병합된 `css/style.css`(협업자 신규 클래스 전부 포함 확인됨) 그대로 사용 — **CSS 변경 없음**.

**Spec:** `docs/superpowers/specs/2026-08-27-account-based-supabase-migration-design.md` (§2 데이터 모델·RLS, §4 모듈 구조, §8 Phase 3·4)
**이식 원본:** `features/qt/qt-core.js`(계산), `features/qt/qt-render.js`(화면·이벤트), `assets/plants/*.png`. `features/qt/qt-data.js`는 미적용 옛 스키마(`user_id`, `qt_reflections`, `qt_record_id`) 대상이라 **이식하지 않는다**.

## Global Constraints

- 브랜치 `feat/qt-reflection`(main `fcd9df0`에서 분기, 이미 생성됨). 머지·배포는 사용자 결정 — 작업 중 push 금지.
- 스펙 대비 확정 조정(컨트롤러 Ruling): ① 협업자 피드는 본인 묵상만 표시했으나 **전체 사용자 피드**로 구현(스펙 §8 Phase 4 기준) — `reflections` SELECT는 authenticated 전원 허용이므로 PostgREST 임베딩으로 닉네임·반응 포함. ② QT 완료 시 빈 묵상 자동 생성(협업자 동작)은 **하지 않는다** — 새 스키마가 `content` 빈 값을 금지하고 피드도 빈 묵상을 걸렀으므로 동작 차이 없음. ③ 달력은 **일요일 시작**(기존 `(getDay()+6)%7`는 월요일 시작 버그 — 요일 헤더 `일월화수목금토`와 불일치). ④ 묵상 작성·수정은 **오늘 날짜만**(협업자 동작 유지), 과거는 읽기 전용.
- DB 계약(001 스키마·운영 반영됨): `qt_records(id uuid, profile_id, qt_date date, unique(profile_id,qt_date))` — SELECT/INSERT 본인만(RLS가 필터하므로 클라이언트 `eq` 불필요). `reflections(id uuid, profile_id, reflection_date date, content text not null(빈 값 금지), unique(profile_id,reflection_date))` — SELECT 전원, INSERT는 본인 + **당일 qt_records 존재 시에만**(RLS `with check`), UPDATE/DELETE 본인. `reflection_reactions(reflection_id, profile_id, reaction_type in ('grace','pray'), unique(reflection_id,profile_id,reaction_type))` — SELECT 전원, INSERT/DELETE 본인.
- 순수 함수 모듈은 `window`/`document`/`supabase`/`Date.now()` 참조 금지("오늘"은 `'YYYY-MM-DD'` 인자). 계층 규칙: `api.js`만 `supabase.js` import, `ui/*`는 state/api 미참조, `state.js`는 화면 미참조.
- 문구는 협업자 원본 그대로: 'QT 완료하기', '오늘도 말씀과 함께했어요 🌿', '오늘의 묵상을 나눴어요 ☀️', 'QT 기록은 오늘의 걸음부터 남길 수 있어요.', '오늘의 QT 기록은 이미 남겨졌어요.', '묵상을 한 줄 남겨주세요.', '묵상은 오늘의 기록에 남길 수 있어요.', 'QT 완료'/'미완료', '은혜받았어요'/'함께 기도해요' 등. 오류 토스트는 기존 규약 '저장 중 오류가 발생했어요'.
- await 하는 저장 버튼에는 **이중 제출 가드**(disabled + finally 복원) — Phase 2 최종 리뷰에서 확립된 규약.
- 동적 값은 모두 `escapeHtml`. `features/*`·`app.js`·`_tmp_check.js`는 수정·삭제하지 않는다(협업자 조율 후 Phase 5 정리). 루트 `qt.js`(스텁)만 Task 8에서 삭제.
- 모델·검증 규약은 Phase 1·2와 동일: 순수 모듈 TDD, 브라우저 결합 모듈은 `node --check`, 대시보드·브라우저 스텝은 사용자 위임.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `js/util/date.js` (수정) | `parseDateKey(dateKey): Date` 추가 |
| `js/qt/streak.js` (생성, 순수) | `getTotal`, `getCurrentStreak`, `getLongestStreak` |
| `js/qt/growth.js` (생성, 순수) | `PLANT_STAGES`(이미지 포함), `getStage`, `getProgress` |
| `js/qt/calendar.js` (생성, 순수) | `getMonthGrid(year, month)` — 42칸, 일요일 시작 |
| `js/qt/api.js` (생성) | `loadMyQtRecords`, `insertQtRecord` |
| `js/reflection/api.js` (생성) | `loadMyReflections`, `insertReflection`, `updateReflection`, `loadFeed`, `addReaction`, `removeReaction` |
| `js/qt/growthSheet.js` (생성) | 식물 성장 상세 시트 |
| `js/qt/page.js` (생성) | 나의 QT 화면(캘린더+상세 패널) + `renderQtView` 탭 분기 |
| `js/reflection/feed.js` (생성) | 묵상 나눔 피드(전체 사용자) + 반응 토글 |
| `js/state.js` (수정) | `qt` 초기 상태 확장 |
| `js/main.js` (수정) | bootstrap에 qt_records·내 묵상 로드, `registerPage('qt', renderQtView)` |
| `qt.js` (삭제) | 루트 스텁 — 미로드 |
| `tests/qt-streak.test.js`, `tests/qt-growth.test.js`, `tests/qt-calendar.test.js` (생성) | 순수 함수 테스트 |

---

### Task 1: `parseDateKey` + `js/qt/streak.js`

**Files:**
- Modify: `js/util/date.js` (함수 1개 추가)
- Create: `js/qt/streak.js`
- Test: `tests/qt-streak.test.js`

**Interfaces:**
- Consumes: `formatDateKey` (`js/util/date.js`)
- Produces: `parseDateKey(dateKey: string): Date`(로컬 자정); `getTotal(dates: string[]): number`(중복 제거 개수); `getCurrentStreak(dates: string[], todayKey: string): number`; `getLongestStreak(dates: string[]): number`

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/qt-streak.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDateKey } from '../js/util/date.js';
import { getTotal, getCurrentStreak, getLongestStreak } from '../js/qt/streak.js';

test('parseDateKey: 로컬 자정 Date로 파싱한다', () => {
  const d = parseDateKey('2026-08-31');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 7);
  assert.equal(d.getDate(), 31);
  assert.equal(d.getHours(), 0);
});

test('getTotal: 중복 날짜는 한 번만 센다', () => {
  assert.equal(getTotal(['2026-08-30', '2026-08-30', '2026-08-31']), 2);
  assert.equal(getTotal([]), 0);
});

test('getCurrentStreak: 오늘부터 거꾸로 연속한 날 수', () => {
  const dates = ['2026-08-29', '2026-08-30', '2026-08-31'];
  assert.equal(getCurrentStreak(dates, '2026-08-31'), 3);
});

test('getCurrentStreak: 오늘 기록이 없으면 0', () => {
  assert.equal(getCurrentStreak(['2026-08-29', '2026-08-30'], '2026-08-31'), 0);
});

test('getCurrentStreak: 월 경계를 넘는 연속', () => {
  assert.equal(getCurrentStreak(['2026-08-31', '2026-09-01'], '2026-09-01'), 2);
});

test('getLongestStreak: 끊긴 구간이 있으면 가장 긴 연속', () => {
  assert.equal(getLongestStreak(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-10', '2026-08-11']), 3);
  assert.equal(getLongestStreak([]), 0);
  assert.equal(getLongestStreak(['2026-08-01']), 1);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `parseDateKey`가 export되지 않음 / `js/qt/streak.js` 모듈 없음

- [ ] **Step 3: 구현**

`js/util/date.js` 파일 끝에 추가:
```js
export function parseDateKey(dateKey) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
```

`js/qt/streak.js` 생성:
```js
// QT 연속·누적 계산. 순수 함수 — dates는 'YYYY-MM-DD' 문자열 배열, "오늘"은 인자로 받는다.
import { formatDateKey, parseDateKey } from '../util/date.js';

export function getTotal(dates) {
  return new Set(dates).size;
}

export function getCurrentStreak(dates, todayKey) {
  const set = new Set(dates);
  const cursor = parseDateKey(todayKey);
  let streak = 0;
  while (set.has(formatDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getLongestStreak(dates) {
  const unique = [...new Set(dates)].sort();
  if (!unique.length) return 0;
  let longest = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i += 1) {
    const diff = Math.round((parseDateKey(unique[i]) - parseDateKey(unique[i - 1])) / 86400000);
    if (diff === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  return longest;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: `# pass 27`, `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add js/util/date.js js/qt/streak.js tests/qt-streak.test.js
git commit -m "feat(qt): 연속·누적 계산 순수 함수(streak.js) 이식"
```

---

### Task 2: `js/qt/growth.js` — 식물 성장 단계

**Files:**
- Create: `js/qt/growth.js`
- Test: `tests/qt-growth.test.js`

**Interfaces:**
- Produces: `PLANT_STAGES: { name, icon, image, min, max }[]`(6단계); `getStage(total: number)` → 해당 단계 객체; `getProgress(total: number)` → `{ stage, next: stage|null, remaining: number, percent: number }`

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/qt-growth.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANT_STAGES, getStage, getProgress } from '../js/qt/growth.js';

test('경계값마다 단계와 이미지가 맞는다 (README 표)', () => {
  const cases = [
    [0, '씨앗'], [6, '씨앗'], [7, '새싹'], [19, '새싹'], [20, '어린 식물'],
    [49, '어린 식물'], [50, '작은 나무'], [99, '작은 나무'], [100, '나무'],
    [199, '나무'], [200, '풍성한 나무'], [500, '풍성한 나무'],
  ];
  for (const [total, name] of cases) {
    assert.equal(getStage(total).name, name, `total=${total}`);
  }
  assert.equal(PLANT_STAGES.length, 6);
  assert.equal(getStage(0).image, './assets/plants/seed.png');
  assert.equal(getStage(200).image, './assets/plants/full-tree.png');
});

test('getProgress: 다음 단계까지 남은 횟수와 퍼센트', () => {
  const p = getProgress(10); // 새싹(7~19), 다음 20
  assert.equal(p.stage.name, '새싹');
  assert.equal(p.next.name, '어린 식물');
  assert.equal(p.remaining, 10);
  assert.ok(Math.abs(p.percent - ((10 - 7) / (20 - 7)) * 100) < 1e-9);
});

test('getProgress: 최고 단계는 next 없음·100%', () => {
  const p = getProgress(250);
  assert.equal(p.next, null);
  assert.equal(p.remaining, 0);
  assert.equal(p.percent, 100);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../js/qt/growth.js'`

- [ ] **Step 3: 구현** — `js/qt/growth.js`

```js
// 식물 성장 단계. 순수 함수. 아이콘·이미지는 features/qt(협업자 작업)와 동일.
export const PLANT_STAGES = [
  { name: '씨앗', icon: '🫘', image: './assets/plants/seed.png', min: 0, max: 6 },
  { name: '새싹', icon: '🌱', image: './assets/plants/sprout.png', min: 7, max: 19 },
  { name: '어린 식물', icon: '🪴', image: './assets/plants/young-plant.png', min: 20, max: 49 },
  { name: '작은 나무', icon: '🌲', image: './assets/plants/small-tree.png', min: 50, max: 99 },
  { name: '나무', icon: '🌳', image: './assets/plants/tree.png', min: 100, max: 199 },
  { name: '풍성한 나무', icon: '🌳✨', image: './assets/plants/full-tree.png', min: 200, max: Infinity },
];

export function getStage(total) {
  return PLANT_STAGES.find(stage => total <= stage.max);
}

export function getProgress(total) {
  const index = PLANT_STAGES.findIndex(stage => total <= stage.max);
  const stage = PLANT_STAGES[index];
  const next = PLANT_STAGES[index + 1] || null;
  if (!next) return { stage, next: null, remaining: 0, percent: 100 };
  const remaining = Math.max(0, next.min - total);
  const percent = Math.min(100, Math.max(0, ((total - stage.min) / (next.min - stage.min)) * 100));
  return { stage, next, remaining, percent };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: `# pass 30`, `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add js/qt/growth.js tests/qt-growth.test.js
git commit -m "feat(qt): 식물 성장 단계 순수 함수(growth.js) 이식"
```

---

### Task 3: `js/qt/calendar.js` — 월 달력 (일요일 시작)

**Files:**
- Create: `js/qt/calendar.js`
- Test: `tests/qt-calendar.test.js`

**Interfaces:**
- Produces: `getMonthGrid(year: number, month: number /* 0-based */): Date[]` — 42칸, **일요일 시작**

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/qt-calendar.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMonthGrid } from '../js/qt/calendar.js';
import { formatDateKey } from '../js/util/date.js';

test('42칸이며 첫 칸은 일요일이다', () => {
  const grid = getMonthGrid(2026, 7); // 2026년 8월 (8/1은 토요일)
  assert.equal(grid.length, 42);
  assert.equal(grid[0].getDay(), 0);
  assert.equal(formatDateKey(grid[0]), '2026-07-26'); // 8/1 직전 일요일
});

test('1일이 일요일인 달은 1일부터 시작한다', () => {
  const grid = getMonthGrid(2026, 10); // 2026년 11월 (11/1은 일요일)
  assert.equal(formatDateKey(grid[0]), '2026-11-01');
  assert.equal(formatDateKey(grid[41]), '2026-12-12');
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../js/qt/calendar.js'`

- [ ] **Step 3: 구현** — `js/qt/calendar.js`

```js
// 월 달력 42칸 생성. 순수 함수.
// 원본 features/qt/qt-core.js의 (getDay()+6)%7 는 월요일 시작이라 요일 헤더('일'부터)와 어긋나던 버그 —
// 스펙 Ruling대로 일요일 시작으로 통일한다.
export function getMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(start.getDate() - first.getDay());
  const cells = [];
  const cursor = new Date(start);
  for (let i = 0; i < 42; i += 1) {
    cells.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: `# pass 32`, `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add js/qt/calendar.js tests/qt-calendar.test.js
git commit -m "feat(qt): 월 달력 순수 함수(calendar.js) — 일요일 시작으로 통일"
```

---

### Task 4: `js/qt/api.js` + `js/reflection/api.js`

**Files:**
- Create: `js/qt/api.js`, `js/reflection/api.js`

**Interfaces:**
- Consumes: `supabase` (`js/supabase.js`)
- Produces (모두 `error`면 throw):
  - `loadMyQtRecords(): Promise<{ id, qt_date }[]>` — RLS가 본인 행만 반환, `qt_date` 오름차순
  - `insertQtRecord(profileId, dateKey): Promise<{ id, qt_date }>`
  - `loadMyReflections(profileId): Promise<{ id, reflection_date, content }[]>`
  - `insertReflection(profileId, dateKey, content): Promise<{ id, reflection_date, content }>`
  - `updateReflection(reflectionId, content): Promise<{ id, reflection_date, content }>`
  - `loadFeed(): Promise<FeedItem[]>`, `FeedItem = { id, profile_id, reflection_date, content, created_at, profiles: { nickname, profile_image } | null, reflection_reactions: { profile_id, reaction_type }[] }` — `created_at` 내림차순
  - `addReaction(reflectionId, profileId, type): Promise<void>`, `removeReaction(reflectionId, profileId, type): Promise<void>`

브라우저 전용 — `node --check` 검증, 동작은 Task 8 브라우저 검증.

- [ ] **Step 1: `js/qt/api.js`**

```js
import { supabase } from '../supabase.js';

// RLS(qt_records_select_self)가 본인 행만 돌려주므로 클라이언트 필터가 필요 없다.
export async function loadMyQtRecords() {
  const { data, error } = await supabase
    .from('qt_records')
    .select('id, qt_date')
    .order('qt_date', { ascending: true });
  if (error) throw error;
  return data;
}

export async function insertQtRecord(profileId, dateKey) {
  const { data, error } = await supabase
    .from('qt_records')
    .insert({ profile_id: profileId, qt_date: dateKey })
    .select('id, qt_date')
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: `js/reflection/api.js`**

```js
import { supabase } from '../supabase.js';

// reflections SELECT는 전원 허용이므로 내 것만 보려면 명시적으로 profile_id 필터가 필요하다.
export async function loadMyReflections(profileId) {
  const { data, error } = await supabase
    .from('reflections')
    .select('id, reflection_date, content')
    .eq('profile_id', profileId)
    .order('reflection_date', { ascending: true });
  if (error) throw error;
  return data;
}

// INSERT는 RLS가 "본인 + 당일 qt_records 존재"를 강제한다(001 reflections_insert_self_after_qt).
export async function insertReflection(profileId, dateKey, content) {
  const { data, error } = await supabase
    .from('reflections')
    .insert({ profile_id: profileId, reflection_date: dateKey, content })
    .select('id, reflection_date, content')
    .single();
  if (error) throw error;
  return data;
}

export async function updateReflection(reflectionId, content) {
  const { data, error } = await supabase
    .from('reflections')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', reflectionId)
    .select('id, reflection_date, content')
    .single();
  if (error) throw error;
  return data;
}

// 전체 사용자 피드: 작성자 닉네임·프로필 이미지와 반응 행을 임베딩으로 함께 가져온다.
export async function loadFeed() {
  const { data, error } = await supabase
    .from('reflections')
    .select('id, profile_id, reflection_date, content, created_at, profiles(nickname, profile_image), reflection_reactions(profile_id, reaction_type)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addReaction(reflectionId, profileId, type) {
  const { error } = await supabase
    .from('reflection_reactions')
    .insert({ reflection_id: reflectionId, profile_id: profileId, reaction_type: type });
  if (error) throw error;
}

export async function removeReaction(reflectionId, profileId, type) {
  const { error } = await supabase
    .from('reflection_reactions')
    .delete()
    .eq('reflection_id', reflectionId)
    .eq('profile_id', profileId)
    .eq('reaction_type', type);
  if (error) throw error;
}
```

- [ ] **Step 3: 구문 검사**

Run: `node --check js/qt/api.js && node --check js/reflection/api.js && npm test`
Expected: 통과, `# pass 32`

- [ ] **Step 4: 커밋**

```bash
git add js/qt/api.js js/reflection/api.js
git commit -m "feat(qt): qt_records·reflections·reactions Supabase 접근 계층 추가"
```

---

### Task 5: `state.js` qt 상태 확장 + `js/qt/growthSheet.js`

**Files:**
- Modify: `js/state.js` (한 줄 교체)
- Create: `js/qt/growthSheet.js`
- Reference: `features/qt/qt-render.js`의 `openQtGrowthSheet`(협업자 마크업 원본 — 아래 코드가 이식본이므로 열 필요 없음)

**Interfaces:**
- Consumes: `appState`, `openSheet`, `todayKey`, `getTotal`/`getCurrentStreak`/`getLongestStreak` (Task 1), `getProgress` (Task 2)
- Produces: `openQtGrowthSheet(): void`; `appState.qt = { records: [], myReflections: [], month: Date, calendar: { revealed: null, open: null } }`

- [ ] **Step 1: `js/state.js` 수정**

`initialState()` 안의
```js
    qt: { records: [], month: new Date() },
```
를 다음으로 교체:
```js
    qt: { records: [], myReflections: [], month: new Date(), calendar: { revealed: null, open: null } },
```

- [ ] **Step 2: `js/qt/growthSheet.js`** (협업자 `openQtGrowthSheet` 이식 — 데이터만 `appState.qt.records`로)

```js
import { appState } from '../state.js';
import { openSheet } from '../ui/sheet.js';
import { todayKey } from '../util/date.js';
import { getTotal, getCurrentStreak, getLongestStreak } from './streak.js';
import { getProgress } from './growth.js';

export function openQtGrowthSheet() {
  const dates = appState.qt.records.map(r => r.qt_date);
  const total = getTotal(dates);
  const { stage, next, remaining, percent } = getProgress(total);
  const currentStreak = getCurrentStreak(dates, todayKey());
  const longestStreak = getLongestStreak(dates);

  const html = `
    <div class="growth-sheet">
      <div class="growth-hero">
        <div class="growth-sun"></div>
        <div class="growth-sparkle sparkle-1">✦</div>
        <div class="growth-sparkle sparkle-2">✦</div>
        <div class="growth-plant">
          <img src="${stage.image}" alt="${stage.name}" class="growth-plant-image">
        </div>
        <h2 class="growth-title">${stage.name}</h2>
        <p class="growth-description">말씀과 함께 자라고 있어요</p>
      </div>

      ${next ? `
        <div class="growth-progress-section">
          <div class="growth-next-title">${stage.name}에서 <strong>${next.name}</strong>으로 🌿</div>
          <div class="growth-progress-track">
            <div class="growth-progress-fill" style="width:${percent}%"></div>
          </div>
          <div class="growth-progress-meta">
            <span>${total}번 함께했어요</span>
            <strong>다음 성장까지 ${remaining}번</strong>
          </div>
        </div>
      ` : `
        <div class="growth-complete">🌳 풍성하게 자라고 있어요</div>
      `}

      <div class="growth-stats">
        <div class="growth-stat">
          <div class="growth-stat-icon">🔥</div>
          <strong>${currentStreak}일</strong>
          <span>현재 연속</span>
        </div>
        <div class="growth-stat main">
          <div class="growth-stat-icon">☀️</div>
          <strong>${total}일</strong>
          <span>함께한 날</span>
        </div>
        <div class="growth-stat">
          <div class="growth-stat-icon">🏅</div>
          <strong>${longestStreak}일</strong>
          <span>최장 연속</span>
        </div>
      </div>

      <div class="growth-message">오늘도 한 걸음 자라고 있어요 🌱</div>
    </div>
  `;
  openSheet(html);
}
```

- [ ] **Step 3: 구문 검사**

Run: `node --check js/state.js && node --check js/qt/growthSheet.js && npm test`
Expected: 통과, `# pass 32`

- [ ] **Step 4: 커밋**

```bash
git add js/state.js js/qt/growthSheet.js
git commit -m "feat(qt): 식물 성장 상세 시트 이식 및 qt 상태 확장"
```

---

### Task 6: `js/qt/page.js` — 나의 QT 화면 (캘린더 + 상세 패널)

**Files:**
- Create: `js/qt/page.js`
- Reference: `features/qt/qt-render.js:1-230`(renderDetailPanel), `:598-1238`(renderQtPage) — 아래 코드가 이식본이므로 원본을 열 필요는 없다

**Interfaces:**
- Consumes: `appState`, `render`, `renderShell`; `escapeHtml`; `showToast`; `todayKey`, `parseDateKey`; `getMonthGrid` (T3); `getTotal` (T1); `getStage` (T2); `loadMyQtRecords`?(불필요 — bootstrap이 로드), `insertQtRecord` (T4); `insertReflection`, `updateReflection` (T4); `openQtGrowthSheet` (T5); `renderFeedPage` (T7 — 이 Task 시점에는 아직 없으므로 import는 T7 완료 후에도 그대로 동작하도록 `../reflection/feed.js` 경로로 작성하고, 이 Task의 구문 검사는 T7 이후 Task 8에서 최종 확인. 이 Task에서는 `node --check`만)
- Produces: `renderQtView(): void`(탭 분기 — main.js가 등록), `renderQtPage(): void`

주의: `renderQtView`는 `appState.qtTab`이 `'feed'`면 `renderFeedPage()`, 아니면 `renderQtPage()`를 호출한다. `feed.js`는 `page.js`를 import하지 않는다(순환 방지 — 탭 전환은 `appState.qtTab` 변경 + `render()`로만).

- [ ] **Step 1: `js/qt/page.js`** (협업자 renderQtPage/renderDetailPanel/bindQtEvents 이식 — 데이터 접근만 appState/api로 교체, 빈 묵상 자동 생성 제거, 이중 제출 가드 추가)

```js
import { appState, render, renderShell } from '../state.js';
import { escapeHtml } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { todayKey, parseDateKey, formatDateKey } from '../util/date.js';
import { getMonthGrid } from './calendar.js';
import { getTotal } from './streak.js';
import { getStage } from './growth.js';
import { insertQtRecord } from './api.js';
import { insertReflection, updateReflection } from '../reflection/api.js';
import { openQtGrowthSheet } from './growthSheet.js';
import { renderFeedPage } from '../reflection/feed.js';

function recordDates() {
  return appState.qt.records.map(r => r.qt_date);
}

function reflectionByDate(dateKey) {
  return appState.qt.myReflections.find(r => r.reflection_date === dateKey) || null;
}

// 'qt' 뷰 진입점: 탭에 따라 나의 QT / 묵상 나눔 분기
export function renderQtView() {
  if (appState.qtTab === 'feed') {
    renderFeedPage();
    return;
  }
  renderQtPage();
}

export function renderQtPage() {
  const today = todayKey();
  const completionSet = new Set(recordDates());
  const total = getTotal(recordDates());
  const stage = getStage(total);
  const monthDate = new Date(appState.qt.month);
  const cells = getMonthGrid(monthDate.getFullYear(), monthDate.getMonth());
  const calState = appState.qt.calendar;
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  const htmlDays = cells.map(date => {
    const key = formatDateKey(date);
    const isCurrentMonth = date.getMonth() === monthDate.getMonth();
    const isToday = key === today;
    const isFuture = key > today;
    const done = completionSet.has(key);
    const isRevealedOrOpen = calState.revealed === key || calState.open === key;

    const classNames = ['calendar-day'];
    if (!isCurrentMonth) classNames.push('muted');
    if (isToday) classNames.push('today');
    if (done && !isToday) classNames.push('completed');
    if (!isFuture) classNames.push('clickable');

    const inner = (done && !isRevealedOrOpen && !isToday)
      ? '<span class="day-circle">🌿</span>'
      : `<span class="day-circle">${date.getDate()}</span>`;

    return `
      <div class="${classNames.join(' ')}"
           style="${isFuture ? 'pointer-events:none; opacity:0.7;' : ''}"
           ${isFuture ? '' : `data-calendar-day="${key}"`}>
        ${inner}
      </div>
    `;
  }).join('');

  const selectedKey = calState.open || calState.revealed;
  let selectedSummary = '';
  if (selectedKey) {
    const d = parseDateKey(selectedKey);
    const selectedDone = completionSet.has(selectedKey);
    selectedSummary = `
      <div class="qt-selected-date-wrap">
        <div class="qt-selected-date">
          <span class="qt-selected-label">선택한 날짜</span>
          <strong>${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일</strong>
          <span class="qt-selected-badge ${selectedDone ? 'done' : 'pending'}">${selectedDone ? 'QT 완료' : '미완료'}</span>
        </div>
      </div>
    `;
  }

  renderShell(`
    <div class="qt-shell">
      <div class="qt-topbar">
        <div style="width:30px;"></div>
        <div class="qt-topbar-title">QT</div>
        <div style="width:30px;"></div>
      </div>

      <div class="qt-main-tabs">
        <button class="qt-tab ${appState.qtTab === 'my' ? 'active' : ''}" data-qt-tab="my">나의 QT</button>
        <button class="qt-tab ${appState.qtTab === 'feed' ? 'active' : ''}" data-qt-tab="feed">묵상 나눔</button>
      </div>

      <button type="button" class="qt-banner" data-plant-detail>
        <span class="badge">${stage.icon}</span>
        <span class="text">말씀과 함께한 날 <strong>${total}일</strong></span>
        <span class="chevron">›</span>
      </button>

      <div class="qt-calendar-card">
        <div class="calendar-header">
          <button type="button" data-month="prev">‹</button>
          <div>${monthDate.getFullYear()}년 ${monthDate.getMonth() + 1}월</div>
          <button type="button" data-month="next">›</button>
        </div>
        <div class="calendar-grid">
          ${weekdays.map(day => `<div class="calendar-weekday">${day}</div>`).join('')}
          ${htmlDays}
        </div>
      </div>

      ${selectedSummary}

      <div class="detail-panel" id="detailPanel"></div>
    </div>
  `);

  bindQtPageEvents();
  paintDetailPanel();
}

function paintDetailPanel() {
  const panel = document.getElementById('detailPanel');
  if (!panel) return;

  const today = todayKey();
  const calState = appState.qt.calendar;
  const completionSet = new Set(recordDates());
  const isDoneToday = completionSet.has(today);
  const selectedKey = calState.open || calState.revealed;

  const completeButtonHtml = (dateKey) => `
    <div class="dp-note">오늘도 말씀과 함께해볼까요?</div>
    <button class="qt-check-btn" type="button" data-qt-complete data-qt-date="${dateKey}">
      <span class="check-icon"></span>
      <span>QT 완료하기</span>
    </button>
  `;

  const reflectionWriteHtml = (dateKey, content) => `
    <div class="dp-note"><strong>오늘도 말씀과 함께했어요. 🌿</strong> 받은 마음을 짧게 남겨보세요.</div>
    <div class="reflection-write">
      <textarea id="qtReflectionInput" placeholder="오늘 말씀을 통해 받은 마음이 있나요?">${escapeHtml(content)}</textarea>
      <button type="button" class="save-btn" data-qt-save-reflection data-qt-date="${dateKey}">묵상 나누기</button>
    </div>
  `;

  // 오늘은 항상 작성/수정 UI(내용 미리 채움) — 스펙 §8의 '묵상 수정'은 오늘 날짜에 한해 허용.
  // 과거 완료일은 읽기 전용(묵상이 있으면 읽기 카드, 없으면 안내 문구). 협업자 기본 화면 동작과 동일.
  let html;
  if (selectedKey) {
    const selectedDone = completionSet.has(selectedKey);
    const isSelectedToday = selectedKey === today;
    const content = reflectionByDate(selectedKey)?.content || '';

    if (!selectedDone) {
      html = isSelectedToday
        ? completeButtonHtml(selectedKey)
        : '<div class="dp-note">남겨진 QT 기록이 없어요.</div>';
    } else if (isSelectedToday) {
      html = reflectionWriteHtml(selectedKey, content);
    } else if (content) {
      const d = parseDateKey(selectedKey);
      html = `
        <div class="reflection-read">
          <div class="rp-date">${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 묵상</div>
          <div class="rp-content">${escapeHtml(content)}</div>
        </div>
      `;
    } else {
      html = '<div class="dp-note">이 날도 말씀과 함께했어요. 🌿</div>';
    }
  } else if (!isDoneToday) {
    html = completeButtonHtml(today);
  } else {
    html = reflectionWriteHtml(today, reflectionByDate(today)?.content || '');
  }

  panel.innerHTML = html;
  bindDetailPanelEvents();
}

function bindQtPageEvents() {
  document.querySelectorAll('[data-qt-tab]').forEach(button => {
    button.onclick = () => {
      appState.qtTab = button.dataset.qtTab;
      render();
    };
  });

  document.querySelectorAll('[data-month]').forEach(button => {
    button.onclick = () => {
      const next = new Date(appState.qt.month);
      next.setMonth(next.getMonth() + (button.dataset.month === 'next' ? 1 : -1));
      appState.qt.month = next;
      appState.qt.calendar = { revealed: null, open: null };
      render();
    };
  });

  document.querySelectorAll('[data-calendar-day]').forEach(cell => {
    cell.onclick = () => {
      const dateKey = cell.dataset.calendarDay;
      if (dateKey > todayKey()) return;
      appState.qt.calendar.revealed = dateKey;
      appState.qt.calendar.open = dateKey;
      render();
    };
  });

  const plantButton = document.querySelector('[data-plant-detail]');
  if (plantButton) plantButton.onclick = () => openQtGrowthSheet();
}

function bindDetailPanelEvents() {
  const completeButton = document.querySelector('[data-qt-complete]');
  if (completeButton) {
    completeButton.onclick = async () => {
      if (completeButton.disabled) return;
      completeButton.disabled = true;
      const targetDate = completeButton.dataset.qtDate;
      const today = todayKey();
      try {
        if (targetDate !== today) {
          showToast('QT 기록은 오늘의 걸음부터 남길 수 있어요.');
          return;
        }
        if (recordDates().includes(today)) {
          showToast('오늘의 QT 기록은 이미 남겨졌어요.');
          return;
        }
        const row = await insertQtRecord(appState.auth.profile.id, today);
        appState.qt.records.push(row);
        appState.qt.calendar.open = today;
        appState.qt.calendar.revealed = today;
        showToast('오늘도 말씀과 함께했어요 🌿');
        render();
      } catch (error) {
        console.error(error);
        showToast('저장 중 오류가 발생했어요');
      } finally {
        completeButton.disabled = false;
      }
    };
  }

  const saveButton = document.querySelector('[data-qt-save-reflection]');
  if (saveButton) {
    saveButton.onclick = async () => {
      if (saveButton.disabled) return;
      saveButton.disabled = true;
      const input = document.getElementById('qtReflectionInput');
      const value = input ? input.value.trim() : '';
      const targetDate = saveButton.dataset.qtDate;
      const today = todayKey();
      try {
        if (!value) {
          showToast('묵상을 한 줄 남겨주세요.');
          return;
        }
        if (targetDate !== today) {
          showToast('묵상은 오늘의 기록에 남길 수 있어요.');
          return;
        }
        const existing = reflectionByDate(today);
        const saved = existing
          ? await updateReflection(existing.id, value)
          : await insertReflection(appState.auth.profile.id, today, value);
        const list = appState.qt.myReflections;
        const idx = list.findIndex(r => r.id === saved.id);
        if (idx >= 0) list[idx] = saved;
        else list.push(saved);
        appState.qt.calendar.open = today;
        appState.qt.calendar.revealed = today;
        showToast('오늘의 묵상을 나눴어요 ☀️');
        render();
      } catch (error) {
        console.error(error);
        showToast('저장 중 오류가 발생했어요');
      } finally {
        saveButton.disabled = false;
      }
    };
  }
}
```

- [ ] **Step 2: 구문 검사**

Run: `node --check js/qt/page.js && npm test`
Expected: 통과, `# pass 32` (import 대상 `../reflection/feed.js`는 Task 7에서 생성 — `node --check`는 구문만 보므로 통과)

- [ ] **Step 3: 커밋**

```bash
git add js/qt/page.js
git commit -m "feat(qt): 나의 QT 화면(캘린더·상세 패널) 이식 — 계정 기반"
```

---

### Task 7: `js/reflection/feed.js` — 묵상 나눔 피드 (전체 사용자)

**Files:**
- Create: `js/reflection/feed.js`
- Reference: `features/qt/qt-render.js`의 `renderFeedPage`(마크업 원본 — 아래가 이식본)

**Interfaces:**
- Consumes: `appState`, `render`, `renderShell`; `escapeHtml`; `showToast`; `loadFeed`, `addReaction`, `removeReaction` (T4)
- Produces: `renderFeedPage(): void` — 로딩 셸을 먼저 그리고 `loadFeed()` 후 목록을 그린다. 협업자 버전과 달리 **모든 사용자의 묵상**을 닉네임과 함께 표시하고, 반응 카운트는 임베딩된 `reflection_reactions` 행으로 계산한다.

- [ ] **Step 1: `js/reflection/feed.js`**

```js
import { appState, render, renderShell } from '../state.js';
import { escapeHtml } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { loadFeed, addReaction, removeReaction } from './api.js';

function shellHtml(bodyHtml) {
  return `
    <div class="qt-shell">
      <div class="qt-topbar">
        <div style="width:30px;"></div>
        <div class="qt-topbar-title">QT</div>
        <div style="width:30px;"></div>
      </div>

      <div class="qt-main-tabs">
        <button class="qt-tab ${appState.qtTab === 'my' ? 'active' : ''}" data-qt-tab="my">나의 QT</button>
        <button class="qt-tab ${appState.qtTab === 'feed' ? 'active' : ''}" data-qt-tab="feed">묵상 나눔</button>
      </div>

      <div class="feed-section-title">오늘의 묵상 <span>☀️</span></div>

      <div class="feed-list">${bodyHtml}</div>
    </div>
  `;
}

function bindTabEvents() {
  document.querySelectorAll('[data-qt-tab]').forEach(button => {
    button.onclick = () => {
      appState.qtTab = button.dataset.qtTab;
      render();
    };
  });
}

export async function renderFeedPage() {
  renderShell(shellHtml('<div class="dp-note">묵상을 불러오고 있어요…</div>'));
  bindTabEvents();

  let items;
  try {
    items = await loadFeed();
  } catch (error) {
    console.error(error);
    renderShell(shellHtml('<div class="dp-note">묵상을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>'));
    bindTabEvents();
    return;
  }

  appState.feed.items = items;
  const myProfileId = appState.auth.profile.id;

  const listHtml = items.length === 0
    ? '<div class="dp-note">아직 나눠진 묵상이 없어요. 오늘 말씀을 통해 받은 마음을 첫 번째로 나눠보세요.</div>'
    : items.map(item => {
        const nickname = item.profiles?.nickname || '순원';
        const reactions = item.reflection_reactions || [];
        const graceCount = reactions.filter(r => r.reaction_type === 'grace').length;
        const prayCount = reactions.filter(r => r.reaction_type === 'pray').length;
        const hasGrace = reactions.some(r => r.reaction_type === 'grace' && r.profile_id === myProfileId);
        const hasPray = reactions.some(r => r.reaction_type === 'pray' && r.profile_id === myProfileId);
        return `
          <div class="feed-card">
            <div class="feed-top">
              <div class="feed-avatar">${escapeHtml(nickname.slice(0, 1))}</div>
              <div class="feed-meta">
                <div class="feed-name">${escapeHtml(nickname)}</div>
                <div class="feed-date">${escapeHtml(item.reflection_date)}</div>
              </div>
            </div>
            <div class="feed-content">${escapeHtml(item.content)}</div>
            <div class="feed-actions">
              <button class="feed-action ${hasGrace ? 'active' : ''}" type="button" data-reflection-reaction="${item.id}:grace">🙏 은혜받았어요 ${graceCount}</button>
              <button class="feed-action ${hasPray ? 'active' : ''}" type="button" data-reflection-reaction="${item.id}:pray">🤍 함께 기도해요 ${prayCount}</button>
            </div>
          </div>
        `;
      }).join('');

  renderShell(shellHtml(listHtml));
  bindTabEvents();
  bindReactionEvents();
}

function bindReactionEvents() {
  document.querySelectorAll('[data-reflection-reaction]').forEach(button => {
    button.onclick = async () => {
      if (button.disabled) return;
      button.disabled = true;
      const [reflectionId, type] = button.dataset.reflectionReaction.split(':');
      const myProfileId = appState.auth.profile.id;
      const item = appState.feed.items.find(i => String(i.id) === reflectionId);
      const has = (item?.reflection_reactions || []).some(
        r => r.reaction_type === type && r.profile_id === myProfileId,
      );
      try {
        if (has) await removeReaction(reflectionId, myProfileId, type);
        else await addReaction(reflectionId, myProfileId, type);
        await renderFeedPage();
      } catch (error) {
        console.error(error);
        showToast('저장 중 오류가 발생했어요');
        button.disabled = false;
      }
    };
  });
}
```

- [ ] **Step 2: 구문 검사 + import 정적 확인**

Run: `node --check js/reflection/feed.js && grep -n "^export" js/reflection/api.js js/state.js js/ui/dom.js js/ui/toast.js && npm test`
Expected: 통과. grep에 `loadFeed`, `addReaction`, `removeReaction`, `appState`, `render`, `renderShell`, `escapeHtml`, `showToast` 모두 존재. `# pass 32`

- [ ] **Step 3: 커밋**

```bash
git add js/reflection/feed.js
git commit -m "feat(reflection): 묵상 나눔 피드 이식 — 전체 사용자·반응 토글"
```

---

### Task 8: `main.js` 배선 + 루트 `qt.js` 삭제 → 브라우저 검증

**Files:**
- Modify: `js/main.js`
- Delete: `qt.js` (루트 스텁 — `index.html`이 로드하지 않음)

**Interfaces:**
- Consumes: `renderQtView` (T6), `loadMyQtRecords` (T4), `loadMyReflections` (T4)

- [ ] **Step 1: `js/main.js` 수정 4곳**

(a) import 블록 — `import { renderPrayerPage } from './prayer/page.js';` 줄 아래에 추가:
```js
import { renderQtView } from './qt/page.js';
import { loadMyQtRecords } from './qt/api.js';
import { loadMyReflections } from './reflection/api.js';
```

(b) 등록 줄 교체:
```js
registerPage('qt', placeholderPage('QT'));
```
→
```js
registerPage('qt', renderQtView);
```

(c) `placeholderPage` 함수(주석 포함, `function placeholderPage(title) { … }` 전체)를 삭제한다 — 더 이상 사용하는 곳이 없다(`qt`/`prayer`/`my` 모두 실제 화면).

(d) bootstrap 블록 교체:
```js
    // bootstrap — 공용 데이터 1회 로드. Phase 3에서 qt_records를 추가한다.
    const [profiles, meetings, prayers] = await Promise.all([loadProfiles(), loadMeetings(), loadPrayers()]);
    appState.prayer.profiles = profiles;
    appState.prayer.meetings = meetings;
    appState.prayer.prayers = prayers;
    appState.prayer.currentMeetingId = defaultMeetingId(meetings, todayKey());
```
→
```js
    // bootstrap — 공용 데이터 1회 로드
    const [profiles, meetings, prayers, qtRecords, myReflections] = await Promise.all([
      loadProfiles(), loadMeetings(), loadPrayers(), loadMyQtRecords(), loadMyReflections(profile.id),
    ]);
    appState.prayer.profiles = profiles;
    appState.prayer.meetings = meetings;
    appState.prayer.prayers = prayers;
    appState.prayer.currentMeetingId = defaultMeetingId(meetings, todayKey());
    appState.qt.records = qtRecords;
    appState.qt.myReflections = myReflections;
```

- [ ] **Step 2: 루트 `qt.js` 삭제**

Run: `grep -rn "\"\./qt\.js\"\|'\./qt\.js'\|src=\"qt\.js\"" index.html js/ || echo "미참조 확인"` 후
```bash
git rm qt.js
```

- [ ] **Step 3: 구문 검사 + 테스트**

Run: `node --check js/main.js && npm test`
Expected: 통과, `# pass 32`

- [ ] **Step 4: 브라우저 검증 — 나의 QT** (`python3 -m http.server 5500`, 로그인)

1. [QT] 탭 → 상단 탭(나의 QT/묵상 나눔), 식물 배너(`🫘 말씀과 함께한 날 0일`), 새 디자인 캘린더 표시. **날짜 숫자와 요일 열이 맞는다**(일요일 시작 — 예: 2026-08-31은 월요일 열)
2. 하단 상세 패널에 "오늘도 말씀과 함께해볼까요?" + [QT 완료하기] → 클릭 → 토스트 "오늘도 말씀과 함께했어요 🌿", 오늘 칸 강조, 배너 `1일`. **새로고침 후 유지**(DB)
3. 묵상 입력창에 한 줄 작성 → [묵상 나누기] → 토스트 "오늘의 묵상을 나눴어요 ☀️", 입력창에 내용 유지(오늘은 계속 수정 가능). 내용을 고쳐 다시 [묵상 나누기] → 수정 반영. 새로고침 후 유지
4. 과거 날짜 클릭 → 기록 없으면 "남겨진 QT 기록이 없어요.", [QT 완료하기] 버튼 없음. 미래 날짜는 클릭 불가
5. 식물 배너 클릭 → 성장 시트(식물 **이미지**, 진행 바, 현재/최장 연속·함께한 날)
6. ‹ › 로 월 이동 정상

- [ ] **Step 5: 브라우저 검증 — 묵상 나눔**

1. [묵상 나눔] 탭 → 내 묵상이 **닉네임과 함께** 표시
2. [🙏 은혜받았어요] 토글 → 카운트 0↔1, 새로고침 후 유지
3. (가능하면) 두 번째 계정으로 로그인 → 첫 계정의 묵상이 피드에 보이고, QT 미완료 상태에서 묵상 작성 UI가 없는지 확인(완료하기 먼저)

- [ ] **Step 6: 커밋**

```bash
git add js/main.js
git commit -m "feat(qt): QT·묵상 나눔을 앱에 배선하고 루트 qt.js 스텁 제거"
```

---

## 완료 기준 (스펙 §8 Phase 3·4)

- [ ] QT 체크 → 캘린더/연속/누적/식물 갱신, 계정 간 격리(RLS) — Task 8 Step 4
- [ ] 달력 일요일 시작 통일 — Task 3 + Task 8 Step 4-1
- [ ] 묵상: QT 완료 후 작성, 수정(오늘), 피드에 타 사용자 묵상+닉네임, 반응 카운트 — Task 8 Step 5
- [ ] `npm test` 32개 통과
- [ ] 루트 `qt.js` 삭제, `features/*`는 보존(협업자 조율 후 Phase 5 정리)

## 다음(Phase 5)으로 넘기는 것
- 카카오 공급자 설정·검증, `app.js`·`_tmp_check.js`·`features/*`·`supabase/qt_schema.sql` 정리(협업자 합의 후), README 갱신, `003_cutover.sql`(RLS 마무리·anon 정책 제거·`members` DROP — 직전에 002 (2)단계 재실행), `rls_check.sql` prayers 케이스, 작성 시트 save-row sticky, 묵상 삭제 UI(스펙 §8 Phase 4의 '삭제'는 이번 이식 원본에 UI가 없어 보류 — 스펙 소유자 확인 필요)
