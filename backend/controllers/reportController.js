const { GoogleGenerativeAI } = require("@google/generative-ai");
const { db } = require('../config/firebase');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const sanitizeKey = (key) => {
    if (!key) return "General";
    return key.replace(/[\/\.#\$\[\]]/g, "_");
};

exports.verifyReportImage = async (req, res) => {
    const { imageBase64, type } = req.body;

    if (!imageBase64) {
        return res.status(400).json({ error: "No image provided" });
    }

    if (!process.env.GEMINI_API_KEY) {
        console.error("[AI ERROR] GEMINI_API_KEY is missing in .env");
        return res.status(500).json({ error: "AI Backend not configured (Missing API Key)" });
    }

    try {
        console.log("[AI] Analyzing image for type:", type);

        // Use gemini-1.5-flash as requested by user or fallback to gemini-pro-vision for images
        // Note: For images, 'gemini-pro-vision' is often the correct legacy name if 1.5 is failing.
        // Let's try the user's specific request 'gemini-2.0-flash' if available, or 'gemini-1.5-flash'
        // Verified working model via test script
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `Analyze this image. Does it show a valid civic issue related to '${type}'? 
        If the issue is visible, set isValid to true. 
        Possible categories: Police, Traffic, Fire & Safety, Medical/Ambulance, Municipal/Waste, Electricity Board, Water Supply.
        Return ONLY a JSON object:
        {
          "isValid": boolean,
          "confidence": number,
          "description": "Short summary",
          "category": "detected_category"
        }`;

        // Detect mime type
        const mimeType = imageBase64.match(/^data:([^;]+);base64,/)?.[1] || "image/jpeg";
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType: mimeType,
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();
        console.log("[AI RAW RESPONSE]:", text);

        // More robust JSON extraction
        let jsonStr = text;
        if (text.includes("```")) {
            jsonStr = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] || text;
        }
        jsonStr = jsonStr.trim();

        const analysis = JSON.parse(jsonStr);
        res.status(200).json({ analysis });

    } catch (error) {
        console.error("[AI ERROR] Full details:", error);

        // For debugging, let's try to list what models are available if we hit a 404
        if (error.status === 404) {
            console.log("--- DEBUG: LISTING AVAILABLE MODELS ---");
            try {
                // The SDK doesn't have an easy 'listModels' in the client-side usually
                // but we can log that it's a 404.
            } catch (e) { }
        }

        res.status(500).json({ error: "AI Verification Failed", details: error.message });
    }
};

exports.createReport = async (req, res) => {
    const reportData = req.body;
    const { userId } = reportData;

    try {
        // 1. Generate a new report ID
        const reportsRef = db.ref('reports');
        const newReportRef = reportsRef.push();
        const reportId = newReportRef.key;

        const finalizedReport = {
            ...reportData,
            id: reportId,
            status: 'Pending',
            createdAt: new Date().toISOString(),
        };

        // 2. Save report
        await newReportRef.set(finalizedReport);

        // EXTRA: Save to department-specific node for real-time admin view
        if (reportData.department) {
            const sanitizedDept = sanitizeKey(reportData.department);
            const deptRef = db.ref(`reports/by_department/${sanitizedDept}/${reportId}`);
            await deptRef.set(finalizedReport);
        }

        // 3. Update User's report count and points in citizens node
        if (userId) {
            const citizenRef = db.ref(`users/citizens/${userId}`);
            const snapshot = await citizenRef.once('value');
            if (snapshot.exists()) {
                const currentData = snapshot.val();
                await citizenRef.update({
                    reportsCount: (currentData.reportsCount || 0) + 1,
                    points: (currentData.points || 0) + 10 // Award 10 points per report
                });
            }
        }

        res.status(201).json({ message: "Report created successfully", id: reportId, data: finalizedReport });

    } catch (error) {
        console.error("Create Report Error:", error);
        res.status(500).json({ error: "Failed to create report", details: error.message });
    }
};

exports.getUserReports = async (req, res) => {
    const { uid } = req.params;
    console.log(`[BACKEND] Fetching reports for UID: ${uid}`);

    try {
        const reportsRef = db.ref('reports');
        const snapshot = await reportsRef.once('value');

        if (!snapshot.exists()) {
            console.log("[BACKEND] No reports exist in database at all.");
            return res.status(200).json({ reports: [] });
        }

        const data = snapshot.val();
        const allReports = Object.keys(data).map(key => ({ id: key, ...data[key] }));

        // Robust Matching Logic
        const userReports = allReports.filter(r => {
            if (!r.userId) return false;
            const reportUserId = String(r.userId).trim();
            const targetUid = String(uid).trim();

            // 1. Direct Match
            if (reportUserId === targetUid) return true;

            // 2. Case Insensitive Match
            if (reportUserId.toLowerCase() === targetUid.toLowerCase()) return true;

            // 3. Fallback: Check if reportUserId is contained in targetUid or vice-versa (paranoid check for phone numbers vs ids)
            // e.g. Phone number might be part of an ID string in some weird edge cases
            // But main issue is usually undefined or type mismatch.

            return false;
        });

        console.log(`[BACKEND] Found ${userReports.length} matches for UID ${uid}.`);

        const sortedReports = userReports.sort((a, b) => {
            const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
            const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
            return timeB - timeA;
        });

        res.status(200).json({ reports: sortedReports });

    } catch (error) {
        console.error("Get User Reports Error:", error);
        res.status(500).json({ error: "Failed to fetch reports", details: error.message });
    }
};

exports.getSingleReport = async (req, res) => {
    const { id } = req.params;

    try {
        const reportRef = db.ref(`reports/${id}`);
        const snapshot = await reportRef.once('value');

        if (!snapshot.exists()) {
            return res.status(404).json({ error: "Report not found" });
        }

        res.status(200).json({ report: { id, ...snapshot.val() } });

    } catch (error) {
        console.error("Get Single Report Error:", error);
        res.status(500).json({ error: "Failed to fetch report", details: error.message });
    }
};

exports.getDepartmentReports = async (req, res) => {
    const { department } = req.params;
    console.log(`[BACKEND] Fetching reports for department: ${department}`);

    try {
        const sanitizedDept = sanitizeKey(department);
        const deptRef = db.ref(`reports/by_department/${sanitizedDept}`);
        const snapshot = await deptRef.once('value');

        if (!snapshot.exists()) {
            return res.status(200).json({ reports: [] });
        }

        const data = snapshot.val();
        const reports = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.status(200).json({ reports });

    } catch (error) {
        console.error("Get Department Reports Error:", error);
        res.status(500).json({ error: "Failed to fetch department reports", details: error.message });
    }
};

exports.updateReportStatus = async (req, res) => {
    const { reportId, status, department } = req.body;
    console.log(`[BACKEND] Updating status for Report ${reportId} to ${status}`);

    if (!reportId || !status) {
        return res.status(400).json({ error: "Missing reportId or status" });
    }

    try {
        const updates = {};
        updates[`reports/${reportId}/status`] = status;

        if (department) {
            const sanitizedDept = sanitizeKey(department);
            updates[`reports/by_department/${sanitizedDept}/${reportId}/status`] = status;
        }

        await db.ref().update(updates);
        res.status(200).json({ message: "Status updated successfully" });

    } catch (error) {
        console.error("Update Status Error:", error);
        res.status(500).json({ error: "Failed to update status", details: error.message });
    }
};

exports.sendBroadcast = async (req, res) => {
    const { area, type, message, department, sender, reach } = req.body;
    console.log(`[BACKEND] Sending Broadcast: ${type} to ${area}`);

    try {
        const broadcastRef = db.ref('broadcasts');
        const newBroadcast = {
            area,
            type,
            message,
            department: department || 'General',
            sender: sender || 'Admin',
            timestamp: new Date().toISOString(), // Use simple string for now, or admin.database.ServerValue.TIMESTAMP
            reach: reach || 0,
            status: 'Sent'
        };

        await broadcastRef.push(newBroadcast);
        res.status(200).json({ message: "Broadcast sent successfully" });

    } catch (error) {
        console.error("Broadcast Error:", error);
        res.status(500).json({ error: "Failed to send broadcast", details: error.message });
    }
};