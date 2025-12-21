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
  - `src/middleware.ts`, `src/utils/supabase/middleware.ts` 추가.
  - `src/app/login/page.tsx`, `src/app/auth/callback/route.ts` 추가.
  - DB RLS 정책 전면 수정.

