require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

// Initialize Gemini
// Ensure we use the API key from env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Fetches an image from a URL and converts it to a base64 string and mimeType.
 */
async function fetchImageAsBase64(url) {
    try {
        const config = { responseType: 'arraybuffer' };
        if (process.env.WHAPI_TOKEN) {
            config.headers = { Authorization: `Bearer ${process.env.WHAPI_TOKEN}` };
        }

        const response = await axios.get(url, config);
        const buffer = Buffer.from(response.data, 'binary');
        const mimeType = response.headers['content-type'] || 'image/jpeg';
        const base64Data = buffer.toString('base64');
        return { base64Data, mimeType };
    } catch (error) {
        console.error("Error fetching image from URL:", error.message);
        throw new Error("Failed to download image from WhatsApp.");
    }
}

/**
 * Analyzes an image using Gemini to detect civic issues.
 * Returns a JSON object with { isValid, category, description, confidence, etc. }
 */
async function analyzeImageFromUrl(imageUrl) {
    if (!process.env.GEMINI_API_KEY) {
        console.error("Missing GEMINI_API_KEY");
        return null;
    }

    try {
        console.log(`[AI Service] Fetching image from: ${imageUrl}`);
        const { base64Data, mimeType } = await fetchImageAsBase64(imageUrl);

        // Try primary model
        let model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Analyze this civic issue image.
        Categories: Police, Traffic, Fire, Medical, Municipal/Waste, Electricity, Water.
        Output JSON ONLY:
        {
          "isValid": boolean, (true if it shows a real civic problem like garbage, pothole, accident, fire, street light issue, etc.)
          "category": "String",
          "description": "Short 1-sentence description",
          "confidence": number (0-100),
          "priority": "High" | "Medium" | "Low"
        }`;

        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType: mimeType
            }
        };

        console.log("[AI Service] Sending to Gemini...");
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        let text = response.text();

        // Clean markdown
        if (text.includes("```")) {
            text = text.replace(/```\w*\n?|```/g, "").trim();
        }

        console.log("[AI Service] Response:", text);
        return JSON.parse(text);

    } catch (error) {
        console.error("[AI Service] Error:", error.message);
        // Fallback or return default error object
        return {
            isValid: true, // Default to true so admin sees it anyway
            category: "General",
            description: "AI Analysis Failed - Manual Review Required",
            confidence: 0,
            priority: "Medium"
        };
    }
}

module.exports = { analyzeImageFromUrl };
