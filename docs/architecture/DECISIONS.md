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
