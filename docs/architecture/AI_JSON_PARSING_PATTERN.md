# AI JSON 응답 파싱 패턴 (Robust JSON Parsing Pattern)

## 📋 개요

AI 서비스(Gemini, OpenAI 등)의 JSON 응답을 안정적으로 파싱하기 위한 표준 패턴입니다.
AI가 생성하는 JSON은 다음과 같은 문제가 발생할 수 있습니다:

- **Malformed JSON**: 후행 쉼표, 누락된 쉼표, 잘못된 문법
- **Truncated Response**: 토큰 제한으로 인한 응답 잘림
- **Unbalanced Brackets**: 여는 괄호와 닫는 괄호 불일치
- **Markdown Wrapper**: JSON 코드 블록(`\`\`\`json`) 내부에 포함

## 🎯 설계 원칙

1. **자동 복구 우선**: 가능한 한 자동으로 복구 시도
2. **상세한 로깅**: 에러 발생 시 디버깅에 필요한 모든 정보 출력
3. **점진적 Fallback**: 기본 파싱 → 자동 복구 → 명시적 에러
4. **일관성**: 모든 Phase 서비스에서 동일한 패턴 사용

## 📦 구현 위치

다음 파일들에 `parseJson()` 메서드로 구현되어 있습니다:

- ✅ [lib/services/ai/phase5Service.ts](../../lib/services/ai/phase5Service.ts) - Line 222-325

## 🤖 Gemini API Abstraction

`lib/services/ai/geminiClient.ts`에 정의된 `GeminiClient` 클래스는 Google Generative AI SDK의 래퍼(Wrapper)로서, 애플리케이션 전반에서 AI 통신을 담당합니다.

### 주요 기능

1. **Singleton Pattern**: `getGeminiClient()`를 통해 애플리케이션 전체에서 단일 클라이언트 인스턴스를 효율적으로 재사용합니다.
2. **Automatic Retries**: 일시적인 API 오류에 대비하여 지수 백오프(Exponential Backoff)를 포함한 자동 재시도 로직이 내장되어 있습니다.
3. **Configuration**: API Key 관리 및 모델 설정을 중앙화합니다.

### 메서드 비교 및 권장 사항

| 메서드 | 용도 | 특징 | 권장 시나리오 |
|---|---|---|---|
| `generateContent` | 기본 텍스트 생성 | Raw 텍스트(String)를 반환합니다. 에러 복구 로직이 없습니다. | **권장**: 이 문서의 **Robust Parsing 패턴**과 조합하여 사용 |
| `generateJSON` | 간단한 JSON 생성 | 내부적으로 `JSON.parse`만 수행합니다. 복잡한 오류 복구 기능이 없습니다. | 단순한 구조의 JSON이나 신뢰도가 매우 높은 태스크에만 제한적 사용 |

### Layered Architecture 패턴

안정성을 극대화하기 위해 다음과 같은 계층적 접근을 사용합니다:

1. **Transport Layer (`GeminiClient`)**: `generateContent()`를 사용하여 AI로부터 Raw String 응답을 수신하는 역할에만 집중합니다.
1. **Transport Layer (`GeminiClient`)**: `generateContent()`를 사용하여 AI로부터 Raw String 응답을 수신하는 역할에만 집중합니다.
2. **Service Layer (`PhaseServices`)**: 수신된 Raw String을 `parseJson()` 메서드를 통해 파싱하고, 필요 시 자동 복구(Repair)를 수행합니다.

## 🔎 모델 가용성 확인 (Model Availability Check)

AI 모델의 이름이나 버전은 자주 변경될 수 있습니다 (e.g., `gemini-1.5-flash` -> `gemini-1.5-flash-001`).
따라서 개발 환경이나 배포 초기 단계에서 사용 가능한 모델을 확인하는 절차가 필요합니다.

### 추천 확인 스크립트 (REST API)

구글 SDK 버전 이슈를 피하기 위해 REST API를 직접 호출하여 확인하는 것이 가장 정확합니다.

```javascript
const https = require('https');
const apiKey = process.env.API_KEY; // .env에서 로드

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const available = json.models
      .filter(m => m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace('models/', ''));
      
    console.log("Available Models:", available);
  });
});
```

## 🔧 사용 방법

### 1. Gemini Client 초기화 및 호출

```typescript
import { getGeminiClient } from './geminiClient';

export class YourPhaseService {
    // 1. Singleton Client 획득
    private client = getGeminiClient();

    /**
     * Robust JSON parser with automatic repair for malformed AI responses
     * Based on Phase 3 implementation
     */
    private parseJson(response: string, context?: string): any {
    const prefix = context ? `[YourService:${context}]` : '[YourService]';
    console.log(`${prefix} parseJson raw response length:`, response.length);
    console.log(`${prefix} parseJson raw response (first 500):`, response.substring(0, 500));

    // 1. JSON 추출: markdown 코드 블록 또는 raw JSON
    let jsonText = response;
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
        jsonText = jsonMatch[1];
    } else {
        const jsonObjectMatch = response.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
            jsonText = jsonObjectMatch[0];
        }
    }

    // 2. 기본 파싱 시도
    try {
        return JSON.parse(jsonText);
    } catch (parseError) {
        console.error(`${prefix} Failed to parse AI response:`, parseError);
        console.error(`${prefix} JSON text length:`, jsonText.length);

        // 에러 위치 컨텍스트 출력
        const errorMatch = parseError instanceof Error && parseError.message.match(/position (\d+)/);
        if (errorMatch) {
            const errorPos = parseInt(errorMatch[1]);
            const start = Math.max(0, errorPos - 200);
            const end = Math.min(jsonText.length, errorPos + 200);
            console.error('Context:', jsonText.substring(start, end));
        }

        // 3. 자동 복구 시도
        console.log(`${prefix} Attempting to repair JSON...`);
        let repairedJson = jsonText
            .replace(/,\s*}/g, '}')      // 후행 쉼표 제거
            .replace(/,\s*]/g, ']')      // 후행 쉼표 제거
            .replace(/}\s*{/g, '},{')    // 누락된 쉼표 추가
            .replace(/"\s*\n\s*"/g, '",\n"'); // 문자열 간 쉼표 추가

        // 4. 잘린 응답 처리
        const openBraces = (repairedJson.match(/{/g) || []).length;
        const closeBraces = (repairedJson.match(/}/g) || []).length;
        const openBrackets = (repairedJson.match(/\[/g) || []).length;
        const closeBrackets = (repairedJson.match(/]/g) || []).length;

        if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
            console.log(`${prefix} Detected truncated JSON response`);
            console.log(`Braces: ${openBraces} open, ${closeBraces} close`);
            console.log(`Brackets: ${openBrackets} open, ${closeBrackets} close`);

            // 후행 쉼표 제거
            if (repairedJson.trim().endsWith(',')) {
                repairedJson = repairedJson.trim().slice(0, -1);
            }

            // 누락된 닫는 괄호 추가
            for (let i = 0; i < openBrackets - closeBrackets; i++) {
                repairedJson += ']';
            }
            for (let i = 0; i < openBraces - closeBraces; i++) {
                repairedJson += '}';
            }
        }

        // 5. 복구된 JSON 파싱 시도
        try {
            const repairedParsed = JSON.parse(repairedJson);
            console.log(`${prefix} JSON repair successful!`);
            return repairedParsed;
        } catch (repairError) {
            console.error(`${prefix} JSON repair failed:`, repairError);
            console.error(`${prefix} Showing first 1000 chars of failed JSON:`);
            console.error(repairedJson.substring(0, 1000));
            throw new Error(`Invalid JSON response from AI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }
    }
}
```

### 2. 호출 방법

```typescript
// AI 응답 받기
const response = await this.client.generateContent(prompt, { temperature: 0.7 });

// Robust parsing 적용
const parsed = this.parseJson(response, 'methodName'); // context는 선택사항
```

## 🧪 테스트 케이스

### 정상 케이스
```json
{
  "result": "success",
  "data": [1, 2, 3]
}
```

### 복구 가능 케이스

#### 1. 후행 쉼표
```json
{
  "result": "success",
  "data": [1, 2, 3,]
}
```
→ 자동 복구: `]` 앞의 `,` 제거

#### 2. 누락된 쉼표
```json
{
  "result": "success"
  "data": [1, 2, 3]
}
```
→ 자동 복구: `"success"` 뒤에 `,` 추가

#### 3. 잘린 응답
```json
{
  "result": "success",
  "data": [1, 2, 3
```
→ 자동 복구: `]}`를 추가하여 완성

## ⚠️ 제약사항

1. **복구 불가능한 케이스**: 심각하게 손상된 JSON(예: 중간에 임의의 텍스트 삽입)은 복구 불가
2. **의미 보존**: 자동 복구가 항상 의도한 의미를 보존한다고 보장할 수 없음
3. **성능**: 복구 과정에서 추가적인 정규식 처리로 약간의 성능 오버헤드 발생

## 📝 향후 개선 사항

1. **공통 유틸리티 함수**: 중복 코드를 공통 모듈로 추출
2. **Phase별 커스터마이징**: 각 Phase의 JSON 구조에 특화된 복구 로직 추가
3. **통계 수집**: 복구 성공률, 실패 패턴 등을 모니터링
4. **AI 프롬프트 개선**: JSON 생성 품질 향상을 위한 프롬프트 엔지니어링

## 🔗 관련 문서

- [Phase 3 Implementation](../specs/PHASE3_IMPLEMENTATION.md)
- [Phase 5 Implementation](../specs/PHASE5_IMPLEMENTATION.md)
- [Database Schema](./DATABASE_SCHEMA.md)

---

**마지막 업데이트**: 2025-12-03
**작성자**: Claude Code
**버전**: 1.0.0
