const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadImage } = require('../controllers/uploadController');

// Configure Multer for Memory Storage (so we can pass buffer to Firebase)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Apply middleware
router.post('/image', upload.single('file'), uploadImage);

module.exports = router;
