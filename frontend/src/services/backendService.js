// Real Backend Service
export const verifyImageWithAI = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64 = reader.result;
            try {
                const response = await fetch('http://127.0.0.1:5001/api/reports/verify-image', {
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
    const response = await fetch('http://127.0.0.1:5001/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Failed to create report");
    return result;
};