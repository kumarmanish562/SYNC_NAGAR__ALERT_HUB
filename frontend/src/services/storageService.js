import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

export const uploadImage = async (file, path) => {
    if (!file) return null;

    try {
        const formData = new FormData();
        formData.append('path', path || 'general');
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/api/upload/image`, {
            method: 'POST',
            body: formData
            // Note: Content-Type header is NOT set manually; browser sets it with boundary for FormData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Upload failed");
        }

        return data.url;

    } catch (error) {
        console.error("Backend Proxy Upload Failed:", error);
        throw error;
    }
};
