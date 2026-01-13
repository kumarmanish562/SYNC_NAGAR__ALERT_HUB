const { db, auth } = require('../config/firebase');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../debug_errors.log');
const logError = (context, err) => {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] ${context}: ${err.message}\n${err.stack}\n\n`;
    fs.appendFileSync(logFile, message);
    console.error(message);
};

// Initialize Twilio
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = new twilio(accountSid, authToken);

// Temporary in-memory OTP store (Use Redis for production)
const otpStore = {};

// Helper to sanitize keys for Firebase (Removes characters like / . # $ [ ])
const sanitizeKey = (key) => {
    if (!key) return "General";
    return key.replace(/[\/\.#\$\[\]]/g, "_");
};

exports.registerUser = async (req, res) => {
    const { email, password, firstName, lastName, mobile, address, role, department, profilePic } = req.body;
    console.log(`[REGISTER] New user: ${email}, Role: ${role}, Address: ${address}`);

    try {
        // 1. Create User in Firebase Auth
        const userRecord = await auth.createUser({
            email,
            password,
            displayName: `${firstName} ${lastName}`,
            photoURL: profilePic || undefined,
            phoneNumber: mobile ? `+91${mobile}` : undefined, // Ensure format
        });

        const uid = userRecord.uid;

        // 2. Save Full Registry Details (users/registry)
        const registryRef = db.ref(`users/registry/${uid}`);
        await registryRef.set({
            uid,
            firstName,
            lastName,
            email,
            mobile,
            address,
            role,
            profilePic: profilePic || null,
            department: department || null,
            createdAt: new Date().toISOString()
        });

        // 3. Save Broadcast Details (users/broadcast_list)
        const broadcastRef = db.ref(`users/broadcast_list/${uid}`);
        await broadcastRef.set({
            name: `${firstName} ${lastName}`,
            mobile,
            address,
            role,
            profilePic: profilePic || null
        });

        // 4. Save Profile based on role
        if (role === 'admin') {
            const adminData = {
                uid,
                firstName,
                lastName,
                email,
                mobile,
                role,
                department,
                profilePic: profilePic || null,
                joinedAt: new Date().toISOString(),
            };
            const adminRef = db.ref(`users/admins/${uid}`);
            await adminRef.set(adminData);

            if (department) {
                const sanitizedDept = sanitizeKey(department);
                const deptAdminRef = db.ref(`users/admins_by_dept/${sanitizedDept}/${uid}`);
                await deptAdminRef.set(adminData);
            }
        } else {
            const citizenRef = db.ref(`users/citizens/${uid}`);
            await citizenRef.set({
                firstName,
                lastName,
                email,
                mobile,
                address,
                profilePic: profilePic || null,
                role,
                points: 0,
                level: 1,
                reportsCount: 0,
                joinedAt: new Date().toISOString(),
            });
        }

        res.status(201).json({ message: 'User registered successfully', uid });

    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.loginUser = async (req, res) => {
    // In a managed backend flow, the client often signs in with SDK and sends ID Token.
    // However, if we handle login here, we'd need to use the REST API or client SDK on backend (not recommended).
    // Typically, the frontend gets the token, and backend verifies it.

    // For this mock/hybrid setup:
    res.status(200).json({ message: "Login logic placeholders. Use Client SDK to get token, then verify here." });
};

exports.googleLogin = async (req, res) => {
    const { idToken } = req.body;
    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const email = decodedToken.email;
        const name = decodedToken.name;

        // Ensure user exists in our DBs
        const registryRef = db.ref(`users/registry/${uid}`);
        const snapshot = await registryRef.once('value');

        if (!snapshot.exists()) {
            // New Google User - Create default entries
            await registryRef.set({
                uid,
                firstName: name.split(' ')[0],
                lastName: name.split(' ').slice(1).join(' '),
                email,
                role: 'citizen', // Default
                address: 'No address set',
                createdAt: new Date().toISOString()
            });

            // Add to broadcast list
            const broadcastRef = db.ref(`users/broadcast_list/${uid}`);
            await broadcastRef.set({
                name,
                email,
                role: 'citizen',
                address: 'No address set'
            });

            // Add to citizens list for gamification - UPDATED with Full Profile
            const citizenRef = db.ref(`users/citizens/${uid}`);
            await citizenRef.set({
                firstName: name.split(' ')[0],
                lastName: name.split(' ').slice(1).join(' '),
                email, // Added email
                address: 'No address set',
                points: 0,
                level: 1,
                reportsCount: 0,
                joinedAt: new Date().toISOString()
            });
        }

        res.status(200).json({ message: "Google login verified", uid, user: decodedToken });
    } catch (error) {
        res.status(401).json({ error: "Invalid Token" });
    }
};

// Initialize Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

exports.sendOtp = async (req, res) => {
    let { type, contact } = req.body;
    contact = contact ? contact.trim().toLowerCase() : "";

    if (type === 'email') {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[contact] = otp;

        // Log to file for debugging
        fs.appendFileSync(path.join(__dirname, '../debug_otp.log'), `[SEND] Email: ${contact} | OTP: ${otp} | Time: ${new Date().toISOString()}\n`);

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: contact,
            subject: 'Nagar Alert Hub - Email Verification',
            text: `Your Verification OTP is: ${otp}`
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`[NODEMAILER] Sent OTP to ${contact}`);
            res.status(200).json({ message: "OTP sent to email successfully" });
        } catch (error) {
            console.error("Nodemailer Error:", error);
            res.status(500).json({ error: "Failed to send email OTP", details: error.message });
        }

    } else if (type === 'mobile') {
        try {
            const phoneNumber = contact.startsWith('+') ? contact : `+91${contact}`;
            const serviceSid = process.env.TWILIO_SERVICE_SID;

            const verification = await twilioClient.verify.v2.services(serviceSid)
                .verifications
                .create({ to: phoneNumber, channel: 'sms' });

            console.log(`[TWILIO VERIFY] Sent to ${phoneNumber}: ${verification.sid}`);
            res.status(200).json({ message: "OTP sent via Twilio Verify", sid: verification.sid });
        } catch (error) {
            console.error("Twilio Verify Error Details:", {
                message: error.message,
                code: error.code,
                moreInfo: error.moreInfo,
                status: error.status
            });
            res.status(500).json({
                error: "Failed to send OTP",
                details: error.message,
                debugCode: error.code
            });
        }
    } else {
        res.status(400).json({ error: "Invalid verification type" });
    }
};

exports.verifyOtp = async (req, res) => {
    let { contact, otp, uid } = req.body;
    contact = contact ? contact.trim().toLowerCase() : "";

    console.log(`[VERIFY-OTP] Incoming: Contact=${contact}, OTP=${otp}, UID=${uid}`);

    if (!uid) {
        console.warn("[VERIFY-OTP] Missing UID in request body");
        return res.status(400).json({ error: "UID is required for session generation" });
    }

    // Check if it's email (Mock) or Mobile (Twilio)
    if (contact.includes('@')) {
        // Master OTP for Dev/Testing to bypass issues
        if (otp === '123456') {
            console.log(`[VERIFY-OTP] Master OTP used for ${contact}`);
            try {
                const token = await auth.createCustomToken(uid);
                return res.status(200).json({ message: "Master OTP Verified", token });
            } catch (err) {
                logError("VERIFY-OTP (Master Token)", err);
                return res.status(500).json({ error: "Failed to create custom token" });
            }
        }

        const storedOtp = otpStore[contact];
        fs.appendFileSync(path.join(__dirname, '../debug_otp.log'), `[VERIFY] Email: ${contact} | Input: ${otp} | Stored: ${storedOtp} | Time: ${new Date().toISOString()}\n`);

        if (storedOtp === otp) {
            delete otpStore[contact];
            try {
                const token = await auth.createCustomToken(uid);
                res.status(200).json({ message: "OTP Verified Successfully", token });
            } catch (err) {
                logError("VERIFY-OTP (Email Token)", err);
                res.status(500).json({ error: "Failed to create custom token" });
            }
        } else {
            console.warn(`[VERIFY-OTP] Mismatch! Sent: ${otp}, Stored: ${storedOtp}`);
            res.status(400).json({ error: "Invalid OTP" });
        }
    } else {
        // Mobile Verification via Twilio
        try {
            const phoneNumber = contact.startsWith('+') ? contact : `+91${contact}`;
            const serviceSid = process.env.TWILIO_SERVICE_SID;

            const verificationCheck = await twilioClient.verify.v2.services(serviceSid)
                .verificationChecks
                .create({ to: phoneNumber, code: otp });

            console.log(`[VERIFY-OTP] Twilio Status: ${verificationCheck.status}`);

            if (verificationCheck.status === 'approved') {
                const token = await auth.createCustomToken(uid);
                res.status(200).json({ message: "OTP Verified Successfully", token });
            } else {
                res.status(400).json({ error: "Invalid OTP or Expired" });
            }
        } catch (error) {
            logError("VERIFY-OTP (Twilio)", error);
            res.status(500).json({ error: "Verification system error", details: error.message });
        }
    }
};

// Sync/Repair User Profile (Called by frontend if data is missing)
exports.syncUserProfile = async (req, res) => {
    const { uid } = req.body;
    console.log(`[SYNC] Start Sync for UID: ${uid}`);

    if (!uid) {
        console.warn("[SYNC] No UID in request body");
        return res.status(400).json({ error: "UID is required for profile sync" });
    }

    if (!db) {
        console.error("[SYNC] FATAL: DB instance is missing!");
        return res.status(500).json({ error: "Database configuration error" });
    }

    try {
        // 1. Get Registry Data (Source of Truth)
        console.log(`[SYNC] Fetching registry node...`);
        const registryRef = db.ref(`users/registry/${uid}`);
        const regSnap = await registryRef.once('value');

        if (!regSnap.exists()) {
            console.warn(`[SYNC] Critical Error: UID ${uid} not found in users/registry`);
            return res.status(404).json({ error: "User profile not initialized in registry" });
        }

        const regData = regSnap.val();
        const role = regData.role || 'citizen';

        // 2. Resolve target path
        const targetPath = role === 'admin' ? `users/admins/${uid}` : `users/citizens/${uid}`;
        const targetRef = db.ref(targetPath);
        const targetSnap = await targetRef.once('value');
        const currentData = targetSnap.exists() ? targetSnap.val() : {};

        // 3. Merge & Update
        const updatedData = {
            ...currentData,
            ...regData, // Preferred registry data
            syncedAt: new Date().toISOString()
        };

        // Ensure citizen defaults
        if (role === 'citizen') {
            if (updatedData.points === undefined) updatedData.points = 0;
            if (updatedData.level === undefined) updatedData.level = 1;
            if (updatedData.reportsCount === undefined) updatedData.reportsCount = 0;
        }

        await targetRef.set(updatedData);

        // Also sync to department-wise path for admins
        if (role === 'admin' && updatedData.department) {
            const sanitizedDept = sanitizeKey(updatedData.department);
            const deptAdminRef = db.ref(`users/admins_by_dept/${sanitizedDept}/${uid}`);
            await deptAdminRef.set(updatedData);
        }

        res.status(200).json({ message: "Profile synced successfully", data: updatedData });

    } catch (error) {
        logError(`SYNC-PROFILE (UID: ${uid})`, error);
        res.status(500).json({ error: "Internal sync failure", details: error.message });
    }
};

