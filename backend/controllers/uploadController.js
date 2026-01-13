const { admin } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

exports.uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image file provided" });
        }

        const bucket = admin.storage().bucket();
        const mimeType = req.file.mimetype;
        const buffer = req.file.buffer;

        // "path" comes from req.body when using FormData
        const folderPath = req.body.path || 'general';
        const filename = `${folderPath}/${uuidv4()}.jpg`;
        const file = bucket.file(filename);

        await file.save(buffer, {
            metadata: {
                contentType: mimeType,
            },
            public: true // Make file public directly
        });

        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: '03-01-2500' // Far future
        });

        res.status(200).json({ url });

    } catch (error) {
        console.error("Server Upload Error:", error);
        res.status(500).json({ error: "Failed to upload image", details: error.message });
    }
};
