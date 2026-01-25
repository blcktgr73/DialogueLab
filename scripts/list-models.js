const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require("path");
const fs = require("fs");

// Simple manual env parser to avoid package noise
try {
    const envPath = path.resolve(__dirname, "..", ".env.local");
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const match = line.trim().match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                let value = match[2].trim();
                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                process.env[key] = value;
            }
        });
    }
} catch (e) {
    // Ignore error
}

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

if (!apiKey) {
    fs.writeFileSync("models_output.json", JSON.stringify({ error: "API Key not found" }));
    process.exit(1);
}

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        fs.writeFileSync("models_output.json", JSON.stringify(data, null, 2));

    } catch (error) {
        fs.writeFileSync("models_output.json", JSON.stringify({ error: error.message }));
    }
}

listModels();
