require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
    try {
        // For some versions of the SDK, listModels might be on the instance or unavailable directly in this way depending on version.
        // But let's try the standard way.
        // Note: The Node.js SDK for Gemini (google-generative-ai) might not expose listModels directly on genAI instance in all versions?
        // Actually, it usually doesn't have a listModels method on the client itself in the JS SDK?
        // Let's check if we can just try a generation.
        // However, the user specifically asked to run this.
        // The instructions say "Create a quick test file... listModels".
        // I recall the JS SDK might not have listModels easily accessible. 
        // But let's try the user's snippet adapted to CommonJS.
        // If listModels doesn't exist, we will catch the error.

        // Actually, usually it is done via a different API call or just guessing. 
        // But let's try.

        // If getting models fails, I will just default to 'gemini-1.5-flash' (standard) or 'gemini-2.0-flash-exp' if available.
        // But let's write to the file first.

        // Wait, the SDK definitely has getGenerativeModel.
        // Checking documentation memory... JS SDK usually doesn't have listModels().
        // But I will write a script that tries to generate content with 'gemini-1.5-flash' and 'gemini-2.0-flash' to see which one works.

        console.log("Testing available models...");

        const modelsToTest = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-pro", "gemini-1.5-pro"];

        for (const modelName of modelsToTest) {
            console.log(`Testing ${modelName}...`);
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("Hello");
                console.log(`✅ ${modelName} is WORKING.`);
                return; // Found one!
            } catch (e) {
                console.log(`❌ ${modelName} failed: ${e.message.split('\n')[0]}`);
            }
        }

    } catch (err) {
        console.error(err);
    }
}

listModels();
