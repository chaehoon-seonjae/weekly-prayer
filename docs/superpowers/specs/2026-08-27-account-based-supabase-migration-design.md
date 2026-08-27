# QT & Prayer — 계정 기반 Supabase 전환 설계

- 작성일: 2026-08-27
- 상태: 승인됨 (구현 계획 작성 전)
- 관련 문서: `README.md`, `supabase/qt_schema.sql`(폐기 예정)

---

## 1. 배경과 목표

README는 QT 기록(비공개) · 묵상 나눔(공개) · 주간 기도제목 · 계정 기능을 갖춘
모바일 웹 서비스를 정의하지만, 현재 코드는 다음 상태다.

| 영역 | 현재 상태 |
|---|---|
| 기도제목 | `prayer.js`가 `window.__db`, `window.__members`를 참조하지만 설정하는 코드가 없음. 단일 `index.html`(커밋 75ec981)의 `loadFromSupabase()`가 `app.js`/`prayer.js` 분리 과정에서 유실됨. 하드코딩된 5주 + 빈 entries로만 동작 |
| QT | localStorage 전용. `supabase/qt_schema.sql`은 존재하지만 클라이언트가 사용하지 않음 |
| 묵상 나눔 | localStorage 전용(본인 브라우저에서만 보이는 피드). 수정/삭제 UI 없음 |
| 계정 | 회원가입·로그인·닉네임 수정은 구현. 세션 복원 없음 → 새로고침 시 로그아웃 |
| 스키마 | `qt_schema.sql`의 RLS가 README Privacy 모델과 불일치(묵상·프로필·반응을 본인만 읽음), `public_qt_reflections` 뷰가 `security_invoker` 없이 생성되어 RLS 우회 및 `qt_record_id`(비공개) 노출 |
| 기타 | `_tmp_check.js`(1222줄)는 로드되지 않는 잔재. Supabase URL/Key가 3개 파일에 중복 |

### 목표
1. 데이터 계층을 localStorage → Supabase로 전환하고 README Privacy 모델에 맞는 스키마·RLS를 설계한다.
2. 기도제목을 이름 선택 방식에서 **완전 계정 기반**으로 전환하고, 기존 데이터를 이관한다.
3. 로그인 유지(세션 복원)와 카카오 로그인을 추가한다.
4. ES 모듈 구조로 재편하여 전역 의존성 유실 버그를 구조적으로 방지한다.

### 결정 사항 (브레인스토밍에서 확정)
- 기도제목은 완전 계정 기반. `members` 테이블은 이관 후 폐기.
- 백엔드는 **Supabase만** 사용(Auth + PostgreSQL + RLS + SQL 함수). 별도 API 서버·Edge Function 없음.
- 로그인 방식: **이메일/비밀번호 + 카카오 OAuth 병행**.
- 기존 순원 ↔ 신규 계정 연결은 **관리자가 SQL로 수동 매핑**. 앱 내 claim UI 없음.
- **로그인 필수**. 미로그인 시 로그인 화면만 표시. anon 역할은 모든 테이블 접근 차단.
- 프론트엔드는 README대로 프레임워크·번들러 없음. 브라우저 네이티브 ES 모듈 사용.
- 브라우저 localStorage에 있는 QT/묵상 데이터는 테스트 데이터로 간주하고 이관하지 않음.

### 범위 밖
- 순모임 그룹(멀티 테넌트) 개념 — 단일 순모임 전제
- `meetings` 행 생성 UI — 기존처럼 관리자 SQL
- 식물 이미지 자산 — 이모지 유지, `assets/plants/` 디렉터리만 확보
- 오프라인 큐, 재시도, 낙관적 업데이트
- 카카오 비즈 앱 전환(이메일 동의 항목) — 선택 사항, 승인 시 동의 항목만 추가

---

## 2. 데이터 모델 & RLS

### 원칙
- 신원의 기준은 `profiles.id`. `auth.users.id`는 `profiles.auth_user_id`로만 연결한다(이메일 비의존 → 카카오 대응).
- 비공개 데이터(`qt_records`)와 공개 데이터(`reflections`)를 테이블에서 분리한다. 공개 행이 비공개 행을 가리키는 FK를 두지 않는다.
- 뷰 대신 PostgREST 임베딩(`select('*, profiles(nickname)')`)으로 조인한다. `security_invoker` 누락 사고를 원천 제거한다.

### 테이블

| 테이블 | 컬럼 | 비고 |
|---|---|---|
| `profiles` | `id uuid pk`, `auth_user_id uuid unique **nullable**`, `nickname text not null`, `profile_image text`, `display_order int`, `legacy_member_id int`, `created_at`, `updated_at` | `auth_user_id NULL` = 아직 가입하지 않은 기존 순원(자리표시자). `members` 대체. `legacy_member_id`는 이관 추적용 |
| `meetings` | 기존 유지: `id`, `meeting_date`, `meeting_number` | |
| `prayers` | 기존 `id`, `meeting_id`, `items jsonb`, `prayed_count int`, `updated_at` + **`profile_id uuid fk`** 추가, `member_id` 제거, `unique(meeting_id, profile_id)` | |
| `qt_records` | `id`, `profile_id fk`, `qt_date date`, `created_at`, `unique(profile_id, qt_date)` | 완전 비공개 |
| `reflections` | `id`, `profile_id fk`, `reflection_date date`, `content text not null`, `created_at`, `updated_at`, `unique(profile_id, reflection_date)` | `qt_reflections` 대체. `qt_record_id` 없음 |
| `reflection_reactions` | `id`, `reflection_id fk`, `profile_id fk`, `reaction_type text check in ('grace','pray')`, `created_at`, `unique(reflection_id, profile_id, reaction_type)` | 토글 = insert/delete |
| ~~`members`~~ ~~`qt_reflections`~~ ~~구 `qt_records`~~ ~~구 `reflection_reactions`~~ ~~`public_qt_reflections`~~ | 이관 후 삭제 | 구 `qt_*` 테이블은 비어 있음이 확인되면 001에서 DROP 후 재생성 |

### SQL 함수 · 트리거
- `current_profile_id() returns uuid` — `select id from profiles where auth_user_id = auth.uid()`. `stable`, `security invoker`. RLS 정책에서 사용.
- `increment_prayed(p_prayer_id uuid) returns int` — `security definer`. `prayed_count`를 1 증가시키고 새 값을 반환. 호출자는 `authenticated` 역할만 허용(`revoke from public; grant to authenticated`). 횟수 제한 없음(현재 동작 유지).
- `handle_new_user()` — `auth.users` AFTER INSERT 트리거. `profiles` 행 생성. 닉네임 우선순위: `raw_user_meta_data->>'name'` → 이메일 `@` 앞부분 → `'새 친구'`. `profile_image` ← `raw_user_meta_data->>'avatar_url'`.
- `link_legacy_profile(p_legacy_profile_id uuid, p_auth_user_id uuid)` — 관리자 전용 스니펫(002에 포함, 함수로 만들지 않고 트랜잭션 SQL로 제공). 트리거가 만든 신규 프로필 B의 `auth_user_id`를 NULL로 비운 뒤 자리표시자 A에 부여하고 B를 삭제. 순서는 unique 제약 충돌을 피하기 위함.

### RLS 매트릭스
모든 정책은 `to authenticated`. anon은 정책 없음 → 전부 차단.

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | 전원 | ✗ (트리거만) | 본인 (`auth_user_id = auth.uid()`), **컬럼 단위로 `nickname`/`profile_image`/`updated_at`만** (`revoke update` + `grant update (…)`) | ✗ |
| `meetings` | 전원 | ✗ | ✗ | ✗ |
| `prayers` | 전원 | 본인 | 본인 | 본인 |
| `qt_records` | **본인만** | 본인 | ✗ | ✗ (체크 해제 기능 없음) |
| `reflections` | 전원 | 본인 **AND** `exists(select 1 from qt_records where profile_id = current_profile_id() and qt_date = reflection_date)` | 본인 | 본인 |
| `reflection_reactions` | 전원 | 본인 | ✗ | 본인 |

- "기도했어요" 카운트는 타인의 `prayers` 행 UPDATE가 필요하지만 RLS는 컬럼 단위 제한이 불가능하므로, `prayers` UPDATE 정책은 본인만 두고 카운트 증가는 `increment_prayed` RPC로만 수행한다.
- `handle_new_user` 트리거는 `security definer`로 실행되어 `profiles` INSERT 정책이 없어도 행을 만들 수 있다.

---

## 3. 인증 & 세션 흐름

### 진입 시퀀스 (`js/main.js`)
```
페이지 로드
 → renderLoading()
 → supabase.auth.getSession()
     ├─ 세션 없음 → renderLoginPage()
     └─ 세션 있음 → onSignedIn()
 → supabase.auth.onAuthStateChange(event)
     ├─ SIGNED_IN            → onSignedIn()
     ├─ SIGNED_OUT           → appState 초기화 → renderLoginPage()
     └─ TOKEN_REFRESHED 등   → 무시

onSignedIn():
  profile 로드 (profiles where auth_user_id = user.id)
   ├─ null → renderProfilePending()  ("프로필을 준비하고 있어요. 잠시 후 새로고침")
   └─ 있음 → bootstrap()  = Promise.all([meetings, prayers, profiles, qt_records])
              → appState 채움 → view='qt' → render()
              실패 → renderConnectionError(message)
```

- **로그인 유지**: supabase-js가 세션을 localStorage에 저장하고 토큰을 자동 갱신한다. `getSession()` + `onAuthStateChange` 구독이 README의 "로그인 유지" 구현의 전부다.
- **카카오 콜백**: OAuth 후 사이트로 돌아오면 supabase-js가 URL의 토큰을 자동 파싱하고 `SIGNED_IN`을 발생시킨다. 별도 콜백 페이지 없음.
- 상태 전환의 단일 진입점은 `onAuthStateChange`. 로그인/로그아웃 버튼 핸들러는 Supabase 호출만 하고 `render()`를 직접 부르지 않는다.

### 로그인 화면 (`js/auth/loginPage.js`)
- 이메일 / 비밀번호 입력, [회원가입] [로그인] 버튼 — 현재 MY 탭의 폼을 독립 페이지로 이동
- [카카오로 시작하기] → `signInWithOAuth({ provider: 'kakao', options: { redirectTo: location.origin + location.pathname } })`
- 오류는 폼 아래 인라인 메시지. 자주 나오는 Supabase 메시지 한글 매핑:
  `Invalid login credentials` → "이메일 또는 비밀번호가 올바르지 않아요",
  `User already registered` → "이미 가입된 이메일이에요",
  `Email not confirmed` → "이메일 인증을 완료해 주세요", 그 외 → 원문 그대로
- 로그인 성공 후 첫 화면: QT 탭

### 프로필 (MY 탭, `js/auth/profile.js`)
- 초기값은 `handle_new_user` 트리거가 채우므로 현재의 `ensureProfileForUser()` upsert는 제거
- 닉네임 수정 → `profiles.update({ nickname })`. 프로필 이미지는 표시만(업로드 기능은 범위 밖)
- 로그아웃 → `signOut()`. 화면 전환은 `SIGNED_OUT` 이벤트가 담당

### 외부 설정 체크리스트 (코드 아님)
- Supabase → Authentication → URL Configuration → Redirect URLs에 Netlify 배포 URL과 로컬 개발 URL(예: `http://127.0.0.1:5500`) 등록
- Supabase → Authentication → Providers → Email: 개발 중에는 "Confirm email" 비활성화 여부 결정
- Supabase → Authentication → Providers → Kakao: REST API 키 + Client Secret 입력, "Allow users without an email" 활성화
- Kakao Developers: 앱 생성 → 카카오 로그인 ON → Redirect URI `https://<project-ref>.supabase.co/auth/v1/callback` → 동의 항목 `profile_nickname`, `profile_image` → Client Secret 발급
- (선택) 비즈 앱 전환 후 `account_email` 동의 항목 추가

---

## 4. 모듈 구조 & 데이터 흐름

### 디렉터리
```
/
├── index.html                 # <script type="module" src="./js/main.js">
├── css/style.css              # 이동만
├── assets/plants/             # 비어 있음 (.gitkeep)
├── supabase/
│   ├── 001_schema.sql         # 새 테이블·함수·트리거·RLS
│   ├── 002_migrate.sql        # members/prayers → 신규 구조 + link_legacy_profile 스니펫
│   ├── 003_cutover.sql        # 제약 강화, member_id/members DROP, prayers·meetings RLS
│   └── rls_check.sql          # RLS 부정 케이스 검증
├── tests/                     # node --test
├── package.json               # {"type":"module","scripts":{"test":"node --test 'tests/**/*.test.js'"}} — 의존성 없음
└── js/
    ├── main.js                # 진입점 (3장 시퀀스)
    ├── supabase.js            # window.supabase.createClient 1회 → export client
    ├── state.js               # appState, render() 디스패치, 탭 전환
    ├── ui/
    │   ├── dom.js             # escapeHtml, $app
    │   ├── sheet.js           # openSheet / closeSheet
    │   ├── toast.js           # showToast
    │   └── nav.js             # 하단 탭 렌더 + 바인딩
    ├── auth/
    │   ├── session.js         # getSession, onAuthStateChange 구독, signOut, signInWithKakao
    │   ├── loginPage.js       # 이메일 폼 + 카카오 버튼 + 오류 매핑
    │   └── profile.js         # 프로필 로드/수정 API + MY 페이지
    ├── qt/
    │   ├── api.js             # qt_records select / insert
    │   ├── streak.js          # 순수: total, currentStreak, longestStreak
    │   ├── growth.js          # 순수: 단계·진행률 (README 표 6단계)
    │   ├── calendar.js        # 순수: 월 달력 42칸 생성
    │   └── page.js            # 나의 QT 화면 + 성장 상세 시트
    ├── reflection/
    │   ├── api.js             # reflections + reflection_reactions 쿼리
    │   ├── feed.js            # 묵상 나눔 피드
    │   └── editor.js          # 오늘의 묵상 작성/수정/삭제 (QT 페이지 하단)
    └── prayer/
        ├── api.js             # meetings/prayers 쿼리, increment_prayed RPC
        ├── meeting.js         # 순수: 정렬, 이전/다음, 이번 주/지난/다음 판정
        ├── page.js            # 기도제목 목록 화면
        └── sheets.js          # 작성/수정/삭제 확인/전체 복사 시트
```

### 계층 규칙 (의존 방향은 아래로만)
```
page.js / feed.js / sheets.js / editor.js   화면: appState 읽기, api 호출, render()
        ↓
api.js (모듈별)                              Supabase를 아는 유일한 계층. 행 배열/객체 반환, error는 throw
        ↓
supabase.js                                 client 하나
```
- `streak.js`, `growth.js`, `calendar.js`, `meeting.js`는 **인자만 받는 순수 함수**. `Date.now()`, DOM, Supabase에 의존하지 않는다("오늘"은 인자로 받는다). 단위 테스트 대상.
- `ui/*`는 `state.js`, `api.js`를 import하지 않는다(순환 방지).
- supabase-js는 UMD CDN `<script>`를 유지하고 `supabase.js`가 `window.supabase.createClient`를 감싸 export한다. Supabase URL/Key는 이 파일에만 존재한다.

### appState
```js
{
  view: 'qt' | 'prayer' | 'my',
  qtTab: 'my' | 'feed',
  auth:   { user, profile },
  qt:     { records: [{ id, qt_date }], month: Date },
  feed:   { items: [{ id, profile_id, reflection_date, content, created_at,
                      profiles: { nickname, profile_image },
                      reflection_reactions: [{ profile_id, reaction_type }] }] },
  prayer: { meetings: [], prayers: [{ id, meeting_id, profile_id, items, prayed_count }],
            profiles: [],               // 분모(전체 순원 수) 및 이름 표시용
            currentMeetingId, collapsed: {} }
}
```

### 데이터 흐름
- **bootstrap** (로그인 직후 1회): `Promise.all([meetings, prayers, profiles, qt_records])` → appState → `render()`. 옛 `loadFromSupabase()` 역할 복원.
- **묵상 피드**: 탭 진입 시마다 로드(`reflections` + 임베딩, 최신순).
- **쓰기**: api 호출 성공 → 반환 행으로 appState 갱신 → `render()`. 실패 → 토스트. 낙관적 업데이트 없음.
- **기도제목 화면**: `prayers.filter(p => p.meeting_id === currentMeetingId)`. "작성 완료 n / m"의 분모 m은 `profiles` 수(자리표시자 포함). 작성자 = 본인 프로필이므로 기존 "누구의 기도제목인가요?" 순원 선택 시트(`openMemberSheet`)는 제거. 수정/삭제 버튼은 `p.profile_id === auth.profile.id`일 때만 노출.
- **기도했어요**: `increment_prayed(prayer_id)` RPC → 반환된 새 카운트로 `prayed_count` 갱신. "함께 기도했어요" 표시용 로컬 플래그(`localStorage prayed:<meeting>:<prayer>`)는 UI 연출 목적이므로 유지.
- **QT 완료 체크**: `qt_records.insert({ profile_id, qt_date: today })`. 이후 묵상 편집 영역 노출.
- **묵상 반응 토글**: 내 반응이 `reflection_reactions`에 있으면 delete, 없으면 insert → 피드 재로드.

### 순수 함수 시그니처
```js
// qt/streak.js
getTotal(dates: string[]): number
getCurrentStreak(dates: string[], todayKey: string): number
getLongestStreak(dates: string[]): number
// qt/growth.js
getStage(total: number): { index, name, icon, min, max }        // README 표 그대로
getProgress(total: number): { stage, remaining, percent }
// qt/calendar.js
getMonthGrid(year: number, month: number): Date[]                 // 42칸, 일요일 시작
  // 현재 코드는 요일 헤더(일요일 시작)와 그리드 계산 `(getDay()+6)%7`(월요일 시작)이 불일치하는 버그가 있음 → 일요일 시작으로 통일
// prayer/meeting.js
sortMeetingsAsc(meetings), adjacentMeeting(meetings, currentId, dir),
defaultMeetingId(meetings, todayKey), classifyMeeting(meeting, meetings, todayKey)
  // → 'current' | 'past' | 'future' | 'latest'
```

---

## 5. 마이그레이션 절차

파괴적 변경을 마지막 단계에만 두어, 그 전까지 옛 프론트가 계속 동작하도록 한다(expand → migrate → contract).

| # | 작업 | 내용 | 옛 프론트 |
|---|---|---|---|
| 0 | 백업 | 대시보드에서 `members`, `meetings`, `prayers` CSV 내보내기 (또는 PITR 확인) | 정상 |
| 1 | `001_schema.sql` | `profiles`, `qt_records`, `reflections`, `reflection_reactions` 생성. `current_profile_id`, `increment_prayed`, `handle_new_user` 트리거. 새 테이블 RLS. `prayers`에 `profile_id uuid null` 컬럼 추가. 구 `qt_records`/`qt_reflections`/`reflection_reactions`/`public_qt_reflections`는 비어 있음 확인 후 DROP | 정상 (추가만) |
| 2 | `002_migrate.sql` | `members` → `profiles` (`nickname = name`, `display_order`, `auth_user_id NULL`, `legacy_member_id = members.id`). `prayers.profile_id` ← `member_id` 조인. 검증 쿼리. `link_legacy_profile` 스니펫 포함 | 정상 |
| 2b | `002b_prayers_member_nullable.sql` | `prayers.member_id` NOT NULL 해제(새 프론트가 `member_id` 없이 작성). 옛 프론트 호환을 위해 새 프론트는 `member_id = profiles.legacy_member_id`(없으면 NULL)를 함께 기록 | 정상 |
| 3 | 순원 가입 + 관리자 연결 | 순원이 가입 → 트리거가 프로필 B 생성 → 관리자가 `link_legacy_profile` 스니펫으로 자리표시자 A에 `auth_user_id` 부여, B 삭제. 가입 안 한 순원은 A가 남아 이름만 표시 | 정상 |
| 4 | 새 프론트 배포 | Netlify에 ES 모듈 구조 코드 배포 | 교체됨 |
| 5 | `003_cutover.sql` | 새 프론트 안정화(며칠) 후. **먼저 002의 (2)단계(`prayers.profile_id` 채움)를 재실행하고 `unmapped_prayers = 0` 재확인** (002~003 사이 옛 프론트가 쓴 행은 `profile_id` NULL). 이어서 `prayers.profile_id set not null`, `unique(meeting_id, profile_id)`, `member_id` DROP, `prayers`·`meetings` RLS 활성화 + 정책, `members` DROP, `supabase/qt_schema.sql` 삭제 | 중단 (이미 교체됨) |

### 검증 쿼리 (002 · 003에 포함)
```sql
select count(*) as unmapped from prayers where profile_id is null;             -- 0
select (select count(*) from members)
     = (select count(*) from profiles where legacy_member_id is not null);    -- true
select meeting_id, profile_id, count(*) from prayers
 group by 1,2 having count(*) > 1;                                            -- 0행 (unique 가능)
```

### 롤백
- 5단계 이전: 모든 변경이 추가만이므로 옛 프론트 재배포로 복구
- 5단계 이후: 0단계 백업으로 복원

### `prayers` RLS를 5단계로 미루는 이유
옛 프론트는 anon으로 `prayers`를 읽고 쓴다. RLS를 켜면 anon이 차단되어 옛 프론트가 즉시 동작을 멈추므로, 새 프론트 배포(4) 이후에 켠다.

---

## 6. 에러 처리

- `api.js`: Supabase 응답의 `error`가 있으면 `throw error`. 화면 코드는 `try/catch` → `showToast(한 줄)`.
- bootstrap 실패: `renderConnectionError(message)` — "불러오지 못했어요 + 새로고침 안내" (옛 버전 복원).
- 인증 오류: 로그인 페이지 인라인 메시지 + 3장 한글 매핑.
- RLS 거부: 클라이언트에서 먼저 막고(예: QT 미완료 시 묵상 작성 버튼 비활성), 우회 시에만 토스트.
- 하지 않는 것: 오프라인 큐, 재시도, 낙관적 업데이트.

---

## 7. 테스트

| 층 | 방법 | 대상 |
|---|---|---|
| 순수 함수 | `node --test 'tests/**/*.test.js'` (Node 22+, 의존성 0) | `streak.js`(빈 배열·오늘 미완료·연속 끊김), `growth.js`(0/6/7/19/20/49/50/99/100/199/200 경계값), `calendar.js`(42칸·월 시작 요일), `meeting.js`(정렬·인접·이번 주 판정) |
| RLS | `supabase/rls_check.sql` — `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>"}'`로 사용자 A·B를 흉내내어 부정 케이스를 assert | B가 A의 `qt_records` SELECT → 0행 / B가 A의 `prayers` UPDATE → 0행 영향 / A가 `qt_records` 없는 날짜에 `reflections` INSERT → 정책 위반 / anon이 아무 테이블 SELECT → 거부 / B가 `increment_prayed(A의 prayer)` → 성공 |
| E2E | 수동 체크리스트, 계정 2개 · 브라우저 2개 | 각 Phase 완료 기준 |

---

## 8. 로드맵

각 Phase는 배포 가능한 단위. 의존: 1 → (2, 3) → 4 → 5.

| Phase | 내용 | 완료 기준 |
|---|---|---|
| **1. 기반** | `001_schema.sql`·`002_migrate.sql` 작성·실행(0~2단계), `package.json`·`tests/` 셋업, `js/main·supabase·state·ui/*` 스켈레톤, `auth/*`(세션 복원·로그인 페이지·MY 이관), `index.html` 모듈 전환 | 이메일 로그인 → 3탭 빈 화면 진입 · **새로고침해도 로그인 유지** · 로그아웃 시 로그인 화면 · `npm test` 통과(순수 함수 테스트 포함) |
| **2. 기도제목** | `prayer/*` 계정 기반 재작성, bootstrap 로딩 복원, `increment_prayed` 연결, 순원 선택 시트 제거 | 목록·작성·수정·삭제·기도했어요·전체 복사가 Supabase에 반영 · 타인 글에 수정 버튼 미노출 (`prayers` RLS 검증은 003 실행 후 Phase 5에서) |
| **3. QT** | `qt/*` Supabase 연동, 캘린더·스트릭·성장 시트 | 체크 → 캘린더/연속/누적/식물 갱신 · 계정 B에서 A 기록 조회 불가 |
| **4. 묵상 나눔** | `reflection/*` — 작성(QT 완료 후)·수정·삭제·피드·반응 토글 | A의 묵상이 B 피드에 닉네임과 함께 표시 · 반응 카운트 정확 · QT 미완료 시 작성 차단(UI + RLS) |
| **5. 마무리** | 카카오 로그인 버튼 + 외부 설정 체크리스트, `_tmp_check.js`·`qt_schema.sql` 삭제, README(Project Structure·Getting Started) 갱신, 새 프론트 배포(4단계), 안정화 후 `003_cutover.sql`(5단계) | 카카오 가입 → 프로필 자동 생성 · `members` 없이 전 기능 동작 · `rls_check.sql` 전체 통과 |

---

## 9. 주요 결정의 근거 (요약)

- **뷰 대신 임베딩**: 현 스키마의 `public_qt_reflections`가 `security_invoker` 없이 RLS를 우회한 사례가 있음. 임베딩은 원본 테이블의 RLS를 그대로 따른다.
- **`increment_prayed` RPC**: RLS는 행 단위라 "남의 행의 특정 컬럼만 수정 허용"이 불가능. `security definer` 함수가 유일한 안전한 경로.
- **`profiles.auth_user_id` nullable**: 미가입 순원의 과거 기도제목을 이름과 함께 보존하면서, 가입 후 관리자가 한 컬럼만 채워 연결할 수 있게 함.
- **묵상 작성 조건을 RLS에**: 클라이언트 우회 시에도 "QT 완료 후 작성" 규칙이 유지됨.
- **ES 모듈**: `window.__db` 유실 버그는 전역 의존성이 코드상 보이지 않아 생긴 문제. `import`는 의존을 명시해 같은 종류의 유실을 구조적으로 막는다.
