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
app.post(/(.*)/, async (req, res) => {
    res.status(200).send('OK');

    const data = req.body;

    if (!data.messages) return;

    for (const message of data.messages) {
        if (!message) continue;

        const from = message.from;
        const senderNumber = from.split('@')[0];
        const type = message.type;
        const body = message.text?.body || "";

        console.log(`📩 Message from ${senderNumber} [Type: ${type}]`);

        // --- 1. ADMIN COMMANDS (VERIFY / REJECT) ---
        if (senderNumber === ADMIN_NUMBER || from.includes(ADMIN_NUMBER)) {
            if (body.startsWith("VERIFY")) {
                const reportId = body.split(" ")[1];
                if (reportId) {
                    await db.ref(`reports/${reportId}`).update({ status: 'Accepted' });
                    const reportSnap = await db.ref(`reports/${reportId}`).once('value');
                    const report = reportSnap.val();
                    await sendMessage(from, `✅ Report ${reportId} accepted.`);

                    // TARGETED BROADCAST
                    const address = report?.location?.address || "";
                    const targetArea = address.split(',')[1] || address.split(',')[0] || "General";
                    await broadcastTargetedAlert(targetArea.trim(), `🚨 *High Priority Alert in ${targetArea}*\n\nAdmin has verified a report (ID: ${reportId.slice(0, 6)}). Emergency teams dispatched.`);
                }
                continue;
            } else if (body.startsWith("REJECT")) {
                const reportId = body.split(" ")[1];
                if (reportId) {
                    await db.ref(`reports/${reportId}`).update({ status: 'Rejected' });
                    await sendMessage(from, `❌ Report ${reportId} rejected.`);
                }
                continue;
            }
        }

        // --- 2. CITIZEN REPORT FLOW (IMAGE) ---
        if (type === 'image') {
            const originalMediaUrl = message.image?.link;
            const caption = message.image?.caption || "Report via WhatsApp";

            // Use PROXY URL for Frontend (Solves Image Loading Issues)
            // We save the 'localhost' link so the frontend can just load it directly.
            const serverBaseUrl = `http://localhost:${PORT}`;
            const proxyUrl = `${serverBaseUrl}/api/proxy-image?url=${encodeURIComponent(originalMediaUrl)}`;

            // Send "Analyzing" message immediately
            await sendMessage(from, "🤖 Analyzing image... Please wait.");

            // AI Analysis (Pass original URL to function which handles auth)
            let aiData = null;
            if (originalMediaUrl) {
                aiData = await analyzeImage(originalMediaUrl);
            }

            const reportId = uuidv4();
            const newReport = {
                id: reportId,
                type: aiData?.title || 'General Issue', // Improved Fallback
                description: aiData?.description || caption,
                imageUrl: proxyUrl, // <--- SAVING PROXY URL HERE
                originalImageUrl: originalMediaUrl, // Backup
                mediaType: 'image',
                department: aiData?.department || 'Municipal',
                status: 'Pending',
                priority: aiData?.priority || 'Medium',
                aiAnalysis: aiData?.description,
                aiConfidence: aiData?.confidence || 0,
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                source: 'WhatsApp',
                userId: senderNumber,
                userName: message.from_name || "Citizen (WhatsApp)",
                location: {
                    address: 'Location Pending...',
                    lat: 0,
                    lng: 0
                }
            };

            // Save to DB
            await db.ref(`reports/${reportId}`).set(newReport);

            // Send Confirmation
            let replyText = `✅ Report Received!\n🆔 ID: ${reportId}\n`;
            if (aiData) {
                replyText += `🧐 *AI Detected:* ${aiData.title}\n📊 *Severity:* ${aiData.priority}\n🏢 *Department:* ${aiData.department}\n`;
            } else {
                replyText += `⚠️ AI could not analyze the image (Secure Link), but report is saved.\n`;
            }
            replyText += `\n📍 *IMPORTANT: Please tap 'Paperclip' > 'Location' > 'Share Current Location' to complete report.*`;

            await sendMessage(from, replyText);

            // Notify Admin
            if (ADMIN_NUMBER) {
                await sendMessage(ADMIN_NUMBER, `🚨 New Report (Waiting loc)\nID: ${reportId}\nType: ${newReport.type}`);
            }
        }

        // --- 3. LOCATION HANDLER ---
        else if (type === 'location') {
            const lat = message.location.latitude;
            const lng = message.location.longitude;
            const address = message.location.name || message.location.address || `${lat}, ${lng}`;

            // Find the most recent PENDING report by this user
            const snapshot = await db.ref('reports')
                .orderByChild('userId')
                .equalTo(senderNumber)
                .limitToLast(1)
                .once('value');

            if (snapshot.exists()) {
                const reports = snapshot.val();
                const reportId = Object.keys(reports)[0];

                // Update Location
                await db.ref(`reports/${reportId}/location`).set({
                    lat,
                    lng,
                    address
                });

                await sendMessage(from, `📍 Location attached to Report #${reportId.slice(0, 6)}.\n\nThank you for helping improve our city! 🌟`);

            } else {
                await sendMessage(from, "📍 Location received, but no active report found. Please send a photo of the issue first.");
            }
        }

        // --- 4. TEXT HANDLER ---
        else if (type === 'text') {
            if (body.toLowerCase().includes('hi')) {
                await sendMessage(from, `👋 Namaste from Nagar Alert Hub!\n\nTo report an issue:\n1. Send a 📸 *Photo*.\n2. Wait for AI.\n3. Share 📍 *Location*.`);
            }
        }
    }
});

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