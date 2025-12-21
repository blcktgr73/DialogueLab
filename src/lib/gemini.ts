import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_GEMINI_API_KEY!;
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
export async function generateAnalysis(
    transcripts: TranscriptEntry[],
    lensType: string
): Promise<any> {

    // 1. Prepare Prompt
    const transcriptText = transcripts
        .map((t) => `${t.speaker}: ${t.content}`)
        .join("\n");

    const prompt = `
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
