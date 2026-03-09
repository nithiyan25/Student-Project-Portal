import CryptoJS from 'crypto-js';

// The secret key should ideally be an environment variable.
// Using a fallback for local development simplicity.
const SECRET_KEY = import.meta.env.VITE_APP_SECRET || 'spp-local-storage-secret-key-2026';

export const encryptData = (data) => {
    try {
        if (!data) return null;
        const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
        const encrypted = CryptoJS.AES.encrypt(jsonString, SECRET_KEY).toString();
        return encrypted;
    } catch (error) {
        console.error("Error encrypting data", error);
        return null;
    }
};

export const decryptData = (encryptedData) => {
    try {
        if (!encryptedData) return null;

        try {
            // Attempt to decrypt first
            const decrypted = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
            const jsonString = decrypted.toString(CryptoJS.enc.Utf8);

            if (jsonString) {
                return JSON.parse(jsonString);
            }
        } catch (e) {
            // Ignore decryption error, fallback to flat JSON
        }

        // Fallback: If decryption failed (likely because data was stored before encryption was added),
        // check if it's already plain JSON
        return JSON.parse(encryptedData);
    } catch (error) {
        console.warn("Could not parse data (possibly corrupted):", error);
        return null;
    }
};
