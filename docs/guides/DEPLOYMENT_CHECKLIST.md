# Vercel Deployment Checklist

Vercel에 배포하고 로그인이 정상 작동하게 만들기 위한 단계별 가이드입니다.

## 1. Vercel 프로젝트 생성

1.  [Vercel Dashboard](https://vercel.com/dashboard)에 접속합니다.
2.  **Add New...** > **Project**를 클릭합니다.
3.  GitHub 레포지토리(`DialogueLab`)를 찾아 **Import**를 누릅니다.

## 2. 환경 변수 (Environment Variables) 설정

**Configure Project** 화면에서 `Environment Variables` 섹션을 펼치고, 다음 값들을 입력합니다.
(로컬의 `.env.local` 파일 내용을 그대로 복사하면 됩니다.)

| Key | Value (Example) | 설명 |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI...` | Supabase Anon Key |
| `GOOGLE_GEMINI_API_KEY` | `AIzaSy...` | Gemini API Key |

> **Tip**: `.env.local` 파일 내용을 한 번에 복사해서 붙여넣어도 Vercel이 알아서 파싱해 줍니다.

설정이 끝났으면 **Deploy** 버튼을 클릭합니다. (약 1~2분 소요)

---

## 3. 배포 후 필수 설정 (Post-Deployment)

배포가 완료되면 `https://dialoguelab.vercel.app` 같은 **도메인**이 생성됩니다.
이 도메인을 다음 두 곳에 등록해야 **로그인**이 됩니다.

### A. Supabase Redirect URL 추가
1.  Supabase Dashboard > **Authentication** > **URL Configuration**.
2.  **Redirect URLs**에 `Add URL` 클릭.
3.  `https://<YOUR-VERCEL-DOMAIN>/auth/callback` 입력 및 저장.
    *   (예: `https://dialoguelab.vercel.app/auth/callback`)

### B. Google Cloud Redirect URI 추가
1.  [Google Cloud Console](https://console.cloud.google.com/) > **사용자 인증 정보 (Credentials)**.
2.  **DialogueLab Web** (OAuth 2.0 Client ID) 클릭.
3.  **승인된 리디렉션 URI**에 URI 추가.
4.  `https://<YOUR-VERCEL-DOMAIN>/auth/callback` 입력 및 저장.

---

## 4. 최종 확인
1.  배포된 사이트 접속.
2.  로그인 시도 -> 구글 로그인 성공 후 메인 화면 이동 확인.
3.  세션 생성 및 AI 분석 테스트.
