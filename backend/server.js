const express = require('express');
require('dotenv').config(); // Load env vars immediately
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios'); // Added for downloading images
const authRoutes = require('./routes/authRoutes');
const { db } = require('./config/firebase');
const { v4: uuidv4 } = require('uuid');
const { sendMessage, broadcastTargetedAlert } = require('./controllers/whatsappController');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = 5001;
const ADMIN_NUMBER = process.env.ADMIN_NUMBER;
const WHAPI_TOKEN = process.env.WHAPI_TOKEN; // Needed for image fetching

// Initialize Gemini
let genAI;
let model;
if (process.env.GEMINI_API_KEY) {
    try {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("✅ Gemini AI Initialized");
    } catch (e) {
        console.error("❌ Gemini Init Failed:", e);
    }
}

// Middleware
app.use(cors({
    origin: 'http://localhost:5173', // Vite default port
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// 1. Universal Logger
app.use((req, res, next) => {
    console.log(`\n🔔 Incoming Request!`);
    console.log(`   Path: ${req.path}`);
    console.log(`   Method: ${req.method}`);
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/whatsapp', require('./routes/whatsappRoutes')); // Enable WhatsApp Controller Logic

// 2. Health Check
app.get('/', (req, res) => {
    res.status(200).send('Nagar Alert is Active! 🚀');
});

// --- NEW: IMAGE PROXY (Fixes Broken Images) ---
// This endpoint fetches the image from Whapi on the server side (avoiding CORS/Auth issues)
// and pipes it to the frontend.
app.get('/api/proxy-image', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send('No URL provided');

    try {
        // console.log(`🔄 Proxying image: ${url}`);
        const response = await axios.get(url, {
            responseType: 'stream',
            headers: {
                'Authorization': `Bearer ${WHAPI_TOKEN}` // Send token just in case
            }
        });

        if (response.headers['content-type']) {
            res.set('Content-Type', response.headers['content-type']);
        }

        response.data.pipe(res);
    } catch (error) {
        console.error("❌ Proxy Error:", error.message);
        // Return a placeholder so the UI doesn't look broken
        res.redirect('https://placehold.co/600x400?text=Image+Unavailable');
    }
});

// Helper: Analyze Image with Gemini
async function analyzeImage(imageUrl) {
    if (!model) return null;
    try {
        // 1. Download Image (using token for access)
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` }
        });
        const data = Buffer.from(response.data).toString('base64');

        // 2. Prompt Gemini
        const prompt = `Analyze this civic issue image. Identify the problem (e.g., Pothole, Garbage, Water Leak, Streetlight). 
        Return a STRICTLY VALID JSON object with these keys: 
        - title (short summary, max 5 words)
        - description (detailed explanation of the visual evidence, max 2 sentences)
        - department (e.g., Sanitation, Roads, Water, Electrical, Police)
        - priority (High, Medium, or Low based on severity)
        - confidence (number 0-100)
        
        Do not include markdown formatting like \`\`\`json. Just the raw JSON string.`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: data, mimeType: "image/jpeg" } }
        ]);

        const text = result.response.text();
        const cleanJson = text.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("Gemini Analysis Error:", error.message);
        return null; // Fail gracefully
    }
}

// 3. Main Webhook Handler
// REMOVED: Legacy inline handler. All logic now served via /api/whatsapp/webhook in routes/whatsappRoutes.js
// This prevents "Headers Sent" and duplicate processing errors.
// app.post(...) block removed.

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(`[SERVER ERROR] ${req.method} ${req.url}:`, err);
    res.status(500).json({
        error: "Internal Server Error",
        message: err.message
    });
});

// Start Server
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    if (process.env.GEMINI_API_KEY) console.log("✅ Gemini API Key detected.");
});