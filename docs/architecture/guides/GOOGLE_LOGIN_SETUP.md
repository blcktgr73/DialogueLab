# Google Login Setup Guide

Google 로그인을 작동시키기 위해서는 **Google Cloud Platform**에서 키를 발급받아 **Supabase**에 입력해야 합니다.

## 1. Google Cloud Console 설정

1.  [Google Cloud Console](https://console.cloud.google.com/)에 접속합니다.
2.  좌측 상단 프로젝트 선택 드롭다운에서 **새 프로젝트(New Project)**를 생성합니다 (이름 예: `DialogueLab`).
3.  **API 및 서비스 (APIs & Services)** > **OAuth 동의 화면 (OAuth Consent Screen)**으로 이동합니다.
    *   **User Type**: `External` (외부) 선택 후 만들기.
    *   **앱 이름**: `DialogueLab` 입력.
    *   **사용자 지원 이메일**: 본인 이메일 선택.
    *   **개발자 연락처 정보**: 본인 이메일 입력.
    *   나머지는 기본값으로 두고 저장하며 진행합니다.
4.  **사용자 인증 정보 (Credentials)** 메뉴로 이동합니다.
5.  **+ 사용자 인증 정보 만들기 (+ Create Credentials)** > **OAuth 클라이언트 ID (OAuth Client ID)**를 클릭합니다.
    *   **애플리케이션 유형**: `웹 애플리케이션 (Web Application)`.
    *   **이름**: `DialogueLab Web`.
    *   **승인된 리디렉션 URI (Authorized redirect URIs)**:
        *   `https://<YOUR-PROJECT-ID>.supabase.co/auth/v1/callback`
        *   *(이 주소는 Supabase Dashboard > Authentication > Providers > Google 에서 `Callback URL`로 확인할 수 있습니다)*
    *   **만들기 (Create)** 클릭.
6.  생성 완료 팝업에서 **클라이언트 ID (Client ID)**와 **클라이언트 보안 비밀 (Client Secret)**을 복사합니다.

## 2. Supabase 설정

1.  [Supabase Dashboard](https://supabase.com/dashboard)에서 해당 프로젝트로 이동합니다.
2.  좌측 메뉴의 **Authentication** > **Providers**를 클릭합니다.
3.  **Google**을 찾아서 펼칩니다 (Disabled 상태일 겁니다).
4.  **Google enabled** 스위치를 켭니다.
5.  복사해둔 정보를 입력합니다:
    *   **Client ID**: (Google Cloud에서 복사한 값)
    *   **Client Secret**: (Google Cloud에서 복사한 값)
6.  **Save**를 누릅니다.

## 3. Redirect URL 설정 (Localhost 테스트용)

로컬 개발 환경(`localhost:3000`)에서 로그인이 되게 하려면 추가 설정이 필요합니다.

1.  Supabase Dashboard > **Authentication** > **URL Configuration**으로 이동합니다.
2.  **Redirect URLs** 섹션에 `Add URL`을 클릭합니다.
3.  `http://localhost:3000/auth/callback` 을 입력하고 저장합니다.

---

이제 앱의 `/login` 페이지에서 로그인 버튼을 누르면 정상 작동할 것입니다!
