# 🌱 QT & Prayer

매일의 QT를 기록하고, 받은 묵상을 함께 나누며,
서로의 기도제목을 위해 기도할 수 있는 모바일 웹 서비스입니다.

---

## About

**QT & Prayer**는 말씀과 함께한 하루를 부담 없이 기록하고,
꾸준한 묵상 습관을 만들어갈 수 있도록 돕는 서비스입니다.

- QT 기록은 **개인에게만 공개**됩니다.
- 사용자가 작성한 묵상은 **다른 사용자들과 함께 나눌 수 있습니다.**
- 기존 순모임에서 사용하던 **주간 기도제목 공유 기능**도 함께 제공합니다.

---

## Features

### 🌱 QT

- 오늘 QT 완료 기록
- 월간 QT 캘린더
- 현재 / 최장 연속 QT 기록
- 누적 QT 기록
- QT 기록에 따른 식물 성장
- 식물 성장 상세 보기

> 개인의 QT 기록과 성장 정보는 본인에게만 공개됩니다.

### ☀️ 묵상 나눔

- QT 완료 후 오늘의 묵상 작성
- 다른 사용자들의 묵상 피드
- 내 묵상 수정 / 삭제
- 🙏 은혜받았어요
- 🤍 함께 기도해요

> QT 완료 여부나 연속 기록은 공개하지 않고, 사용자가 직접 작성한 묵상만 다른 사용자에게 공유합니다.

### 🙏 기도제목

- 주간 기도제목 작성
- 이전 / 다음 순모임 조회
- 기도제목 수정 / 삭제
- 기도했어요
- 전체 기도제목 취합 및 복사

### 👤 Account

- 회원가입 / 로그인
- 로그인 유지
- 프로필 관리
- 로그아웃

---

## Plant Growth

QT를 완료할수록 식물이 성장합니다.

| Stage | Plant | QT |
| :---: | :---: | :---: |
| 1 | 씨앗 | 0–6 |
| 2 | 새싹 | 7–19 |
| 3 | 어린 식물 | 20–49 |
| 4 | 작은 나무 | 50–99 |
| 5 | 나무 | 100–199 |
| 6 | 풍성한 나무 | 200+ |

식물은 누적 QT 기록을 기준으로 성장하며,
QT를 하지 않은 날이 있어도 이전 단계로 돌아가지 않습니다.

---

## Tech Stack

**Frontend**
- HTML
- CSS
- JavaScript

**Backend**
- Supabase
- Supabase Auth
- Supabase PostgreSQL
- Supabase RLS

**Deployment**
- Netlify

---

## Project Structure

```text
/
├── index.html
├── package.json
├── css/
│   └── style.css
├── assets/
│   └── plants/          # 식물 성장 단계 이미지
├── js/
│   ├── main.js          # 앱 진입점 (부팅 시 데이터 로드)
│   ├── state.js         # 전역 상태 (appState)
│   ├── supabase.js      # Supabase 클라이언트
│   ├── auth/            # 로그인 / 회원가입 / 세션 / 프로필
│   ├── qt/              # QT 캘린더 / 연속 기록 / 식물 성장
│   ├── reflection/      # 묵상 작성 / 피드 / 반응
│   ├── prayer/          # 주간 기도제목
│   ├── ui/              # 시트 / 토스트 / 네비게이션 등 공용 UI
│   └── util/            # 날짜 유틸
├── supabase/
│   ├── 001_schema.sql   # 테이블 + RLS 정책 (정본)
│   ├── 002_migrate.sql  # 레거시 데이터 이관
│   ├── 002b_prayers_member_nullable.sql
│   ├── 002c_legacy_tables_authenticated_policies.sql
│   └── rls_check.sql    # RLS 동작 점검 쿼리
├── tests/               # 순수 로직 단위 테스트
└── README.md
```

> ⚠️ 루트의 `app.js`, `features/`, `supabase/qt_schema.sql`은 계정 기반 전환 이전의 **레거시**로, 현재 앱이 로드하지 않습니다. 새 작업은 `js/` 아래에서 진행해 주세요. (레거시 파일은 정리 예정)

---

## Getting Started

### 1. Clone

```bash
git clone <repository-url>
cd <project-folder>
```

### 2. Supabase 설정

Supabase 프로젝트를 생성한 뒤, 프로젝트에서 사용하는 환경 설정에
Supabase URL과 Publishable Key를 등록합니다.

> ⚠️ Secret Key 또는 Service Role Key는 클라이언트 코드에 절대 포함하지 마세요.

### 3. Run

별도의 프레임워크를 사용하지 않는 경우, VS Code Live Server 등의
로컬 웹 서버를 통해 실행합니다.

### 4. Database

`supabase/001_schema.sql`을 Supabase SQL Editor에서 실행해
테이블과 RLS Policy를 설정한 후 실행합니다.

### 5. Test

```bash
npm test
```

Node 내장 test runner를 사용하므로 별도 의존성 설치가 필요 없습니다.

---

## Privacy

QT 기록은 개인 데이터로 관리합니다.

**Private**
- QT 캘린더
- QT 완료 날짜
- 현재 / 최장 연속 기록
- 누적 QT
- 식물 성장 정보

**Shared**
- 사용자가 작성한 묵상
- 묵상 반응
- 기도제목

데이터 접근 권한은 Supabase RLS를 통해 관리합니다.

---

## Design

Mobile First로 개발합니다.

주요 디자인 키워드: **Sky · Sunlight · Growth · Peace · Warmth**

Sky Blue, Soft Green, Warm Yellow 계열의 밝고 따뜻한 디자인을 사용합니다.

---

## Status

🚧 Currently in development
