const { VertexAI } = require('@google-cloud/vertexai');
require('dotenv').config();

// Initialize Vertex AI
const vertex_ai = new VertexAI({
    project: process.env.GCP_PROJECT_ID,
    location: 'us-central1'
});

// Using Gemini 2.0 Flash for maximum speed and multimodal capabilities
const modelName = 'gemini-2.0-flash-001';

console.log(`🚀 Speed Mode: Vertex AI using '${modelName}'`);

const generativeModel = vertex_ai.getGenerativeModel({
    model: modelName,
    generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.4,
        responseMimeType: 'application/json',
    },
});

/**
 * Generic Multimodal Analyzer (Image, Video, Audio)
 * @param {string} base64Data - Base64 string of the media
 * @param {string} mimeType - Mime type (image/jpeg, video/mp4, audio/ogg, etc.)
 */
exports.analyzeMedia = async (base64Data, mimeType) => {
    try {
        console.log(`[Vertex AI] Analyzing media (${mimeType})...`);

        const mediaPart = {
            inlineData: {
                data: base64Data,
                mimeType: mimeType
            }
        };

        const prompt = `
        You are a strict city administration AI. Analyze this input (Image/Video/Audio).
        
        1. VALIDITY CHECK: Is this a genuine report of a civic issue (pothole, garbage, noise, etc.)?
           - For Audio: Transcribe and verify the complaint.
           - For Video: Analyze visual content for civic issues.
           - For Image: Detect civic defects.
        2. FAKE/SPAM CHECK: Reject if it's AI-generated, spam, random selfie, music, or unrelated.
        
        Output JSON ONLY:
        {
            "isReal": boolean, 
            "fakeReason": "Reason if rejected, else null", 
            "issue": "Short title of the issue",
            "description": " Detailed description of what is seen/heard",
            "priority": "High/Medium/Low",
            "confidence": number (0-100),
            "category": "Road/Garbage/Water/Electricity/Noise/Traffic/Other"
        }`;

        const request = {
            contents: [{ role: 'user', parts: [mediaPart, { text: prompt }] }]
        };

        const result = await generativeModel.generateContent(request);
        const response = result.response;
        return parseGeminiResponse(response);

    } catch (error) {
        console.error("Vertex AI Media Analysis Failed:", error.message);
        return { isReal: false, fakeReason: "AI Service Error" };
    }
};

/**
 * Text Analyzer for WhatsApp Messages
 * @param {string} text - The user's text message
 */
exports.analyzeText = async (text) => {
    try {
        console.log(`[Vertex AI] Analyzing text: "${text.substring(0, 50)}..."`);

        const prompt = `
        You are a city administration AI. Analyze this text complaint.
        Text: "${text}"

        1. Is this a valid civic complaint (e.g. "garbage on street", "no water")?
        2. Or is it just a greeting/spam (e.g. "Hi", "Hello", "How are you")?

        Output JSON ONLY:
        {
            "isReal": boolean, 
            "fakeReason": "Reason if rejected/spam, else null", 
            "issue": "Short title",
            "description": "Cleaned up description",
            "priority": "High/Medium/Low",
            "confidence": number (0-100),
            "category": "Road/Garbage/Water/Electricity/Noise/Traffic/Other"
        }`;

        const request = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        };

        const result = await generativeModel.generateContent(request);
        const response = result.response;
        return parseGeminiResponse(response);

    } catch (error) {
        console.error("Vertex AI Text Analysis Failed:", error.message);
        return { isReal: false, fakeReason: "AI Text Service Error" };
    }
};

// Wrapper for backward compatibility
exports.analyzeImageForReport = async (base64Image) => {
    return exports.analyzeMedia(base64Image, 'image/jpeg');
};

// Helper to reliably parse JSON from Gemini
function parseGeminiResponse(response) {
    try {
        let text = response.candidates[0].content.parts[0].text;
        text = text.replace(/```json|```/g, '').trim();
        const jsonResult = JSON.parse(text);

        return {
            isReal: jsonResult.isReal || jsonResult.isValid,
            fakeReason: jsonResult.fakeReason || (jsonResult.isValid ? null : "Verification failed"),
            issue: jsonResult.issue || jsonResult.category || "General Issue",
            explanation: jsonResult.description || jsonResult.issue, // Map description to explanation logic
            description: jsonResult.description,
            severity: jsonResult.priority || "Medium",
            priority: jsonResult.priority || "Medium",
            category: jsonResult.category || "General",
            confidence: jsonResult.confidence || 80
        };
    } catch (e) {
        console.error("JSON Parse Error:", e);
        return { isReal: false, fakeReason: "Invalid AI Response Format" };
    }
}
