import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';

// Load env vars
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("Error: GEMINI_API_KEY not found in .env.local");
    process.exit(1);
}

const fileManager = new GoogleAIFileManager(apiKey);
const genAI = new GoogleGenerativeAI(apiKey);

async function main() {
    // 1. Upload File
    const filename = process.argv[2] || "scripts/recordings04.wav"; // Use WAV for best quality or use mimetype correctly
    console.log(`Target File: ${filename}`);

    // Detect mime
    let mimeType = "audio/wav";
    if (filename.endsWith(".webm")) mimeType = "audio/webm";
    if (filename.endsWith(".flac")) mimeType = "audio/flac";
    if (filename.endsWith(".m4a")) mimeType = "audio/m4a";

    console.log(`Uploading ${filename} to Gemini File API...`);

    try {
        const uploadResult = await fileManager.uploadFile(filename, {
            mimeType: mimeType,
            displayName: path.basename(filename),
        });

        const fileUri = uploadResult.file.uri;
        console.log(`Uploaded File URI: ${fileUri}`);

        // Wait for file state to be active
        console.log("Waiting for file processing...");
        let fileState = "PROCESSING";
        while (fileState === "PROCESSING") {
            const fileStatus = await fileManager.getFile(uploadResult.file.name);
            fileState = fileStatus.state;
            if (fileState === "FAILED") {
                throw new Error("File processing failed.");
            }
            if (fileState !== "ACTIVE") {
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        console.log("File is ACTIVE.");

        // 2. Generate Content
        // Using 'gemini-1.5-flash' (or pro) which is multimodal and good at audio
        const modelName = "gemini-1.5-flash";
        console.log(`Generating transcript with ${modelName}...`);

        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([
            "Listen to this audio specifically for speaker diarization. Transcribe the conversation, strictly identifying speakers as 'Speaker 1', 'Speaker 2', etc. Format the output as: '[Speaker X]: Text'. If you can detect gender or nuance, you can add it in parentheses initially.",
            {
                fileData: {
                    fileUri: fileUri,
                    mimeType: mimeType,
                },
            },
        ]);

        console.log("\n--- Gemini 1.5 Flash Output ---");
        console.log(result.response.text());

        // Cleanup? Only if needed (File API files expire automatically after 48h usually)

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
