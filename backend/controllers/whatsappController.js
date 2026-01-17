const { analyzeImageForReport } = require('../services/aiService');
const axios = require('axios');
const { db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

// Helper to download media
// Helper to download media
// Helper to download media
async function downloadMedia(url) {
    try {
        // Handle Data URIs (from Simulator)
        if (url && url.startsWith('data:')) {
            // Remove prefix (e.g. "data:image/png;base64,")
            return url.split(',')[1];
        }

        const config = { responseType: 'arraybuffer' };

        // Only attach generic Whapi token if it's NOT a known public test URL
        // (Public testing services might reject unknown Bearer tokens)
        const isPublicTest = url.includes('placehold.co') || url.includes('via.placeholder.com') || url.includes('placeholder.com');

        if (process.env.WHAPI_TOKEN && !isPublicTest) {
            config.headers = { Authorization: `Bearer ${process.env.WHAPI_TOKEN}` };
        }

        const response = await axios.get(url, config);
        const buffer = Buffer.from(response.data, 'binary');
        return buffer.toString('base64');
    } catch (error) {
        console.error("Error downloading media:", error.message);
        return null;
    }
}

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
            // Fix: Auth saves as 'mobile', legacy might used 'phoneNumber'
            const phone = user.mobile || user.phoneNumber;

            // Check if user is in the target area (City or Address match)
            // Default to true if no target specified (Global Broadcast)
            let isMatch = true;
            if (target) {
                const userCity = (user.city || "").toLowerCase();
                const userAddress = (user.address || "").toLowerCase();

                // DEBUG LOG
                console.log(`[BROADCAST CHECK] Checking User ${uid}... City: '${userCity}', Addr: '${userAddress}', Target: '${target}'`);

                if (!userCity.includes(target) && !userAddress.includes(target)) {
                    isMatch = false;
                }
            }

            if (phone && isMatch) {
                let cleanPhone = phone.replace(/\D/g, '');
                // Ensure ID format for Whapi (Default to 91 for India)
                if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

                if (cleanPhone.length >= 10) {
                    console.log(`[BROADCAST] Sending to ${cleanPhone} (User City: ${user.city})`);
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

// Helper: Find User UID by Mobile
const findUidByMobile = async (mobile) => {
    try {
        // Clean mobile: remove + and 91 if needed, or matched based on DB format
        // DB usually stores as provided. Let's try flexible search.
        const registryRef = db.ref('users/registry');
        // Optimization: orderByChild 'mobile' should be indexed in rules
        const snapshot = await registryRef.orderByChild('mobile').equalTo(mobile).once('value');
        if (snapshot.exists()) {
            return Object.keys(snapshot.val())[0];
        }

        // Try with/without prefix if not found
        const clean = mobile.replace(/\D/g, '');
        const withPrefix = clean.length === 10 ? '91' + clean : clean;
        const snapshot2 = await registryRef.orderByChild('mobile').equalTo(Number(withPrefix)).once('value'); // Check as Number
        if (snapshot2.exists()) return Object.keys(snapshot2.val())[0];

        const snapshot3 = await registryRef.orderByChild('mobile').equalTo(withPrefix).once('value'); // Check as String
        if (snapshot3.exists()) return Object.keys(snapshot3.val())[0];

        return null;
    } catch (e) {
        console.error("UID Lookup Error:", e);
        return null;
    }
};

exports.handleWebhook = async (req, res) => {
    try {
        const data = req.body;
        const message = data.messages?.[0];
        if (!message) return res.send('OK');
        if (message.from_me) return res.send('OK');

        const from = message.chat_id || message.from;
        const senderRaw = message.from;
        const isGroup = from.includes('@g.us');
        const senderNumber = senderRaw.split('@')[0];
        const type = message.type;
        const body = message.text?.body || "";

        console.log(`[WEBHOOK] Chat: ${from}, Sender: ${senderNumber} (Type: ${type})`);

        // --- 1. ADMIN COMMANDS (VERIFY / REJECT) ---
        const cleanAdmin = (process.env.ADMIN_NUMBER || "").replace(/\D/g, '');
        if (senderNumber === cleanAdmin || senderNumber === '919999999999') { // Authorize Admin (Simulator too)
            if (body.startsWith("VERIFY") || body.startsWith("REJECT")) {
                const action = body.startsWith("VERIFY") ? "Accepted" : "Rejected";
                const statusLabel = action === 'Rejected' ? 'Rejected - Unconventional Report' : action;
                const reportId = body.split(" ")[1];

                if (reportId) {
                    await db.ref(`reports/${reportId}`).update({ status: statusLabel });
                    const reportSnap = await db.ref(`reports/${reportId}`).once('value');
                    const report = reportSnap.val();

                    if (report?.department) {
                        const deptKey = report.department.replace(/[\/\.#\$\[\]]/g, "_");
                        await db.ref(`reports/by_department/${deptKey}/${reportId}`).update({ status: statusLabel });
                    }

                    await sendMessage(from, `${action === 'Accepted' ? '✅' : '❌'} Report ${reportId} ${action}.`);

                    // Notify User
                    if (report && report.userPhone) {
                        const shortId = reportId.slice(-6).toUpperCase();
                        const msg = `ℹ️ *Status Update*\n🆔 Report #${shortId}\n\nCurrent Status: *${statusLabel}*`;

                        await sendMessage(report.userPhone, msg);
                    }
                }
                return res.send('OK');
            }
        }

        // --- 2. MULTIMODAL REPORT HANDLING ---
        const { analyzeMedia, analyzeText } = require('../services/aiService');

        let isReport = false;
        let aiResult = null;
        let mediaUrl = null;
        let mimeType = null;
        let mediaType = type;

        // A. HANDLE MEDIA (Image, Video, Audio)
        let mediaBase64 = null; // Scope fix
        if (type === 'image' || type === 'video' || type === 'audio') { // Voice Note is 'audio' or 'ppt' (check Whapi docs, usually audio)
            isReport = true;
            await sendMessage(from, "🔍 Analyzing image for authenticity... Please wait.");

            const isVideo = type === 'video';
            const isAudio = type === 'audio' || type === 'voice';
            mediaUrl = isVideo ? message.video?.link : (isAudio ? (message.audio?.link || message.voice?.link) : message.image?.link);
            mimeType = isVideo ? 'video/mp4' : (isAudio ? 'audio/ogg' : 'image/jpeg'); // Default assumptions
            mediaType = isAudio ? 'audio' : (isVideo ? 'video' : 'image');

            if (mediaUrl) {
                mediaBase64 = await downloadMedia(mediaUrl);
                if (mediaBase64) {
                    aiResult = await analyzeMedia(mediaBase64, mimeType);
                }
            }
        }

        // B. HANDLE TEXT (Could be Report OR Address Update OR Chat)
        else if (type === 'text') {
            // Check if this is an Address Update for a recent pending report
            const recentSnap = await db.ref('reports').orderByChild('userPhone').equalTo(senderNumber).limitToLast(1).once('value');
            if (recentSnap.exists()) {
                const reportData = Object.values(recentSnap.val())[0];
                const timeDiff = new Date() - new Date(reportData.createdAt);

                // If recently created and status is 'Pending Address' (Wait Address)
                if (reportData.status === 'Pending Address' && timeDiff < 15 * 60 * 1000) {
                    // TREAT AS ADDRESS UPDATE
                    const newAddress = body;
                    await db.ref(`reports/${reportData.id}`).update({ 'location/address': newAddress, status: 'Pending' });
                    // Also update dept node... (simplified for brevity)
                    const deptKey = (reportData.department || "General").replace(/[\/\.#\$\[\]]/g, "_");
                    await db.ref(`reports/by_department/${deptKey}/${reportData.id}`).update({ 'location/address': newAddress, status: 'Pending' });

                    await sendMessage(from, `✅ *Location Saved: ${newAddress}*\n\nReport ID: ${reportData.id}\nStatus: Verification Pending.\n\n(We will notify you when verified)`);
                    return res.send('OK');
                }
            }

            // If not an address update, Analyze Text for Potential Report
            // If not an address update, decide what to do with text
            const isLongText = body.length > 10;
            const isGreeting = ['hi', 'hello', 'hey', 'help', 'start', 'menu'].includes(body.toLowerCase().trim());

            if (isLongText) {
                // Potential detailed text report
                const textAnalysis = await analyzeText(body);
                if (textAnalysis.isReal && textAnalysis.confidence > 70) {
                    isReport = true;
                    aiResult = textAnalysis;
                    await sendMessage(from, "📝 Text Report Detected. Analyzing...");
                } else if (!isGroup && isGreeting) {
                    await sendMessage(from, `👋 Welcome to Nagar Alert Hub!\n\nI can help you report civic issues.\n\n📸 Send a *Photo/Video/Audio* of the issue.\n📝 Or describe the issue in detail.`);
                    return res.send('OK');
                }
            } else if (!isGroup) {
                // Short text logic
                if (isGreeting) {
                    await sendMessage(from, `👋 Welcome to Nagar Alert Hub!\n\nI can help you report civic issues.\n\n📸 Send a *Photo/Video/Audio* of the issue.\n📝 Or describe the issue in detail.`);
                    return res.send('OK');
                }
                // If it was a short address update, it should have been caught above.
                // If not caught, it's just random short text. IGNORE IT.
            }
        }

        // --- 3. CREATE REPORT IF VERIFIED ---
        if (isReport && aiResult) {

            // Simulation Bypass Logic for Testing
            const isSimulation = mediaUrl && (mediaUrl.includes('placehold.co') || mediaUrl.includes('placeholder.com'));

            if (!aiResult.isReal && !isSimulation) {
                await sendMessage(from, `⚠️ *Report Rejected*\n\nReason: ${aiResult.fakeReason || "Content violation detected."}`);
                return res.send('OK');
            }

            // Create Report Object
            const reportId = uuidv4();
            const caption = message.caption || message.text?.body || aiResult.description || "Report via WhatsApp";

            // Find User Map
            let finalUserId = senderNumber;
            const linkedUid = await findUidByMobile(senderNumber);
            if (linkedUid) finalUserId = linkedUid;

            const newReport = {
                id: reportId,
                type: aiResult.issue || 'General',
                description: aiResult.description || caption,
                imageUrl: mediaUrl || "https://placehold.co/100?text=Text+Report", // Fallback for text
                mediaType: mediaType, // 'image', 'video', 'audio', 'text'
                department: aiResult.category || 'General',
                status: 'Pending Address', // Always ask for address next
                priority: aiResult.priority || 'Medium',
                aiConfidence: aiResult.confidence || 0,
                aiAnalysis: JSON.stringify(aiResult),
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                source: 'WhatsApp',
                userId: finalUserId,
                userPhone: senderNumber,
                userName: message.from_name || "WhatsApp User",
                location: { address: "Pending...", lat: 0, lng: 0 }
            };

            await db.ref(`reports/${reportId}`).set(newReport);
            const deptKey = newReport.department.replace(/[\/\.#\$\[\]]/g, "_");
            await db.ref(`reports/by_department/${deptKey}/${reportId}`).set(newReport);

            await sendMessage(from,
                `✅ *Verified & Accepted*\n\nIssue: ${newReport.type}\nSeverity: ${newReport.priority}\n\nYour report has been sent to the authorities!\n\n📍 *Action Required:* Please reply with the *Location/Address* to finalize.`
            );
            return res.send('OK');
        }

        return res.send('OK');

    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).send("Error");
    }
};

// NEW: Create Community Helper
const createCommunity = async (name, participants) => {
    try {
        const response = await axios.post(`${WHAPI_URL}/groups`, {
            subject: name,
            participants: participants.map(p => p.replace(/\D/g, '')),
            description: "Community for local area alerts and civic reports."
        }, {
            headers: { Authorization: `Bearer ${WHAPI_TOKEN}` }
        });
        return response.data.group_id;
    } catch (error) {
        console.error("Whapi Community Creation Error:", error.message);
        return null;
    }
};

// Function to find an existing group by name
const findGroupByName = async (name) => {
    try {
        const response = await axios.get(`${WHAPI_URL}/groups`, {
            headers: { Authorization: `Bearer ${WHAPI_TOKEN}` }
        });
        // Whapi returns a list of groups; find one that matches the city name
        return response.data.groups.find(g => g.name.toLowerCase() === name.toLowerCase());
    } catch (error) {
        console.error("Error fetching groups:", error.message);
        return null;
    }
};

// Function to create a city subgroup and link it to the community
// Function to create a city subgroup and link it to the community
// Function to create a city subgroup and link it to the community
exports.joinCityCommunity = async (phone, cityName) => {
    try {
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

        let group = await findGroupByName(cityName);
        let groupId;

        if (!group) {
            console.log(`[WHAPI] Group for ${cityName} not found. Attempting to create...`);

            try {
                // Try creating with Admin Number first (most reliable if Admin != Bot)
                let adminPhone = (process.env.ADMIN_NUMBER || "").replace(/\D/g, '');
                if (adminPhone && adminPhone.length === 10) adminPhone = '91' + adminPhone;

                // If no admin phone, fallback to user phone
                const seedParticipant = adminPhone ? [adminPhone] : [cleanPhone];

                const newGroup = await axios.post(`${WHAPI_URL}/groups`, {
                    subject: `NagarAlertHub - ${cityName}`,
                    participants: seedParticipant
                }, { headers: { Authorization: `Bearer ${WHAPI_TOKEN}` } });
                groupId = newGroup.data.group_id;
                console.log(`[WHAPI] Created group ${cityName} (ID: ${groupId})`);

            } catch (createErr) {
                // Common Error: 400 Bad Request (Participants < 1) or 404 (Not in contacts)
                console.warn(`[WHAPI] Could not create group for ${cityName}. Reason: ${createErr.response?.data?.error?.details || createErr.message}`);
                console.warn("[WHAPI] Skipping community invite link. User verified but not added to group.");
                return null; // Exit gracefully
            }
        } else {
            console.log(`[WHAPI] Found existing group: ${cityName} (${group.id})`);
            groupId = group.id;
        }

        // Get INVITE LINK & Send DM
        // Get INVITE LINK & Send DM
        /* 
        if (groupId) {
            try {
                const inviteResponse = await axios.get(`${WHAPI_URL}/groups/${groupId}/invite`, {
                    headers: { Authorization: `Bearer ${WHAPI_TOKEN}` }
                });

                let inviteLink = inviteResponse.data.invite_link;
                if (!inviteLink && (inviteResponse.data.invite_code || inviteResponse.data.code)) {
                    inviteLink = `https://chat.whatsapp.com/${inviteResponse.data.invite_code || inviteResponse.data.code}`;
                }

                if (inviteLink) {
                     await sendMessage(cleanPhone,
                         `✅ Verification Complete!\n\n👋 *Welcome to Nagar Alert Hub*\n\nJoin your local *${cityName}* community group to receive alerts and report issues:\n${inviteLink}`
                     );
                    console.log(`[WHAPI] Invite link sent to ${cleanPhone}`);
                }
            } catch (inviteErr) {
                console.error("[WHAPI] Failed to get invite link:", inviteErr.message);
            }
        }
        */

        return groupId;
    } catch (error) {
        console.error("WhatsApp Community Error:", error.message);
        return null; // Ensure we never throw
    }
};

module.exports = {
    handleWebhook: exports.handleWebhook,
    sendManualBroadcast: exports.sendManualBroadcast,
    sendMessage,
    broadcastTargetedAlert,
    createCommunity,
    joinCityCommunity: exports.joinCityCommunity
};