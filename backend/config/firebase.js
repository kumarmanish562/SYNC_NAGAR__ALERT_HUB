const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// You would typically replace this with the path to your serviceAccountKey.json file
// OR use environment variables to construct the credential object.
// For this setup, we'll assume environment variables or a placeholder structure.

// const serviceAccount = require("path/to/serviceAccountKey.json");

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: process.env.FIREBASE_DB_URL
// });

// Mock initialization if no credentials (to prevent crash during dev setup)
if (!admin.apps.length) {
    try {
        const path = require('path');
        const fs = require('fs');
        const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

        let config = {
            databaseURL: process.env.FIREBASE_DB_URL,
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET
        };

        if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = require(serviceAccountPath);
            config.credential = admin.credential.cert(serviceAccount);
            console.log("Firebase Admin Initialized using serviceAccountKey.json");
        } else {
            config.credential = admin.credential.applicationDefault();
            console.log("Firebase Admin Initialized using Application Default Credentials");
        }

        admin.initializeApp(config);
        console.log("Firebase Admin Successfully Initialized");
    } catch (error) {
        console.error("FIREBASE INITIALIZATION CRITICAL ERROR:", error);
        // Ensure we don't return undefined if possible, or at least log why
    }
}

const db = admin.database(); // Realtime Database
const auth = admin.auth();

module.exports = { admin, db, auth };