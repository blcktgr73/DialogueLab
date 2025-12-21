# MITI 4.2 기반 대화 평가 및 연습 카드 설계 (Draft)

## 1. 개요 (Overview)
본 문서는 동기면담 치료 진실성 척도(MITI 4.2.1)를 기반으로 AI가 대화 세션을 평가하고, 이를 바탕으로 개선을 위한 '연습 카드'를 생성하는 기능의 설계서입니다.
사용자의 요청에 따라 **양방향 평가(Interviewer/Client)**와 **대안 제시(Practice Card)**에 초점을 맞춥니다.

## 2. MITI 4.2 평가 기준 (Evaluation Criteria)

MITI 4.2는 크게 **전반적 척도(Global Ratings)**와 **행동 코드(Behavior Counts)**로 나뉩니다.

### A. 전반적 척도 (Global Ratings) - 1~5점 (Likert Scale)
AI는 전체 대화 맥락을 기반으로 다음 4가지 항목을 1(낮음) ~ 5(높음)점으로 평가합니다.

1.  **관련성 형성 (Cultivating Change Talk)**
    *   내담자의 변화 대화(Change Talk)를 잘 이끌어내고 강화하는가?
2.  **저항 완화 (Softening Sustain Talk)**
    *   내담자의 현상 유지 대화(Sustain Talk)나 저항을 부드럽게 완화하는가?
3.  **동반자 관계 (Partnership)**
    *   권위적이거나 지시적이지 않고, 협력적인 태도를 유지하는가?
4.  **공감 (Empathy)**
    *   내담자의 관점을 깊이 있게 이해하고 노력하는가?

### B. 행동 코드 (Behavior Counts) - 빈도 분석
각 발화(Turn)마다 다음 코드를 부여하고 빈도를 셉니다.

1.  **질문 (Questions)**
    *   `Q-Closed` (폐쇄형 질문): 예/아니오 단답형.
    *   `Q-Open` (개방형 질문): 서술형 답변 유도.
2.  **반영 (Reflections)**
    *   `RES` (단순 반영): 내용을 그대로 반복하거나 약간만 바꿈.
    *   `REC` (복합 반영): 감정이나 숨은 뜻을 깊이 있게 파악하여 말함.
3.  **MI 일치 행동 (MI Adherent)**
    *   `Seek` (협력 구하기), `Affirm` (인정/칭찬), `Auto` (자율성지지).
4.  **MI 불일치 행동 (MI Non-Adherent)**
    *   `Persuade` (설득/지시), `Confront` (직면/논쟁).
5.  **정보 제공 (Giving Information)**
    *   `GI`: 일반적인 정보나 피드백 제공.

---

## 3. 화자별 평가 전략 (Symmetric Evaluation)

사용자의 요청에 따라, **모든 화자(Speaker A, Speaker B)**에 대해 **두 가지 관점(상담자, 내담자)을 모두 적용**하여 평가합니다.
이는 역할극(Role Play)에서 도중에 역할이 바뀌거나, 서로 상담 연습을 주고받는 상황을 완벽하게 지원합니다.

### 평가 매트릭스 (Evaluation Matrix)

AI는 각 화자의 발화를 독립적으로 분석하여 다음 두 가지 Report를 모두 생성합니다.

#### A. 상담자 관점 평가 (Interviewer Capability)
*   **대상**: 해당 화자가 '상담자'로서 수행한 발언들.
*   **지표**:
    *   MITI Global Score (공감, 파트너십 등).
    *   MITI Behavior Counts (열린 질문, 반영, 인정 등).
    *   *잘한 점*: 전문적인 상담 기술 사용 빈도.
    *   *아쉬운 점*: 지시/설득(Non-Adherent) 사용 빈도.

#### B. 내담자 관점 평가 (Client Change Process)
*   **대상**: 해당 화자가 '내담자'로서 보여준 반응들.
*   **지표**:
    *   **Change Talk (변화 대화)**: 긍정적인 변화 의지를 보인 횟수.
    *   **Sustain Talk (유지 대화)**: 현 상태에 머무르려는 저항 발언 횟수.
    *   **Self-Disclosure (자기 개방)**: 솔직하게 자신의 이야기를 꺼낸 정도.

### 기대 효과
*   결과 화면에서 **"누가 상담자였는가?"를 선택할 필요가 없습니다.**
*   두 사람의 그래프를 나란히 비교하여, "A는 공감이 뛰어났고, B는 변화 의지가 높았다"는 식의 입체적 분석이 가능합니다.

---

## 4. 연습 카드 (Practice Cards)

평가 결과 중 점수가 낮거나 아쉬운 대목(Missed Opportunities)을 포착하여 **3~5개의 연습 카드**를 생성합니다.

### 카드 구성 요소
1.  **상황 (Context)**: 직전 대화 맥락 (내담자의 말).
2.  **나의 말 (Actual)**: 사용자가 실제로 했던 말.
3.  **MITI 진단 (Critique)**: 무엇이 아쉬운가? (예: "단순 폐쇄형 질문을 사용하여 대화 확장이 끊김", "설득(Persuade)을 시도하여 저항을 유발함")
4.  **더 나은 대안 (Better Alternative)**: MITI 원칙에 부합하는 모범 답안.
5.  **의도 (Rationale)**: 이 대안이 왜 좋은가? (예: "복합 반영을 통해 상대방의 감정을 읽어줌")

### 생성 로직 (Algorithm)
1.  **MI 불일치(MIN) 우선 포착**: `Persuade`, `Confront` 코드가 붙은 발화는 최우선적으로 교정.
2.  **질문 개선**: 연속된 `closed question`을 `open question`이나 `reflection`으로 변환 제안.
3.  **반영 심화**: `simple reflection`을 `complex reflection`으로 업그레이드 제안.

### 제공 수량 (Format)
*   **제안 수량**: 세션 당 **3개 (핵심 개선점)**. 너무 많으면 학습 부담.
*   **UI**: 카드 슬라이드 형태. 앞면(상황+나의말) -> 뒤집기 -> 뒷면(진단+대안).

---

## 5. 데이터 구조 (Proposed Schema)

`analysis_miti` 테이블 신설 또는 기존 `analysis_results`의 JSON 확장.

```json
{
  "global_scores": {
    "cultivating_change_talk": 3,
    "softening_sustain_talk": 4,
    "partnership": 4,
    "empathy": 2
  },
  "behavior_counts": {
    "question_open": 5,
    "question_closed": 10,
    "reflexion_simple": 3,
    "reflexion_complex": 1,
    "mi_adherent": 2,
    "mi_non_adherent": 4
  },
  "practice_cards": [
    {
      "trigger_text": "그건 시간이 없어서 못 해요.",
      "actual_response": "시간은 만드셔야죠.",
      "diagnosis": "MI Non-Adherent (Persuade/Confront). 내담자의 저항을 높였습니다.",
      "better_response": "지금 상황에서는 따로 시간을 내기가 참 막 막하게 느껴지시는군요.",
      "rationale": "Complex Reflection (Emotion). 상대의 어려움에 먼저 공감해주었습니다."
    }
  ]
}
```
