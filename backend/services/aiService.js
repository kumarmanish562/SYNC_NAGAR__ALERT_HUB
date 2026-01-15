const { VertexAI } = require('@google-cloud/vertexai');
require('dotenv').config();

// Initialize Vertex AI
const vertex_ai = new VertexAI({
    project: process.env.GCP_PROJECT_ID,
    location: process.env.GCP_LOCATION || 'us-central1'
});

// Use the stable model version requested
const model = 'gemini-1.5-flash-001';

// Instantiate the model
const generativeModel = vertex_ai.getGenerativeModel({
    model: model,
    generationConfig: {
        maxOutputTokens: 256,
        temperature: 0.2, // Low temperature for strict/analytical results
        responseMimeType: 'application/json',
    },
});

/**
 * Analyzes an image (Base64) using Vertex AI.
 * @param {string} base64Image - The raw base64 string of the image
 */
exports.analyzeImageForReport = async (base64Image) => {
    try {
        console.log(`[Vertex AI] Analyzing image (Base64)...`);

        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: 'image/jpeg'
            }
        };

        const prompt = `
        You are a strict city administration AI. Analyze this image.
        1. REALISM: Is this a real photo of a civic issue (pothole, garbage, etc.)?
        2. FAKE CHECK: Reject if it's AI-generated, a screenshot, or a black screen.
        
        Output JSON ONLY:
        {
            "isReal": boolean, 
            "fakeReason": "reason if fake, else null", 
            "issue": "Short description of the issue or null",
            "priority": "High/Medium/Low",
            "confidence": number,
            "category": "Road/Garbage/Water/Electricity/Other"
        }`;

        const request = {
            contents: [{ role: 'user', parts: [imagePart, { text: prompt }] }]
        };

        const result = await generativeModel.generateContent(request);
        const response = result.response;
        let text = response.candidates[0].content.parts[0].text;

        // Clean up markdown if present
        text = text.replace(/```json|```/g, '').trim();
        const jsonResult = JSON.parse(text);

        return {
            isReal: jsonResult.isReal || jsonResult.isValid,
            fakeReason: jsonResult.fakeReason || (jsonResult.isValid ? null : "Verification failed"),
            issue: jsonResult.issue || jsonResult.category,
            severity: jsonResult.priority || "Medium"
        };

    } catch (error) {
        console.error("Vertex AI Connection Failed:", error.message);

        if (error.message.includes('404')) {
            console.error("⚠️ CRITICAL ERROR: 'Gemini 1.5 Flash' not enabled in Vertex AI Model Garden.");
            // Fallback for dev testing if model is locked
            return { isReal: false, fakeReason: "System Error: AI Model Not Enabled in Cloud Console" };
        }

        return { isReal: false, fakeReason: "System Error during verification" };
    }
};
