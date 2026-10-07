// crypto/crypto.js
// Phase 1 - AES-GCM Encryption & Decryption Prototype

const E2EECrypto = (() => {

    
    // creates the temporary symmetric key.
   
    async function generateTestKey() {

        const key = await crypto.subtle.generateKey(
            {
                name: "AES-GCM",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );

        return key;
    }


    
    // Encrypt a plaintext message
   
    async function encryptMessage(plaintext, key) {

        // Create a fresh IV for each message.
        const iv = crypto.getRandomValues(
            new Uint8Array(12)
        );

        // Convert normal text into bytes.
        const encoder = new TextEncoder();
        const plaintextBytes = encoder.encode(plaintext);

        // Encrypt using AES-GCM.
        const encryptedBuffer = await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv,
                tagLength: 128
            },
            key,
            plaintextBytes
        );

        // Create encrypted message payload.
        const payload = {
            version: 1,
            algorithm: "AES-GCM",
            iv: arrayBufferToBase64(iv),
            ciphertext: arrayBufferToBase64(encryptedBuffer)
        };

        return payload;
    }


    
    // Decrypt an encrypted payload
    
    async function decryptMessage(payload, key) {

        // Convert the Base64 payload back into bytes.
        const iv = new Uint8Array(
            base64ToArrayBuffer(payload.iv)
        );

        const ciphertext =
            base64ToArrayBuffer(payload.ciphertext);

        // Decrypt and verify the message.
        const decryptedBuffer =
            await crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: iv,
                    tagLength: 128
                },
                key,
                ciphertext
            );

        // Convert decrypted bytes back into normal text.
        const decoder = new TextDecoder();

        return decoder.decode(decryptedBuffer);
    }


    
    // Convert binary data to Base64
   
    function arrayBufferToBase64(buffer) {

        const bytes = new Uint8Array(buffer);

        let binary = "";

        for (const byte of bytes) {
            binary += String.fromCharCode(byte);
        }

        return btoa(binary);
    }


    // Convert Base64 back to binary data
    
    function base64ToArrayBuffer(base64) {

        const binary = atob(base64);

        const bytes =
            new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
            bytes[i] =
                binary.charCodeAt(i);
        }

        return bytes.buffer;
    }


   
    // Temporary Phase 1 self-test
    
    async function runSelfTest() {

        console.log(
            "========== AES-GCM TEST =========="
        );

        try {

            // Temporary symmetric test key.
            const key = await generateTestKey();

            const originalMessage =
                "Hello Bob! This is a secret message.";

            console.log(
                "Original message:",
                originalMessage
            );

            // Encrypt.
            const encryptedPayload =
                await encryptMessage(
                    originalMessage,
                    key
                );

            console.log(
                "Encrypted payload:",
                encryptedPayload
            );

            // Decrypt.
            const decryptedMessage =
                await decryptMessage(
                    encryptedPayload,
                    key
                );

            console.log(
                "Decrypted message:",
                decryptedMessage
            );

            const successful =
                originalMessage === decryptedMessage;

            console.log(
                "Encryption/decryption successful:",
                successful
            );

        } catch (error) {

            console.error(
                "AES-GCM test failed:",
                error
            );
        }
    }


    return {
        generateTestKey,
        encryptMessage,
        decryptMessage,
        runSelfTest
    };

})();


globalThis.E2EECrypto = E2EECrypto;
