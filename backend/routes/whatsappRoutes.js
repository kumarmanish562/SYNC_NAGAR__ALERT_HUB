const express = require('express');
const router = express.Router();
const { handleWebhook, sendManualBroadcast } = require('../controllers/whatsappController');

// Webhook endpoint for Whapi
router.post('/webhook', handleWebhook);
router.get('/webhook', (req, res) => res.send('Webhook Active'));

// Manual Broadcast from Dashboard
router.post('/send-broadcast', sendManualBroadcast);

module.exports = router;