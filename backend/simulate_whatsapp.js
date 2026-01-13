const axios = require('axios');

async function test() {
    try {
        console.log("Sending Mock Video Report...");
        await axios.post('http://localhost:5001/api/whatsapp/webhook', {
            messages: [{
                from: "919334170932@s.whatsapp.net",
                from_name: "Test Citizen",
                type: "video",
                video: {
                    link: "https://www.w3schools.com/html/mov_bbb.mp4",
                    caption: "Big Buck Bunny spotted in Sector 4!"
                }
            }]
        });
        console.log("Successfully sent mock video report! Check your Admin Dashboard.");
    } catch (e) {
        console.error("Error sending webhook:", e.message);
        if (e.code === 'ECONNREFUSED') {
            console.log("Make sure your backend server is running on port 5001.");
        }
    }
}
test();
