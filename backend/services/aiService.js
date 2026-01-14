require('dotenv').config(); // Ensure env vars are loaded
// 1. Import the library
const { VertexAI } = require('@google-cloud/vertexai');

// 2. Setup Configuration
// Tip: Put these in your .env file!
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = 'us-central1';

// 3. Initialize Vertex AI
const vertex_ai = new VertexAI({
    project: PROJECT_ID,
    location: LOCATION,
    // The SDK automatically looks for "GOOGLE_APPLICATION_CREDENTIALS" env variable
    // pointing to your serviceAccountKey.json
});

// 4. Create the Model Reference (Gemini Pro)
const model = vertex_ai.preview.getGenerativeModel({
    model: 'gemini-pro' // or 'gemini-1.5-flash' for faster/cheaper results
});

// Function to Test it
async function generateContent() {
    try {
        const prompt = "Write a short safety warning for a reported pothole.";

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.candidates[0].content.parts[0].text;

        console.log("🤖 AI Response:", text);
    } catch (error) {
        console.error("AI Error:", error);
    }
}

// Run the test
if (require.main === module) {
    generateContent();
}

module.exports = { generateContent, model };
