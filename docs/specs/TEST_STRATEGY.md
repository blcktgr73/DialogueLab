# 테스트 전략 (Test Strategy)

## 1. 개요
본 문서는 DialogueLab 프로젝트의 코드 품질과 안정성을 확보하기 위한 테스트 전략을 정의합니다. 현재 개발 단계에서는 빠른 피드백과 핵심 로직 검증을 위해 **단위 테스트(Unit Test)** 도입을 최우선으로 합니다.

## 2. 테스트 프레임워크: Vitest
Next.js 및 TypeScript 환경에 최적화된 **Vitest**를 메인 테스트 프레임워크로 선정했습니다.

*   **선정 이유**:
    *   **속도**: Vite 기반으로 동작하여 Jest 대비 빠른 초기 구동 및 실행 속도 제공.
    *   **호환성**: Jest와 거의 동일한 API를 제공하여 학습 곡선이 낮음.
    *   **TypeScript 통합**: 별도의 복잡한 설정 없이 TypeScript 파일을 즉시 테스트 가능.

## 3. 테스트 범위 및 우선순위 (Testing Scope)

테스트 도입은 효율성을 고려하여 **Pure Logic → Business Logic → UI** 순서로 단계적으로 확장합니다.

### 🥇 Phase 1: Core Utilities (핵심 유틸리티) [최우선]
외부 의존성(DB, Network)이 없고 로직 복잡도가 높은 순수 함수(Pure Functions)들을 가장 먼저 테스트합니다. 버그 발생 시 파급력이 크고 디버깅이 어려운 영역입니다.

*   **주요 대상**:
    *   `src/lib/parsers.ts`:
        *   다양한 포맷(TXT, Excel, CSV)의 트랜스크립트 파싱 로직.
        *   헤더 감지, 화자/타임스탬프 추출 등 휴리스틱 로직의 회귀(Regression) 방지 필수.
    *   `src/lib/google-speech.ts`: 환경 변수 유효성 검사 및 싱글톤 인스턴스 초기화 검증.
    *   `src/lib/utils.ts`: 날짜 변환 등 공통 유틸리티.

### 🥈 Phase 2: Server Actions & Business Logic
데이터 처리 흐름과 비즈니스 규칙을 담당하는 서버 액션입니다. 데이터베이스(Supabase)와의 상호작용이 포함되므로 모킹(Mocking) 전략이 필요합니다.

*   **주요 대상**:
    *   `src/app/actions/session.ts`: 세션 생성, 전사 데이터 DB 저장 트랜잭션.
*   **전략**:
    *   실제 DB 연결 대신 `vi.mock()`을 사용하여 Supabase 클라이언트의 동작을 모의(Mock)하여 테스트 속도 확보.

### 🥉 Phase 3: UI Components (인터랙션)
사용자 경험과 직결되는 복합적인 동작을 수행하는 컴포넌트입니다.

*   **주요 대상**:
    *   `src/components/audio-recorder.tsx`: 녹음 시작/중지/전송 상태 관리 사이클.
*   **전략**:
    *   `jsdom` 환경에서 렌더링 테스트.
    *   브라우저 API(`MediaRecorder`, `AudioContext`)에 대한 Mocking 구현 필요.

## 4. 파일 구조 컨벤션
*   테스트 파일은 원본 소스 파일과 **동일한 위치**에 두어 접근성을 높입니다.
    *   `src/lib/parsers.ts` → `src/lib/parsers.test.ts`
    *   `src/components/Button.tsx` → `src/components/Button.test.tsx`

## 5. 향후 로드맵
1.  **Vitest 설치 및 설정**: `vitest.config.ts` 구성.
2.  **Parser 테스트 슈트 작성**: 기존 파싱 로직의 엣지 케이스(잘못된 파일 형식 등) 커버.
3.  **CI 파이프라인 연동**: PR 생성 시 테스트 자동 실행 환경 구축.
