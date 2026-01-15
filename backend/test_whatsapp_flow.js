const axios = require('axios');

async function testImageFlow() {
    try {
        console.log("Sending Mock Image Report...");
        // Use a real image URL that Gemini can access
        // Example: A random street image or something similar
        const imageUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Pothole.jpg/800px-Pothole.jpg";

        await axios.post('http://localhost:5001/api/whatsapp/webhook', {
            messages: [{
                from: "919999999999@s.whatsapp.net",
                from_name: "Test Citizen",
                type: "image",
                image: {
                    link: imageUrl,
                    caption: "Huge pothole on Main Street!"
                }
            }]
        });
        console.log("Successfully sent mock IMAGE report!");
    } catch (e) {
        console.error("Error sending webhook:", e.message);
        if (e.code === 'ECONNREFUSED') {
            console.log("Make sure your backend server is running on port 5001.");
        }
    }
}

testImageFlow();
