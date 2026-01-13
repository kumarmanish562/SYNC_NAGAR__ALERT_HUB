import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

export const uploadImage = async (file, path) => {
    if (!file) return null;

    try {
        const formData = new FormData();
        formData.append('path', path || 'general');
        formData.append('file', file);

        const response = await fetch('http://127.0.0.1:5001/api/upload/image', {
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
