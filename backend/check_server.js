
const http = require('http');

const checkEndpoint = (path, name) => {
    const options = {
        hostname: '127.0.0.1',
        port: 5001,
        path: path,
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        if (res.statusCode === 404) {
            console.log(`❌ [FAIL] Endpoint '${name}' (${path}) is MISSING (404). Server Code is OLD.`);
        } else {
            // 405 Method Not Allowed is GOOD because it means the route exists (usually POST only)
            // 200 OK is GOOD
            // 500 Error is GOOD (means code is running even if crashing)
            console.log(`✅ [PASS] Endpoint '${name}' is detected (Status: ${res.statusCode}). Server Code is UP-TO-DATE.`);
        }
    });

    req.on('error', (e) => {
        console.log(`❌ [FAIL] Server is NOT RUNNING on port 5001.`);
    });

    req.end();
};

console.log("Checking Server Health...");
checkEndpoint('/api/upload/image', 'Upload Image'); // Should be 200 or 405, NOT 404
checkEndpoint('/api/whatsapp/webhook', 'WhatsApp Webhook'); // Should be 200 or 405, NOT 404
