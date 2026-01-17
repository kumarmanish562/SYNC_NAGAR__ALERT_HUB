// Real Backend Service
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

export const verifyImageWithAI = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64 = reader.result;
            try {
                const response = await fetch(`${API_BASE_URL}/api/reports/verify-image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageBase64: base64, type: 'general' })
                });
                const data = await response.json();
                if (response.ok) {
                    resolve({
                        explanation: data.analysis.description,
                        ai_confidence: data.analysis.confidence,
                        verified: data.analysis.isValid,
                        category: data.analysis.category
                    });
                } else {
                    console.error("Backend Error Detail:", data.details || data.error);
                    reject(new Error(data.error || "AI Analysis Failed"));
                }
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
    });
};

export const submitReportToBackend = async (data) => {
    const response = await fetch(`${API_BASE_URL}/api/reports/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Failed to create report");
    return result;
};