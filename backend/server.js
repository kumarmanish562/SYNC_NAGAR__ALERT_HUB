const express = require('express');
require('dotenv').config(); // Load env vars immediately
const cors = require('cors');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = 5001;

// Middleware
app.use(cors({
    origin: 'http://localhost:5173', // Vite default port
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Routes
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/whatsapp', require('./routes/whatsappRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));

app.get('/', (req, res) => {
    res.send('Nagar Alert Hub Backend is Running');
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(`[SERVER ERROR] ${req.method} ${req.url}:`, err);
    res.status(500).json({
        error: "Internal Server Error",
        message: err.message,
        path: req.url
    });
});

// Start Server
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);

    // Debug Gemini Models
    try {
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // listModels is not a direct function in the main SDK usually, 
        // but we can at least confirm the key is present.
        if (process.env.GEMINI_API_KEY) {
            console.log("Gemini API Key detected.");
        }
    } catch (e) { }
});
