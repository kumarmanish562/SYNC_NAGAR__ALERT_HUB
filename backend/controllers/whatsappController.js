const axios = require('axios');
const { db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

// Whapi Config - Fallback to hardcoded if env fails (for immediate reliability)
const WHAPI_TOKEN = process.env.WHAPI_TOKEN
const WHAPI_URL = process.env.WHAPI_INSTANCE_URL
const ADMIN_NUMBER = process.env.ADMIN_NUMBER

// Helper: Send Message
const sendMessage = async (to, message) => {
    try {
        await axios.post(`${WHAPI_URL}/messages/text`, {
            to,
            body: message
        }, {
            headers: {
                Authorization: `Bearer ${WHAPI_TOKEN}`,
                "Content-Type": "application/json"
            }
        });
    } catch (error) {
        console.error("WhatsApp Send Error:", error.response?.data || error.message);
    }
};

// Helper: Broadcast to Targeted City/Area subscribers
const broadcastTargetedAlert = async (targetLocation, message) => {
    try {
        console.log(`[BROADCAST] Target: ${targetLocation}`);
        const snapshot = await db.ref("users/citizens").once("value");
        if (!snapshot.exists()) return;

        const users = snapshot.val();
        let count = 0;

        // Normalize target for comparison
        const target = targetLocation ? targetLocation.toLowerCase() : "";

        for (const uid in users) {
            const user = users[uid];
            const phone = user.phoneNumber;

            // Check if user is in the target area (City or Address match)
            // Default to true if no target specified (Global Broadcast)
            let isMatch = true;
            if (target) {
                const userCity = (user.city || "").toLowerCase();
                const userAddress = (user.address || "").toLowerCase();
                // Simple includes check - in production use exact city match
                if (!userCity.includes(target) && !userAddress.includes(target)) {
                    isMatch = false;
                }
            }

            if (phone && isMatch) {
                const cleanPhone = phone.replace(/\D/g, '');
                if (cleanPhone.length >= 10) {
                    await sendMessage(cleanPhone, message);
                    count++;
                }
            }
        }
        console.log(`[BROADCAST] Sent to ${count} citizens in ${targetLocation || "ALL"}.`);
    } catch (e) {
        console.error("Broadcast Logic Error:", e);
    }
};

// NEW: Exportable function for Frontend Broadcast Button
exports.sendManualBroadcast = async (req, res) => {
    try {
        const { area, message, type } = req.body; // Data from Broadcast.jsx

        // Add a header for the message
        const formattedMessage = `📢 *OFFICIAL ${type?.toUpperCase() || 'ALERT'}*\n📍 Area: ${area}\n\n${message}`;

        // Reuse your existing helper
        await broadcastTargetedAlert(area, formattedMessage);

        res.status(200).json({ success: true, message: "Broadcast initiated" });
    } catch (error) {
        console.error("Manual Broadcast Error:", error);
        res.status(500).json({ error: "Failed to send broadcast" });
    }
};

exports.handleWebhook = async (req, res) => {
    try {
        const data = req.body;
        const message = data.messages?.[0];
        if (!message) return res.send('OK');

        const from = message.from;
        const senderNumber = from.split('@')[0];
        const type = message.type;
        const body = message.text?.body || "";

        // --- 1. ADMIN COMMANDS (VERIFY / REJECT) ---
        if (senderNumber === ADMIN_NUMBER || from.includes(ADMIN_NUMBER)) {
            if (body.startsWith("VERIFY")) {
                const reportId = body.split(" ")[1];
                if (reportId) {
                    await db.ref(`reports/${reportId}`).update({ status: 'Accepted' });

                    // Fetch report details to get location for broadcast
                    const reportSnap = await db.ref(`reports/${reportId}`).once('value');
                    const report = reportSnap.val();

                    await sendMessage(from, `✅ Report ${reportId} accepted.`);

                    // TARGETED BROADCAST
                    const address = report?.location?.address || "";
                    const targetArea = address.split(',')[1] || address.split(',')[0] || "General";

                    await broadcastTargetedAlert(targetArea.trim(), `🚨 *High Priority Alert in ${targetArea}*\n\nAdmin has verified a report (ID: ${reportId.slice(0, 6)}). Emergency teams dispatched to your area.`);
                }
                return res.send('OK');
            } else if (body.startsWith("REJECT")) {
                const reportId = body.split(" ")[1];
                if (reportId) {
                    await db.ref(`reports/${reportId}`).update({ status: 'Rejected' });
                    await sendMessage(from, `❌ Report ${reportId} rejected.`);
                }
                return res.send('OK');
            }
        }

        // --- 2. CITIZEN REPORT FLOW ---
        if (type === 'image' || type === 'video') {
            const isVideo = type === 'video';
            const mediaUrl = isVideo ? message.video?.link : message.image?.link;
            const caption = (isVideo ? message.video?.caption : message.image?.caption) || message.text?.body || "Report via WhatsApp";

            const reportId = uuidv4();
            const newReport = {
                id: reportId,
                type: 'General',
                description: caption,
                imageUrl: mediaUrl || "https://via.placeholder.com/300",
                mediaType: isVideo ? 'video' : 'image',
                department: 'Municipal Waste', // Default explicit department
                status: 'Pending',
                priority: 'Medium',
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                source: 'WhatsApp',
                userId: senderNumber,
                userName: message.from_name || "WhatsApp User",
                location: {
                    address: 'Sector 4, Bhilai',
                    lat: 22.5726 + (Math.random() * 0.01),
                    lng: 88.3639 + (Math.random() * 0.01)
                } // Mock with coordinates
            };

            await db.ref(`reports/${reportId}`).set(newReport);
            // Also save to department specific node
            await db.ref(`reports/by_department/Municipal_Waste/${reportId}`).set(newReport);

            await sendMessage(from, `✅ ${isVideo ? 'Video' : 'Photo'} Report received!\nID: ${reportId}\nDetected Location: Sector 4, Bhilai (Mock)\n\nStatus: Pending verification`);

            await sendMessage(ADMIN_NUMBER, `🚨 New Citizen Report\nID: ${reportId}\nFrom: ${senderNumber}\nLocation: ${newReport.location.address}\n${isVideo ? 'Video' : 'Image'}: ${mediaUrl}\n\n✅ Reply: VERIFY ${reportId} OR REJECT ${reportId}`);
        }
        else if (type === 'text') {
            if (body.toLowerCase().includes('hi') || body.toLowerCase().includes('start')) {
                await sendMessage(from, `👋 Welcome to Nagar Alert Hub!\n\nI can help you report civic issues instantly.\n\n📸 *Please send a photo or video of the incident.*`);
            }
        }

        res.send('OK');
    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).send("Error");
    }
};

module.exports = {
    handleWebhook: exports.handleWebhook,
    sendManualBroadcast: exports.sendManualBroadcast,
    sendMessage,
    broadcastTargetedAlert
};