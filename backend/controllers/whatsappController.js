const { analyzeImageForReport } = require('../services/aiService');
const axios = require('axios');
const { db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

// Helper to download media
async function downloadMedia(url) {
    try {
        const config = { responseType: 'arraybuffer' };
        if (process.env.WHAPI_TOKEN) {
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
        // console.log("RAW PAYLOAD:", JSON.stringify(data, null, 2)); // Uncomment for deep debug

        const message = data.messages?.[0];
        if (!message) return res.send('OK');

        // IGNORE OUTGOING MESSAGES (Sent by Bot)
        if (message.from_me) return res.send('OK');

        const from = message.chat_id || message.from; // Reply Destination
        const senderRaw = message.from; // User who sent it
        const isGroup = from.includes('@g.us');
        const senderNumber = senderRaw.split('@')[0];
        const type = message.type;
        const body = message.text?.body || "";

        console.log(`[WEBHOOK] Chat: ${from}, Sender: ${senderNumber} (Raw: ${senderRaw}), Group: ${isGroup}, Type: ${type}`);
        console.log(`[WEBHOOK] Message Body:`, body);

        // --- 1. ADMIN COMMANDS (VERIFY / REJECT) ---
        const cleanAdmin = (ADMIN_NUMBER || "").replace(/\D/g, '');
        if (senderNumber === cleanAdmin) {
            if (body.startsWith("VERIFY")) {
                const reportId = body.split(" ")[1];
                if (reportId) {
                    const reportInfoSnap = await db.ref(`reports/${reportId}`).once('value');
                    const report = reportInfoSnap.val();

                    if (!report) {
                        await sendMessage(from, `⚠️ Report ${reportId} not found.`);
                        return res.send('OK');
                    }

                    // Update Status
                    await db.ref(`reports/${reportId}`).update({ status: 'Accepted' });

                    if (report.department) {
                        const deptKey = report.department.replace(/[\/\.#\$\[\]]/g, "_");
                        await db.ref(`reports/by_department/${deptKey}/${reportId}`).update({ status: 'Accepted' });
                    }

                    await sendMessage(from, `✅ Report ${reportId} accepted.`);

                    if (report.userId && report.source === 'WhatsApp') {
                        // Use userPhone if available, otherwise check if userId looks like a phone number
                        const targetPhone = report.userPhone || (report.userId.match(/^\d+$/) ? report.userId : null);

                        if (targetPhone && !from.includes(targetPhone)) {
                            await sendMessage(targetPhone, `✅ Update: Your report (ID: ${reportId}) has been VERIFIED and accepted by the authorities.`);
                        }
                    }

                    // Broadcasts
                    const address = report?.location?.address || "";
                    const targetArea = address.split(',')[1] || address.split(',')[0] || "General";
                    const alertMessage = `🚨 *High Priority Alert in ${targetArea}*\n\nAdmin has verified a report (ID: ${reportId.slice(0, 6)}). Emergency teams dispatched to your area.`;

                    await broadcastTargetedAlert(targetArea.trim(), alertMessage);

                    const cityGroup = await findGroupByName(targetArea.trim());
                    if (cityGroup) {
                        await sendMessage(cityGroup.id, alertMessage);
                        console.log(`[COMMUNITY] Msg sent to group ${cityGroup.id}`);
                    }

                    if (report.groupId && report.groupId !== cityGroup?.id) {
                        await sendMessage(report.groupId, `✅ *Report Verified*\n\nThe report submitted here (ID: ${reportId.slice(0, 6)}) has been verified by Admin.`);
                    }
                }
                return res.send('OK');
            } else if (body.startsWith("REJECT")) {
                const reportId = body.split(" ")[1];
                if (reportId) {
                    // Fetch report to notify user
                    const reportSnap = await db.ref(`reports/${reportId}`).once('value');
                    const report = reportSnap.val();

                    // Update Status
                    await db.ref(`reports/${reportId}`).update({ status: 'Rejected' });

                    if (report && report.department) {
                        const deptKey = report.department.replace(/[\/\.#\$\[\]]/g, "_");
                        await db.ref(`reports/by_department/${deptKey}/${reportId}`).update({ status: 'Rejected' });
                    }

                    // Notify Admin
                    await sendMessage(from, `❌ Report ${reportId} rejected.`);

                    // Notify User
                    if (report && report.userId && report.source === 'WhatsApp') {
                        const targetPhone = report.userPhone || (report.userId.match(/^\d+$/) ? report.userId : null);
                        if (targetPhone && !from.includes(targetPhone)) {
                            await sendMessage(targetPhone, `❌ Update: Your report (ID: ${reportId}) has been REJECTED. It may not meet the criteria or is duplicate.`);
                        }
                    }
                }
                return res.send('OK');
            }
        }

        // --- 2. CITIZEN REPORT FLOW ---

        if (type === 'image' || type === 'video') {
            const isVideo = type === 'video';
            const mediaUrl = isVideo ? message.video?.link : message.image?.link;

            await sendMessage(from, "🔍 Analyzing image for authenticity... Please wait.");

            let aiResult = null;
            if (!isVideo && mediaUrl) {
                // 1. Download Image
                const imageBase64 = await downloadMedia(mediaUrl);

                if (imageBase64) {
                    // 2. Strict AI Forensic Check (Vertex AI)
                    console.log(`[AI] Verifying image authenticity...`);
                    const verification = await analyzeImageForReport(imageBase64);
                    console.log("[AI RESULT]", verification);

                    // 3. REJECT if Fake
                    if (!verification.isReal) {
                        await sendMessage(from,
                            `⚠️ *Report Rejected*\n\nOur system detected this image might be fake or AI-generated: _${verification.fakeReason}_\n\nPlease upload a *real, original photo* taken at the location.`
                        );
                        return res.send('OK');
                    }

                    // 4. Accept if Real - Map to Report Data
                    aiResult = {
                        category: verification.issue || "General",
                        description: verification.issue ? `Verified Issue: ${verification.issue}` : "Civic Report",
                        priority: verification.severity || "Medium",
                        confidence: 99
                    };
                }
            }

            const caption = (isVideo ? message.video?.caption : message.image?.caption) || message.text?.body || "Report via WhatsApp";

            // Generate Safe Report ID
            let reportId = uuidv4();
            if (!reportId) reportId = `REP-${Date.now()}`;

            console.log(`[DEBUG] Creating Report ID: ${reportId}`);

            // LOOKUP LINKED USER ID (FIREBASE UID)
            let finalUserId = senderNumber;
            const linkedUid = await findUidByMobile(senderNumber);
            if (linkedUid) {
                console.log(`[DEBUG] Found linked Firebase UID: ${linkedUid} for mobile ${senderNumber}`);
                finalUserId = linkedUid; // Use UID so it shows in Dashboard
            }

            const newReport = {
                id: reportId,
                type: aiResult?.category || 'General',
                description: aiResult?.description || caption,
                imageUrl: mediaUrl || "https://via.placeholder.com/300",
                mediaType: isVideo ? 'video' : 'image',
                department: aiResult?.category || 'Municipal Waste',
                status: 'Pending Address',
                priority: aiResult?.priority || 'Medium',
                aiConfidence: aiResult?.confidence || 0,
                aiAnalysis: aiResult ? JSON.stringify(aiResult) : "Not Analyzed",
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                source: 'WhatsApp',
                userId: finalUserId,
                userPhone: senderNumber, // Backup for WhatsApp Notifs
                groupId: isGroup ? from : null,
                userName: message.from_name || "WhatsApp User",
                location: {
                    address: "Pending...",
                    lat: 0,
                    lng: 0
                }
            };

            await db.ref(`reports/${reportId}`).set(newReport);

            const deptKey = (newReport.department || "General").replace(/[\/\.#\$\[\]]/g, "_");
            await db.ref(`reports/by_department/${deptKey}/${reportId}`).set(newReport);

            await sendMessage(from,
                `✅ *Verified & Accepted*\n\nIssue: ${newReport.department}\nSeverity: ${newReport.priority}\n\nYour report has been sent to the authorities!\n\n📍 *Action Required:* Please reply with the Location/Address to finalize.`
            );

            return res.send('OK');
        }
        else if (type === 'text') {
            const reportsRef = db.ref('reports');

            let snapshot = null;
            // 1. Try to find by userPhone (most reliable for WhatsApp reports)
            snapshot = await reportsRef.orderByChild('userPhone').equalTo(senderNumber).limitToLast(1).once('value');

            // 2. If not found, try by userId (which could be phone or UID)
            if (!snapshot.exists()) {
                snapshot = await reportsRef.orderByChild('userId').equalTo(senderNumber).limitToLast(1).once('value');
            }

            // 3. If still not found, and senderNumber is linked to a UID, try by UID
            if (!snapshot.exists()) {
                const linkedUid = await findUidByMobile(senderNumber);
                if (linkedUid) {
                    snapshot = await reportsRef.orderByChild('userId').equalTo(linkedUid).limitToLast(1).once('value');
                }
            }

            let addressUpdated = false;

            if (snapshot.exists()) {
                const data = snapshot.val();
                // Get the actual report object, handling potential Firebase snapshot structure
                const reportKey = Object.keys(data)[0];
                const report = data[reportKey];
                const reportId = report.id; // Ensure we use the 'id' field from the report object

                const isRecent = (new Date() - new Date(report.createdAt)) < 15 * 60 * 1000;

                if (report.status === 'Pending Address' && isRecent) {
                    const newAddress = body;
                    await db.ref(`reports/${reportId}`).update({
                        'location/address': newAddress,
                        status: 'Pending'
                    });
                    const deptKey = (report.department || "General").replace(/[\/\.#\$\[\]]/g, "_");
                    await db.ref(`reports/by_department/${deptKey}/${reportId}`).update({
                        'location/address': newAddress,
                        status: 'Pending'
                    });

                    await sendMessage(from, `✅ *Location Saved: ${newAddress}*\n\nReport ID: ${reportId}\nStatus: Verification Pending.\n\n(We will notify you when verified)`);
                    await sendMessage(ADMIN_NUMBER, `🚨 *New Citizen Report (Complete)*\nID: ${reportId}\nFrom: ${senderNumber}\nDept: ${report.department}\nDesc: ${report.description}\n📍 Location: ${newAddress}\nConfidence: ${report.aiConfidence}%\nImage: ${report.imageUrl}\n\n✅ Reply: VERIFY ${reportId} OR REJECT ${reportId}`);

                    addressUpdated = true;
                }
            }

            if (addressUpdated) return res.send('OK');

            // If Group message and NOT an address update, IGNORE it (Spam Prevention)
            if (isGroup) {
                console.log(`[IGNORED] Group text from ${senderNumber} in ${from}`);
                return res.send('OK');
            }

            // Normal DM logic
            if (body.toLowerCase().includes('hi') || body.toLowerCase().includes('start')) {
                await sendMessage(from, `👋 Welcome to Nagar Alert Hub!\n\nI can help you report civic issues instantly.\n\n📸 *Please send a photo or video of the incident.*`);
            }
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