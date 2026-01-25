const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require("path");
const dotenv = require("dotenv");

// Load env vars
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("Error: GEMINI_API_KEY not found in .env.local");
    process.exit(1);
}

async function main() {
    // The user identified this model name from the list
    // Note: The list API usually returns 'models/model-name', so we might need to strip 'models/' 
    // or the SDK handles it. SDK usually accepts 'gemini-pro' or 'models/gemini-pro'.
    // Let's try the exact string found first, or the clean name.
    // Usually 'gemini-3-flash-preview' is sufficient if 'models/' prefix is provided.
    // We'll use the safe approach of passing the name cleanly if the SDK expects it, 
    // but the list returns 'models/...'. 
    // Let's stick to the name the user saw but stripped or full. 
    // SDK `getGenerativeModel({ model: 'name' })` handles variants often.
    const modelName = "gemini-3-flash-preview";

    console.log(`Testing Gemini API with model: ${modelName}...`);

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });

        const prompt = "Hello Gemini 3.0! Please respond with a short verification message confirming your version or capability.";
        console.log(`Prompt: "${prompt}"`);
        console.log("Generating response...");

        const startTime = Date.now();
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const duration = Date.now() - startTime;

        console.log("\nResponse:");
        console.log("----------------------------------------");
        console.log(text);
        console.log("----------------------------------------");
        console.log(`\nSuccess! Generation took ${duration}ms`);

    } catch (error) {
        console.error("\nError testing Gemini API:");
        console.error(error); // Log full error object for clarity
        process.exit(1);
    }
}

main();
