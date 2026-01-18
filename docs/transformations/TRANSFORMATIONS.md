# Transformation Log

## 템플릿
```md
## T-YYYYMMDD-### — <간략한 제목>
- Intent (구조적 개선 목표): 이 변경이 기존 시스템의 어느 부분에 생명력/전체성을 더하는가? (문제-맥락-해결책 구조)
- Change (변경 사항):
- Constraints (제약 사항):
- Design Options (설계 옵션): (A) (B) (C) - 트레이드오프와 구조적 영향을 포함.
- Chosen & Rationale (선택 및 근거):
- Acceptance (테스트/데모 기준):
- Impact (API/Data/UX/문서 영향):
- Structural Quality Metric Change (구조적 품질 지표 변화): 응집도/결합도 변화 요약.
- Follow-ups (후속 작업):
```

## Log

## T-20251221-001 — Next.js 프로젝트 기반 초기화
- **Intent (구조적 개선 목표)**: 개발을 시작할 수 있는 웹 애플리케이션 컨테이너("그릇")를 마련함. 추상적인 아이디어를 실행 가능한 코드로 전환할 기반 구축.
- **Change (변경 사항)**:
  - Next.js 14+ (App Router), TypeScript, Tailwind CSS, ESLint 초기화.
  - 프로젝트 루트에 소스 코드 배치 (`app/`, `public` 등).
- **Constraints (제약 사항)**:
  - npm 패키지 명명 규칙으로 인해 `temp-app` 생성 후 파일 이동 방식으로 진행.
- **Decision (선택 및 근거)**:
  - **Next.js App Router**: 최신 React 기능(Server Components) 활용 및 Vercel 배포 최적화.
  - **TypeScript**: 타입 안정성을 통한 리팩토링 용이성 확보.
- **Impact (영향)**:
  - `package.json`, `tsconfig.json`, `next.config.js` 등 설정 파일 생성.
  - `app/` 디렉토리 구조 생성.

## T-20251221-002 — 기본 레이아웃 및 디자인 시스템 설정 (Base UI)
- **Intent (구조적 개선 목표)**: 사용자가 심리적 안전감을 느낄 수 있는 시각적 환경 조성 및 일관된 UI 시스템 구축.
- **Change (변경 사항)**:
  - `shadcn/ui` 도입 (Button, Card 컴포넌트).
  - Pretendard 폰트(CDN) 및 Warm Gray/Deep Slate 컬러 팔레트 적용 (`globals.css`, `layout.tsx`).
  - 모바일 퍼스트 반응형 셸(Shell) 레이아웃 구현.
  - 홈 화면(`page.tsx`) Empty State 대시보드 구현.
- **Constraints (제약 사항)**:
  - Tailwind v4 호환성 확인 필요 (shadcn init 시점).
- **Decision (선택 및 근거)**:
  - **Pretendard**: 한글 가독성 최우선.
  - **Warm Colors**: 평가보다는 성찰에 적합한 차분한 분위기 유도.
- **Impact (영향)**:
  - `src/components/ui/` 폴더 생성.
  - `src/components/ui/` 폴더 생성.
  - `src/app/globals.css` 디자인 토큰 정의.

## T-20251221-003 — 세션 관리 기초 (Supabase 연동)
- **Intent (구조적 개선 목표)**: 대화 데이터를 영구적으로 저장할 수 있는 '기억 저장소'를 연결하고, 세션 생성 프로세스를 확립함.
- **Change (변경 사항)**:
  - Supabase 클라이언트 설정 (`utils/supabase`).
  - `sessions` 테이블 스키마 정의 (`docs/migrations`).
  - Next.js Server Action (`createSession`) 구현 및 홈 화면 연동.
  - 세션 상세 페이지 (`app/sessions/[id]`) 셸 구현.
- **Constraints (제약 사항)**:
  - 아직 로그인 기능이 없어 익명(Anonymous) 세션 생성 허용.
- **Decision (선택 및 근거)**:
  - **Server Actions**: 복잡한 API Route 없이 함수 호출처럼 직관적으로 DB 작업 수행. (Form Action 패턴 활용)
  - **@supabase/ssr**: Next.js 14+ 호환 최신 라이브러리 사용.
- **Impact (영향)**:
  - `.env.local` 환경변수 의존성 추가.
  - DB 스키마 의존성 추가.

## T-20251221-004 — 축어록(Transcript) 기능 구현
- **Intent (구조적 개선 목표)**: 대화의 핵심 콘텐츠인 '말(Speech)'을 시각화하고, 데이터베이스에 저장할 수 있는 구조 마련.
- **Change (변경 사항)**:
  - `transcripts` 테이블 생성 (`session_id` FK).
  - `TranscriptView` 컴포넌트 구현 (나/상대방 말풍선 스타일링).
  - 세션 상세 페이지에 축어록 조회 및 수동 입력 폼 추가.
- **Constraints (제약 사항)**:
  - 아직 AI 음성 인식(STT)이 없으므로 텍스트 수동 입력을 통해 기능 검증.
- **Decision (선택 및 근거)**:
  - **Single Table**: 발화자(speaker) 컬럼을 통해 단순하게 데이터 관리.
  - **Optimistic UI (보류)**: 현재는 Server Action 후 `revalidatePath`로 단순 새로고침 처리.
- **Impact (영향)**:
  - `components/transcript-view.tsx` 추가.
  - `actions/transcript.ts` 추가.

## T-20251221-005 — 축어록 파일 업로드 (File Ingestion)
- **Intent (구조적 개선 목표)**: 외부 툴(Zoom, Clova Note 등)에서 생성된 대화 기록을 손쉽게 Import하여 분석 준비 단계를 단축함.
- **Change (변경 사항)**:
  - `xlsx` 라이브러리 도입 (Excel/CSV 파싱).
  - `TranscriptUploader` 컴포넌트 구현 (파일 선택 -> 파싱 -> 미리보기 -> 저장).
  - `bulkAddTranscripts` Server Action 구현 (Batch Insert).

## T-20251221-006 — Lens 성찰 기능 (AI Reflection)
- **Intent (구조적 개선 목표)**: 축어록 데이터를 단순 조회하는 것을 넘어, AI를 통해 제3자의 관점(Lens)에서 분석된 통찰을 제공.
- **Change (변경 사항)**:
  - `analysis_results` 테이블 생성 (JSONB).
  - `gemini.ts` 유틸리티 구현 (Google Generative AI + Dirty JSON Parsing Pattern).
  - `analyzeSession` Server Action 및 `AnalysisView` UI 구현.
  - **Prompt Engineering**: 한국어 응답 강제 (`Respond in KOREAN`).
  - **UX**: `AnalyzeButton` (Client Component) 도입으로 Loading State 시각화.
- **Constraints (제약 사항)**:
  - AI 응답 속도 고려 (수 초 소요됨) -> Server Action + Streaming UI(추후 보완) 또는 Loading State.
  - JSON 응답의 불안정성 -> `AI_JSON_PARSING_PATTERN.md`의 복구 로직 적용.
- **Decision (선택 및 근거)**:
  - **Gemini 1.5 Flash**: 빠르고 비용 효율적이므로 실시간성이 중요한 성찰 기능에 적합.
  - **Robust Parsing**: AI가 마크다운을 섞거나 JSON 형식을 어기는 경우를 대비하여, 클라이언트 사이드가 아닌 서버 유틸리티 레벨에서 파싱/복구를 수행.
- **Impact (영향)**:
  - `lib/gemini.ts` 추가.
  - `components/analysis-view.tsx` 추가.

## T-20251221-007 — 사용자 인증 및 보안 강화 (Auth & Security)
- **Intent (구조적 개선 목표)**: 데모 수준의 익명 접근을 차단하고, 사용자별 데이터 격리(Isolation)를 통해 개인화된 서비스를 제공함.
- **Change (변경 사항)**:
  - `middleware.ts` 도입 (세션체크 및 리다이렉트).
  - `/login` 페이지 및 Google OAuth 연동.
  - **RLS 강화**: `anon` 정책 제거 -> `authenticated` 및 `user_id` 기반 소유권 검증 정책 적용.
- **Decision (선택 및 근거)**:
  - **Supabase SSR Auth**: Next.js App Router와 가장 호환성이 좋은 `@supabase/ssr` 패키지 활용.
  - **Middleware**: 페이지별 인증 로직 중복 제거를 위해 미들웨어에서 일괄 처리.
- **Impact (영향)**:
  - `src/app/login/page.tsx`, `src/app/auth/callback/route.ts` 추가.
  - DB RLS 정책 전면 수정.

## T-20251221-008 — 사용자 프로필 및 내비게이션 (Profile & Nav)
- **Intent (구조적 개선 목표)**: 사용자 정체성을 확립하고, 자연스러운 앱 탐색 경험을 제공함.
- **Change (변경 사항)**:
  - `profiles` 테이블 생성 (Trigger 기반 자동 동기화).
  - 프로필 페이지(`src/app/profile`) 구현: 이름 변경, 로그아웃.
  - 글로벌 내비게이션(`MainNav`) 추가 및 Layout 통합.
- **Decision (선택 및 근거)**:
  - **Upsert Pattern**: 기존 가입자의 프로필 누락 문제를 방지하기 위해 Update 대신 Upsert 사용.
  - **Trigger**: Auth User 생성 시점과 Profile 생성 시점을 DB 레벨에서 강 결합하여 데이터 무결성 보장.
- **Impact (영향)**:
  - `src/app/actions/auth.ts` 추가.
  - `src/components/main-nav.tsx` 추가.

## T-20251221-009 — Vercel 배포 (Deployment)
- **Intent (구조적 개선 목표)**: 로컬 호스트를 벗어나 실제 사용자가 접근 가능한 퍼블릭 환경으로 서비스를 런칭함.
- **Change (변경 사항)**:
  - Vercel 프로젝트 연동 및 환경변수(`ENV`) 설정.
  - OAuth 인증을 위한 Redirect URL 등록 (Supabase, Google Cloud).
  - RLS 에러 (`42501`) 수정을 위한 `createSession` Server Action 보완 (Explicit `user_id`).
- **Impact (영향)**:
  - `docs/guides/DEPLOYMENT_CHECKLIST.md` 추가.
  - `src/app/actions/session.ts` 수정.
  - Production URL 생성 (예: `dialogue-lab.vercel.app`).

## T-20251221-010 — 세션 대시보드 (Session Dashboard)
- **Intent**: 홈 화면에서 과거의 대화 기록을 쉽게 찾아보고 접근할 수 있도록 함.
- **Change**:
  - `page.tsx`: Server Component로 변환하여 세션 목록 Fetching.
  - `SessionCard`: 목록 UI 컴포넌트화.
  - `date-fns` 도입: 날짜 표기 개선 ("3일 전").

## T-20251221-011 — 세션 관리 기능 강화 (Management)
- **Intent**: 세션 이름을 직관적으로 관리하고, 불필요한 세션을 정리할 수 있게 함.
- **Change**:
  - **Delete**: 세션 영구 삭제 기능 (`deleteSession`).
  - **Rename**: 세션 제목 수정 기능 (`updateSessionTitle`).
  - **Auto-Rename**: 파일 업로드 시 파일명으로 제목 자동 설정.
  - **RLS Policy Fix**: `sessions` 테이블에 `update` 정책 추가 (`006_add_session_update_policy.sql`).
- **Impact**:
  - `src/components/session-card.tsx` (Client Component with Menu).
  - `src/components/session-title.tsx` (Editable Header).
  - `src/app/actions/transcript.ts` 수정.

## T-20251221-012 — 화자 이름 변경 및 정렬 보정 (Speaker Renaming)
- **Intent**: 대화 기록에서 잘못된 화자 이름을 수정하고, 대량 업로드 시 순서 섞임을 방지함.
- **Change**:
  - **Speaker Rename**: `updateSpeaker` 구현 (Session ID + Old Name 기준 일괄 변경).
  - **Interactive UI**: `TranscriptView`에서 이름 클릭 시 수정 모드 전환.
  - **Sorting Fix**: `transcript_index` 컬럼 추가하여 업로드 순서 보장.
  - **Stability**: 파일 파싱 시 공백 제거(Trim), UI 동기화(useEffect, router.refresh) 강화.
- **Impact**:
  - `src/components/transcript-view.tsx`
  - `src/app/actions/transcript.ts`
  - `src/lib/parsers.ts`

## T-20251221-013 — MITI 기반 평가 및 연습 카드 (MITI Evaluation)
- **Intent**: 동기면담(MITI 4.2) 표준에 기반한 전문적 상담 역량 평가 및 학습 기능 제공.
- **Change**:
  - **Spec**: `Docs/specs/MITI_EVALUATION_DESIGN.md` (Symmetric Evaluation Design).
  - **Schema**: `analysis_results` 테이블의 `lens` 컬럼에 'miti' 타입 추가.
  - **Feature**: 양방향(상담자/내담자) 평가, 행동 빈도 분석, 연습 카드(Practice Card) 생성.
- **Impact**:
  - `src/app/actions/analysis.ts`
  - `src/components/analysis-view.tsx`
  - `src/lib/gemini.ts`


## T-20260118-014  사용자 초대 및 협업 기능 (Collaboration)
- **Intent (구조적 개선 목표)**: 혼자만의 성찰을 넘어, 동료와 대화를 공유하고 함께 회고할 수 있는 협업 구조를 마련함.
- **Change (변경 사항)**:
  - session_participants 테이블 추가 (Role: owner, editor, viewer).
  - collaboration.ts Server Actions 구현 (searchUsers, inviteUser, removeParticipant).
  - CollaborationManager 컴포넌트 구현 (검색, 초대, 목록 관리).
  - 이메일 마스킹 처리를 통해 개인정보 보호 강화.
- **Impact (영향)**:
  - src/app/actions/collaboration.ts 추가.
  - src/components/collaboration-manager.tsx 추가.
  - 관련 User Stories: US-010, US-011 완료.

## T-20260118-015 — 다자간 음성 인식 (STT) 구현
- **Intent (구조적 개선 목표)**: 음성 대화를 텍스트(연습 재료)로 변환하여 성찰(Reflection)의 기반을 마련함. "무슨 말이 오갔는가"를 객관적인 데이터로 확보.
- **Change (변경 사항)**:
  - **AudioRecorder UI**: 브라우저 내장 API 활용 녹음 및 시각적 피드백 제공.
  - **STT API Route**: `src/app/api/stt/route.ts` 구현 (Google Cloud Speech-to-Text 연동).
  - **Google Cloud SDK**: `@google-cloud/speech` 라이브러리 추가.
- **Constraints (제약 사항)**:
  - **iOS Safari 호환성**: `audio/webm` 미지원 구버전 대비 필요 (최신 버전은 `MediaRecorder` 지원).
  - **Client-Side Formatting**: 서버 변환 없이 브라우저에서 STT 호환 포맷(`WEBM_OPUS`) 생성.
- **Design Options (설계 옵션)**:
  - (A) Server-Side Conversion: 모든 포맷 수용 -> FFmpeg 서버 변환 (무거움).
  - (B) Client-Side Formatting: 클라이언트가 표준 포맷 준수 -> 서버는 Passthrough (가벼움, 선정됨).
- **Chosen & Rationale (선택 및 근거)**:
  - **Client-Side Formatting (B)**: 구조적 간결함과 유지보수성 우수. 서버 리소스 최소화.
- **Usage Context & UX Impact**:
  - **Consistency**: 기존 업로드 방식과 유사한 처리 흐름.
  - **Path Continuity**: 녹음 -> 전사 -> 렌즈 선택으로 이어지는 자연스러운 성찰 흐름 연결.
- **Impact (영향)**:
  - `package.json` 의존성 추가.
  - `gcp_client_secret.json` 활용.
  - `src/components/audio-recorder.tsx` 구현 예정.
