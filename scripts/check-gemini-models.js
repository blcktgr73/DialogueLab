const https = require('https');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

if (!apiKey) {
    console.error("No API Key found in .env.local");
    process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

console.log(`Fetching models from: ${url.replace(apiKey, 'HIDDEN_KEY')}...`);

https.get(url, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            if (res.statusCode !== 200) {
                console.error(`Error: Status Code ${res.statusCode}`);
                console.error(data);
                return;
            }

            const json = JSON.parse(data);
            if (!json.models) {
                console.log("No models found or different structure:", json);
                return;
            }

            console.log("\n✅ Available Models for generateContent:");
            const generateModels = json.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));

            generateModels.forEach(m => {
                console.log(`- ${m.name.replace('models/', '')}`);
                console.log(`  Description: ${m.displayName}`);
            });

            if (generateModels.length === 0) {
                console.warn("\n⚠️ No models support 'generateContent'. Check your API key permissions.");
            }

        } catch (e) {
            console.error("Failed to parse response:", e.message);
        }
    });

}).on("error", (err) => {
    console.error("Error: " + err.message);
});
