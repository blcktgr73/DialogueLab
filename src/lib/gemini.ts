import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY (or NEXT_PUBLIC_GEMINI_API_KEY) must be set for server-side operations.");
}
const genAI = new GoogleGenerativeAI(apiKey);

// Singleton-like (Next.js serverless nature handles this reasonably)
export const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export type TranscriptEntry = {
  speaker: string;
  content: string;
  timestamp?: string;
};

/**
 * Robust JSON parser with automatic repair setup.
 * Based on docs/architecture/AI_JSON_PARSING_PATTERN.md
 */
// MITI 4.2 based Symmetric Evaluation Prompt
const MITI_PROMPT = `
You are a highly trained expert in Motivational Interviewing (MITI 4.2.1).
Analyze the dialogue symmetrically for ALL speakers found.

For EACH unique speaker, provide two evaluations:
1. "Interviewer Role": As if they were the counselor. Assess Global Scores (1-5) and Behavior Counts.
2. "Client Role": As if they were the client. Assess Change Talk, Sustain Talk, and Self-Disclosure.

RETURN FORMAT: JSON ONLY.
{
  "speakers": {
    "SpeakerName1": {
      "role_interviewer": {
        "global_scores": {
          "cultivating_change_talk": 1-5,
          "softening_sustain_talk": 1-5,
          "partnership": 1-5,
          "empathy": 1-5
        },
        "behavior_counts": {
          "question_open": number,
          "question_closed": number,
          "reflection_simple": number,
          "reflection_complex": number,
          "mi_adherent": number,
          "mi_non_adherent": number
        },
        "strength": "What they did well as a counselor",
        "weakness": "What they missed"
      },
      "role_client": {
        "change_talk_count": number,
        "sustain_talk_count": number,
        "self_disclosure_rating": 1-5,
        "primary_motivation": "Brief description of their change motivation"
      }
    },
    "SpeakerName2": { ... }
  },
  "practice_cards": [
    {
      "context": "Previous line of dialogue (context)",
      "actual_response": "What the user actually said (SpeakerName1 or 2)",
      "speaker_name": "Who said it",
      "critique": "Why this was not ideal (e.g. Persuasion, Closed Question)",
      "better_alternative": "A better MI-consistent response",
      "rationale": "Why the alternative is better (e.g. Complex Reflection)"
    }
    // Limit to 3 most critical missed opportunities
  ]
}

IMPORTANT:
- Respond in KOREAN.
- Strict JSON format. No markdown code blocks if possible, or inside \`\`\`json.
`;

export async function generateAnalysis(
  transcripts: TranscriptEntry[],
  lensType: string
): Promise<any> {

  // 1. Prepare Prompt
  const transcriptText = transcripts
    .map((t) => `${t.speaker}: ${t.content}`)
    .join("\n");

  let prompt = "";

  if (lensType === 'miti') {
    prompt = `
        ${MITI_PROMPT}

        DIALOGUE TO ANALYZE:
        ${transcriptText}
        `;
  } else {
    // Standard Lens Prompt
    prompt = `
        Analyze the following dialogue through the lens of "${lensType}".
        
        DIALOGUE:
        ${transcriptText}
        
        INSTRUCTIONS:
        - **Respond in KOREAN (한국어로 응답하세요).**
        - Return ONLY valid JSON.
        - Analyze the interaction dynamics, not just the content.
        - Provide 3 key points of reflection.
        
        JSON FORMAT:
        {
          "summary": "Brief summary of the interaction",
          "key_points": [
            { "title": "Point 1", "description": "Details..." },
            { "title": "Point 2", "description": "Details..." },
            { "title": "Point 3", "description": "Details..." }
          ],
          "sentiment": "positive | neutral | negative",
          "reflection_question": "A question for the user to think about"
        }
      `;
  }

  // 2. Call Gemini
  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  console.log(`[Gemini] Raw response length: ${text.length}`);

  // 3. Robust JSON Parsing
  return parseJson(text, `Lens-${lensType}`);
}

function parseJson(response: string, context?: string): any {
  const prefix = context ? `[${context}]` : '[GeminiParser]';

  // 1. Extract JSON block (Markdown or Raw)
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

  // 2. Basic Parse Attempt
  try {
    return JSON.parse(jsonText);
  } catch (parseError: any) {
    console.warn(`${prefix} Direct parse failed, attempting repair... (${parseError.message})`);

    // 3. Auto-Repair logic (Simple heuristic based on pattern)
    let repairedJson = jsonText
      .replace(/,\s*}/g, '}')      // Remove trailing comma
      .replace(/,\s*]/g, ']')      // Remove trailing comma
      .replace(/}\s*{/g, '},{')    // Add missing comma between objects
      .replace(/"\s*\n\s*"/g, '",\n"'); // Add missing comma between strings

    // 4. Try parsing repaired JSON
    try {
      return JSON.parse(repairedJson);
    } catch (repairError) {
      console.error(`${prefix} JSON repair failed.`);
      console.error(`${prefix} Failed JSON Raw:`, jsonText);
      throw new Error(`AI response is not valid JSON: ${parseError.message}`);
    }
  }
}
