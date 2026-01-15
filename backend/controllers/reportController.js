const { VertexAI } = require('@google-cloud/vertexai');
const { db } = require('../config/firebase');

// Initialize Vertex AI
const vertex_ai = new VertexAI({
    project: process.env.GCP_PROJECT_ID,
    location: process.env.GCP_LOCATION || 'us-central1'
});
const modelName = 'gemini-1.5-flash-001';
const generativeModel = vertex_ai.getGenerativeModel({ model: modelName });

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

        const request = {
            contents: [{ role: 'user', parts: [imagePart, { text: prompt }] }]
        };

        const result = await generativeModel.generateContent(request);
        const response = await result.response;
        const text = response.candidates[0].content.parts[0].text;
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
        // 2. Save report
        await newReportRef.set(finalizedReport);

        // EXTRA: Emergency Escalation (Prediction 3)
        // If critical department, send email to authorities
        const isCritical = ['Fire & Safety', 'Medical/Ambulance', 'Police'].includes(reportData.department) || reportData.priority === 'Critical';

        if (isCritical) {
            console.log(`[ESCALATION] Critical Incident Detected: ${reportData.department}`);

            try {
                const nodemailer = require('nodemailer');

                // Note: In a real app, use environment variables. 
                // Using a safe mock/log if env vars missing to prevent crash.
                if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: process.env.EMAIL_USER,
                            pass: process.env.EMAIL_PASS
                        }
                    });

                    const mailOptions = {
                        from: '"Nagar Alert System" <alert@nagarhub.com>',
                        to: 'emergency@city.gov.in', // Mock Authority
                        subject: `🚨 CRITICAL ALERT: ${reportData.department.toUpperCase()} - ${reportData.type}`,
                        html: `
                            <div style="font-family: Arial, sans-serif; color: #333;">
                                <h1 style="color: #d9534f;">🚨 CRITICAL INCIDENT REPORTED</h1>
                                <p><strong>Type:</strong> ${reportData.type}</p>
                                <p><strong>Department:</strong> ${reportData.department}</p>
                                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                                <div style="background: #f9f9f9; padding: 15px; border-left: 5px solid #d9534f; margin: 20px 0;">
                                    <strong>📍 Location:</strong><br>
                                    ${reportData.location?.address || 'Address not available'}<br>
                                    <a href="https://www.google.com/maps?q=${reportData.location?.lat},${reportData.location?.lng}">View on Map</a>
                                </div>
                                <p><i>This is an automated escalation from Nagar Alert Hub.</i></p>
                            </div>
                        `
                    };

                    // Non-blocking send
                    transporter.sendMail(mailOptions).then(() => {
                        console.log(`[ESCALATION] Emergency Email sent for Report ${reportId}`);
                    }).catch(err => {
                        console.error("[ESCALATION] Email failed:", err.message);
                    });
                } else {
                    console.log("[ESCALATION] Email skipped (No credentials configured). Simulation Logged.");
                }
            } catch (e) {
                console.error("[ESCALATION] Module error:", e);
            }
        }

        // EXTRA: Save to department-specific node for real-time admin view
        if (reportData.department) {
            const sanitizedDept = sanitizeKey(reportData.department);
            const deptRef = db.ref(`reports/by_department/${sanitizedDept}/${reportId}`);
            await deptRef.set(finalizedReport);
        }

        // 3. Update User's report count and points in citizens node
        if (userId) {
            try {
                const citizenRef = db.ref(`users/citizens/${userId}`);
                const snapshot = await citizenRef.once('value');
                if (snapshot.exists()) {
                    const currentData = snapshot.val();
                    await citizenRef.update({
                        reportsCount: (currentData.reportsCount || 0) + 1,
                        points: (currentData.points || 0) + 10 // Award 10 points per report
                    });
                }
            } catch (err) { console.error("Update User Stats Error", err); }
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
        // 1. Fetch User Profile to get Mobile Number
        let userMobile = "";
        try {
            const userSnap = await db.ref(`users/registry/${uid}`).once('value');
            if (userSnap.exists()) {
                const userData = userSnap.val();
                userMobile = userData.mobile ? String(userData.mobile).replace(/\D/g, '') : "";
                // Handle 10-digit vs 12-digit (91)
                // If userMobile is 10 chars, maybe reports store 91...
            }
        } catch (uErr) {
            console.warn("Could not fetch user profile for mobile matching:", uErr.message);
        }

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
            const reportUserId = String(r.userId).replace(/\D/g, ""); // Normalize Report User ID (might be phone)
            const targetUid = String(uid).trim();

            // 1. Direct UID Match
            if (r.userId === targetUid) return true;

            // 2. Mobile Number Match (Robust against +91, 91, or local)
            if (userMobile) {
                // Check if reportUserId contains userMobile or vice-versa
                // e.g. report=9199814... user=99814...
                if (reportUserId.includes(userMobile) || userMobile.includes(reportUserId)) return true;
            }

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
        console.log(`[BACKEND] Querying Path: reports/by_department/${sanitizedDept}`);

        const deptRef = db.ref(`reports/by_department/${sanitizedDept}`);
        const snapshot = await deptRef.once('value');

        if (!snapshot.exists()) {
            console.log(`[BACKEND] No reports found at path reports/by_department/${sanitizedDept}`);
            return res.status(200).json({ reports: [] });
        }

        const data = snapshot.val();
        console.log(`[BACKEND] Found ${Object.keys(data).length} reports.`);

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
        // Fetch original report to get user info
        const reportSnap = await db.ref(`reports/${reportId}`).once('value');
        const report = reportSnap.val();

        if (!report) {
            return res.status(404).json({ error: "Report not found" });
        }

        const updates = {};
        updates[`reports/${reportId}/status`] = status;

        if (department) {
            const sanitizedDept = sanitizeKey(department);
            updates[`reports/by_department/${sanitizedDept}/${reportId}/status`] = status;
        }

        await db.ref().update(updates);

        // --- 1. AUTOMATIC BROADCAST ON VERIFICATION ---
        // If Admin accepts/verifies, alert the whole community in that area.
        if (status.toLowerCase() === 'accepted' || status.toLowerCase() === 'verified') {
            const { broadcastTargetedAlert } = require('./whatsappController');
            const address = report.location?.address || "";
            // Heuristic: Try to get City/Area (2nd part of address) or fallback to 1st part
            const parts = address.split(',');
            const targetArea = (parts.length > 1 ? parts[parts.length - 2] : parts[0] || "General").trim();

            const alertMsg = `📢 *OFFICIAL ALERT: ${targetArea}*\n\nAdmin has verified a High Priority report (ID: ${reportId.slice(0, 6)}).\nTeams have been dispatched.\n\n📍 Location: ${address}`;

            console.log(`[AUTO-BROADCAST] Triggering alert for ${targetArea}`);
            // Trigger asynchronously
            broadcastTargetedAlert(targetArea, alertMsg).catch(err => console.error("Auto-Broadcast Failed:", err));

            // --- GAMIFICATION: AWARD POINTS ---
            // If user is registered (UID > 15 chars), give points
            if (report.userId && report.userId.length > 15) {
                const uid = report.userId;
                console.log(`[GAMIFICATION] Awarding 50 points to User ${uid}`);
                const userRef = db.ref(`users/citizens/${uid}`);

                // Transactional update for safety
                userRef.transaction((user) => {
                    if (user) {
                        user.points = (user.points || 0) + 50;
                        user.reportsCount = (user.reportsCount || 0) + 1;
                        user.level = Math.floor((user.points + 50) / 100) + 1; // Simple Level up logic
                    }
                    return user;
                }).catch(err => console.error("Gamification Error:", err));
            }
        }

        // --- 2. Universal Feedback Loop (Web + WhatsApp Users) ---
        // Notify the reporter via WhatsApp regardless of platform, if mobile exists.

        let targetPhone = null;

        // Case A: WhatsApp Report (userId is phone)
        if (report.source === 'WhatsApp') {
            targetPhone = report.userPhone || (report.userId && typeof report.userId === 'string' && report.userId.match(/^\d+$/) ? report.userId : null);
        }
        // Case B: Web/App Report (userId is UID)
        else if (report.userId) {
            try {
                // Fetch valid mobile from Registry
                const userSnap = await db.ref(`users/registry/${report.userId}`).once('value');
                if (userSnap.exists()) {
                    const u = userSnap.val();
                    let m = u.mobile || u.phoneNumber;
                    if (m) {
                        // Clean number
                        m = String(m).replace(/\D/g, '');
                        // Add country code if missing (Basic heuristic for India)
                        if (m.length === 10) m = '91' + m;
                        targetPhone = m;
                    }
                }
            } catch (err) {
                console.warn("[FEEDBACK] Could not fetch user mobile:", err.message);
            }
        }

        if (targetPhone) {
            const { sendMessage } = require('./whatsappController');

            // Format message based on status
            let message = "";
            const shortId = reportId ? reportId.slice(-6).toUpperCase() : 'N/A';

            if (status.toLowerCase() === 'accepted' || status.toLowerCase() === 'verified') {
                message = `✅ *Status Update: Verified*\n🆔 Report #${shortId}\n\nYour report regarding '${report.type || 'Issue'}' has been verified by the Admin. Response teams have been notified.`;
            } else if (status.toLowerCase() === 'rejected') {
                message = `❌ *Status Update: Rejected*\n🆔 Report #${shortId}\n\nThis report was marked as invalid or duplicate.`;
            } else if (status.toLowerCase() === 'resolved') {
                message = `🎉 *GOOD NEWS: Report Fixed!*\n🆔 Report #${shortId}\n\nThe issue you reported ('${report.type || 'Civic Issue'}') has been successfully RESOLVED!\n\nThank you for helping keep our city clean and safe. 🏙️`;
            } else {
                message = `ℹ️ *Status Update*\n🆔 Report #${shortId}\n\nCurrent Status: *${status}*`;
            }

            console.log(`[FEEDBACK] Sending WhatsApp update to ${targetPhone} for Status: ${status}`);
            await sendMessage(targetPhone, message);
        }
        // ---------------------------------

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
        // 1. Send WhatsApp Broadcast
        const { broadcastTargetedAlert } = require('./whatsappController');
        const waMessage = `📢 *${(type || 'ALERT').toUpperCase()}*\n📍 Area: ${area}\n\n${message}`;

        // This function handles the logic of finding users in that area and sending alerts
        await broadcastTargetedAlert(area, waMessage);

        // 2. Save to Database
        const broadcastRef = db.ref('broadcasts');
        const newBroadcast = {
            area,
            type,
            message,
            department: department || 'General',
            sender: sender || 'Admin',
            timestamp: new Date().toISOString(),
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

exports.getNearbyReports = async (req, res) => {
    const { lat, lng, radius = 5 } = req.query; // Radius in km

    if (!lat || !lng) {
        return res.status(400).json({ error: "Latitude and Longitude required" });
    }

    try {
        const turf = require('@turf/turf');
        console.log(`[GEO] Searching nearby reports: ${lat}, ${lng} within ${radius}km`);

        const reportsRef = db.ref('reports');
        const snapshot = await reportsRef.once('value');

        if (!snapshot.exists()) {
            return res.status(200).json({ reports: [] });
        }

        const allReports = snapshot.val();
        const nearby = [];
        const center = turf.point([parseFloat(lng), parseFloat(lat)]); // Note: Longitude first in Turf

        Object.keys(allReports).forEach(key => {
            const r = allReports[key];
            if (r.location && r.location.lat && r.location.lng) {
                const target = turf.point([parseFloat(r.location.lng), parseFloat(r.location.lat)]);
                const distance = turf.distance(center, target, { units: 'kilometers' });

                if (distance <= parseFloat(radius)) {
                    nearby.push({ id: key, ...r, distance: distance.toFixed(2) });
                }
            }
        });

        // Sort by distance
        nearby.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

        console.log(`[GEO] Found ${nearby.length} reports nearby.`);
        res.status(200).json({ count: nearby.length, reports: nearby });

    } catch (error) {
        console.error("Geo Filter Error:", error);
        res.status(500).json({ error: "Geo Calculation Failed", details: error.message });
    }
};