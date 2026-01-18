# 아키텍처 의사결정 기록 (ADR)

## ADR-001: 초기 기술 스택 선정
- **상태 (Status)**: 결정됨 (Decided)
- **날짜 (Date)**: 2025-12-21
- **맥락 (Context)**: "대화 연습 공간(Conversation Practice Space)"의 초기 프로젝트 설정. 빠른 개발 속도, 실시간성 잠재력, 그리고 AI 통합이 필요함.
- **결정 (Decision)**:
  - **프론트엔드/프레임워크**: Next.js (React) - 초기에는 데스크탑/모바일 브라우저 접근.
  - **배포 (Deployment)**: Vercel
  - **백엔드/데이터베이스**: Supabase
  - **AI 모델**: Google Gemini (주요/초기 통합)
  - **모바일 전략**: 반응형 웹 우선 (Responsive Web First). Android 앱은 추후 확장 고려 (검토 가능).
- **결과 (Consequences)**:
  - Vercel/Next.js/Supabase 조합으로 빠른 풀스택 개발 가능.
  - Gemini는 대화 축어록 처리를 위한 높은 컨텍스트 윈도우와 비용 효율성을 제공.
  - 초기 진입 장벽을 낮추기 위해 웹 브라우저를 통한 모바일 접근 제공.

## ADR-002: STT 구현 전략 (Google STT & Client-Side Recording)
- **상태 (Status)**: 결정됨 (Decided)
- **날짜 (Date)**: 2026-01-18
- **맥락 (Context)**:
  - 음성 대화를 텍스트로 변환하여 성찰의 재료로 삼아야 함 (`US-019`).
  - 브라우저(PC/Mobile)에서 녹음된 오디오를 서버로 전송해야 함.
  - 서버 사이드 변환(FFmpeg)은 복잡도와 리소스를 증가시킴.
- **결정 (Decision)**:
  - **Client-Side Recording**: 브라우저에서 `audio/webm;codecs=opus` (또는 Safari의 경우 호환 포맷)으로 녹음.
  - **Direct API Call**: 서버 변환 없이 Google Cloud STT API (`WEBM_OPUS`)로 직접 전송.
  - **Google Cloud STT**: 화자 분리(Diarization) 기능 활용.
- **결과 (Consequences)**:
  - 서버에서는 FFmpeg 의존성을 제거하여 경량화.
  - Safari 등 일부 브라우저 호환성을 위한 클라이언트 측 폴리필(Polyfill) 또는 라이브러리 필요.
