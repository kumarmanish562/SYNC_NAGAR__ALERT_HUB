const axios = require('axios');

async function testBot() {
    try {
        console.log("Simulating incoming WhatsApp message 'Start'...");
        await axios.post('http://localhost:5001/api/whatsapp/webhook', {
            messages: [
                {
                    from: "919876543210@s.whatsapp.net",
                    type: "text",
                    text: { body: "Start" }
                }
            ]
        });
        console.log("Simulation 1 (Start) Sent. Check your backend console for logs.");

        // Wait a bit
        await new Promise(r => setTimeout(r, 2000));

        console.log("Simulating incoming WhatsApp Image...");
        await axios.post('http://localhost:5001/api/whatsapp/webhook', {
            messages: [
                {
                    from: "919876543210@s.whatsapp.net",
                    type: "image",
                    image: {
                        link: "https://via.placeholder.com/150",
                        caption: "Fix this pothole"
                    }
                }
            ]
        });
        console.log("Simulation 2 (Image) Sent. Check your backend console for logs.");

    } catch (error) {
        console.error("Test Failed. Is your backend server running on port 5001?", error.message);
    }
}

testBot();
