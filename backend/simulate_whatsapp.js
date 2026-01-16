const axios = require('axios');

// 1. The Local Server URL (Ensure getting the ngrok one or localhost)
const SERVER_URL = 'http://localhost:5001/api/whatsapp/webhook';

// 2. The Payload attempting to mimic Whapi structure exactly
const payload = {
    messages: [
        {
            chat_id: '919876543210@c.us',
            from: '919876543210@c.us',
            from_name: 'Test Citizen',
            type: 'image',
            image: {
                link: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Pothole.jpg/800px-Pothole.jpg', // A real public URL of a pothole
                caption: 'Big pothole here!'
            },
            timestamp: Math.floor(Date.now() / 1000)
        }
    ]
};

console.log("🚀 Simulating Incoming WhatsApp Message...");

axios.post(SERVER_URL, payload)
    .then(response => {
        console.log("✅ Webhook Received. Status:", response.status);
        console.log("👉 CHECK YOUR ADMIN DASHBOARD NOW!");
    })
    .catch(error => {
        console.error("❌ Simulation Failed:", error.message);
        if (error.response) {
            console.error("   Server Response:", error.response.data);
        }
    });
