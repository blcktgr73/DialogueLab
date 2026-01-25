# Gemini Live Spike Report

## 목표
Gemini Live(Realtime) 음성 대화 연동 가능성 확인 및 테스트 하네스 구축.

## 환경
- 위치: `C:\Projects\DialogueLab\scripts`
- 스크립트: `test-gemini-live.mjs`
- 인증: `C:\Projects\DialogueLab\.env.local` 의 `GEMINI_API_KEY` 사용
- 모델 기본값: `models/gemini-2.0-flash-exp`
- 엔드포인트: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`

## 테스트 범위
1) 텍스트 응답 확인
2) 오디오 입력(PCM) -> 오디오 출력(PCM) 확인
3) 마이크 스트리밍 입력 확인
4) 출력 오디오 재생(파일 저장 후 확인)

## 핵심 결과 요약
- **연결/세션 설정 성공** (`setupComplete` 확인)
- **마이크 입력 전사(Input Transcription) 정상**
- **모델 응답 텍스트 정상**
- **오디오 출력 정상 (PCM 저장 후 WAV 변환 시 재생 확인)**
- **실시간 재생(--play) 경로는 환경 의존 이슈 가능**
  - 파일 저장 후 재생 방식으로는 정상 확인

## 실행 명령 (PowerShell)

### 1) 파일 입력 테스트 (PCM 저장 후 재생)
```powershell
# 6초 마이크 캡처 -> PCM 저장
node .\test-gemini-live.mjs --mode audio --audio-out .\output.pcm --mic-cmd 'ffmpeg -f dshow -i audio="@device_cm_{33D9A762-90C8-11D0-BD43-00A0C911CE86}\wave_{6D035DDB-BF05-444F-BBF8-9CE1AB05A9CF}" -t 6 -f s16le -ac 1 -ar 16000 -'

# PCM -> WAV 변환 후 재생
ffmpeg -f s16le -ar 24000 -ac 1 -i .\output.pcm .\output.wav
start .\output.wav
```

### 2) 마이크 스트리밍 입력 (실시간)
```powershell
node .\test-gemini-live.mjs --mode audio --mic-cmd 'ffmpeg -f dshow -i audio="@device_cm_{33D9A762-90C8-11D0-BD43-00A0C911CE86}\wave_{6D035DDB-BF05-444F-BBF8-9CE1AB05A9CF}" -f s16le -ac 1 -ar 16000 -'
```

## 관찰 사항
- 마이크 입력은 44.1kHz stereo에서 16kHz mono로 변환하여 전송.
- 응답 오디오는 24kHz PCM으로 수신됨.
- 스트리밍 모드에서 `--play` 실시간 재생은 환경(플레이어/파이프) 의존으로 실패 가능.

## 결론
- Gemini Live의 **음성 입력/출력 파이프라인은 기술적으로 정상 동작** 확인.
- 제품 구현 단계에서는 **브라우저 AudioContext 재생**으로 이슈를 우회 가능.

## 다음 단계
- 코드베이스에 Live 세션 핸들러 훅 구현
- AI 파트너 세션 플로우 연결 (세션 생성 -> live 화면 -> transcript 저장 -> 분석)
- 오류 처리/재시도/토큰 재발급 전략 설계
