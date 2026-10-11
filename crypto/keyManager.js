const E2EEKeyManager = (() => {
    "use strict";

    const CURVE = "P-256";
    const HASH = "SHA-256";
    const AES_ALGORITHM = "AES-GCM";
    const AES_KEY_LENGTH = 256;
    const SESSION_VERSION = 1;
    const PROTOCOL_LABEL = "E2EEwebMsgExtension/phase1/v1";
    const SALT_BYTES = 32;
    const SESSION_ID_BYTES = 16;

    const PUBLIC_KEY_FORMAT = "E2EEwebMsgExtension-public-key";
    const PUBLIC_KEY_FORMAT_VERSION = 1;
    const DB_NAME = "E2EEwebMsgExtensionKeyStore";
    const DB_VERSION = 1;
    const DB_STORE = "keyRecords";
    const IDENTITY_RECORD_ID = "local-identity";
    const PEER_RECORD_ID = "current-peer"; // Phase 1 MVP supports one manually imported peer.

    function requireSubtleCrypto() {
        if (!globalThis.crypto || !globalThis.crypto.subtle) {
            throw new Error("Web Crypto API is unavailable. Open the extension popup in a supported browser.");
        }
    }

    function requireIndexedDB() {
        if (!globalThis.indexedDB) {
            throw new Error("IndexedDB is unavailable; the local identity key cannot be persisted safely.");
        }
    }

    function bytesToBase64(value) {
        const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    function base64ToBytes(value, fieldName) {
        if (typeof value !== "string" || value.length === 0) {
            throw new TypeError(`${fieldName} must be a non-empty Base64 string.`);
        }
        let binary;
        try {
            binary = atob(value);
        } catch {
            throw new TypeError(`${fieldName} is not valid Base64.`);
        }
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    function openDatabase() {
        requireIndexedDB();
        return new Promise((resolve, reject) => {
            const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(DB_STORE)) {
                    db.createObjectStore(DB_STORE, { keyPath: "id" });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error("Could not open the local key store."));
            request.onblocked = () => reject(new Error("The local key store upgrade is blocked by another extension page."));
        });
    }

    async function dbGet(id) {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(DB_STORE, "readonly");
            const request = transaction.objectStore(DB_STORE).get(id);
            let value = null;
            request.onsuccess = () => { value = request.result || null; };
            request.onerror = () => reject(request.error || new Error("Could not read from the local key store."));
            transaction.oncomplete = () => { db.close(); resolve(value); };
            transaction.onerror = () => { db.close(); reject(transaction.error || new Error("Could not read from the local key store.")); };
            transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Local key-store read was aborted.")); };
        });
    }

    async function dbPut(record) {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(DB_STORE, "readwrite");
            transaction.objectStore(DB_STORE).put(record);
            transaction.oncomplete = () => { db.close(); resolve(); };
            transaction.onerror = () => { db.close(); reject(transaction.error || new Error("Could not save to the local key store.")); };
            transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Local key-store write was aborted.")); };
        });
    }

    function validateEcdhKey(key, expectedType, name) {
        if (!key || key.type !== expectedType || key.algorithm?.name !== "ECDH" || key.algorithm?.namedCurve !== CURVE) {
            throw new TypeError(`${name} must be an ECDH ${CURVE} ${expectedType} CryptoKey.`);
        }
    }

    function validatePublicJwk(jwk) {
        if (!jwk || typeof jwk !== "object" || Array.isArray(jwk)) {
            throw new TypeError("Public key must be a JWK object.");
        }
        if (jwk.kty !== "EC" || jwk.crv !== CURVE || typeof jwk.x !== "string" || typeof jwk.y !== "string") {
            throw new TypeError(`Public key must be an EC ${CURVE} JWK containing x and y coordinates.`);
        }
        if (Object.prototype.hasOwnProperty.call(jwk, "d")) {
            throw new TypeError("Refusing a public-key JWK that contains private key material.");
        }
    }

    // Return a minimal, predictable public JWK; never include a private 'd' value.
    async function exportPublicKey(publicKey) {
        requireSubtleCrypto();
        validateEcdhKey(publicKey, "public", "publicKey");
        const jwk = await globalThis.crypto.subtle.exportKey("jwk", publicKey);
        validatePublicJwk(jwk);
        return {
            kty: "EC",
            crv: CURVE,
            x: jwk.x,
            y: jwk.y,
            ext: true,
            key_ops: []
        };
    }

    async function fingerprintPublicJwk(jwk) {
        requireSubtleCrypto();
        validatePublicJwk(jwk);
        const canonical = new TextEncoder().encode(`${jwk.kty}|${jwk.crv}|${jwk.x}|${jwk.y}`);
        const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", canonical));
        return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("").match(/.{2}/g).join(":").toUpperCase();
    }

    // Produces the text that the user can copy and give to another user.
    async function exportPublicKeyBundle(publicKey) {
        const jwk = await exportPublicKey(publicKey);
        const fingerprint = await fingerprintPublicJwk(jwk);
        return JSON.stringify({
            format: PUBLIC_KEY_FORMAT,
            version: PUBLIC_KEY_FORMAT_VERSION,
            algorithm: "ECDH",
            curve: CURVE,
            publicKey: jwk,
            fingerprint
        }, null, 2);
    }

    function parsePublicKeyInput(input) {
        let value = input;
        if (typeof value === "string") {
            try {
                value = JSON.parse(value);
            } catch {
                throw new TypeError("Public key text is not valid JSON. Copy the complete public-key bundle.");
            }
        }
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new TypeError("Public key input must be a JSON object or JSON string.");
        }

        // Preferred, versioned exchange format.
        if (value.format !== undefined) {
            if (value.format !== PUBLIC_KEY_FORMAT) throw new TypeError("Unrecognised public-key bundle format.");
            if (value.version !== PUBLIC_KEY_FORMAT_VERSION) throw new TypeError("Unsupported public-key bundle version.");
            if (value.algorithm !== "ECDH" || value.curve !== CURVE) throw new TypeError(`Bundle must use ECDH ${CURVE}.`);
            validatePublicJwk(value.publicKey);
            return { jwk: value.publicKey, fingerprint: value.fingerprint || null, bundle: value };
        }

        // Accept a bare JWK for developer/test compatibility, but the popup exports bundles.
        validatePublicJwk(value);
        return { jwk: value, fingerprint: null, bundle: null };
    }

    async function importPeerPublicKey(input) {
        requireSubtleCrypto();
        const parsed = parsePublicKeyInput(input);
        const actualFingerprint = await fingerprintPublicJwk(parsed.jwk);
        if (parsed.fingerprint && parsed.fingerprint !== actualFingerprint) {
            throw new Error("Public-key fingerprint does not match the key data; do not import this bundle.");
        }
        return globalThis.crypto.subtle.importKey(
            "jwk",
            parsed.jwk,
            { name: "ECDH", namedCurve: CURVE },
            false,
            []
        );
    }

    // Generate a local identity key pair. Do not export or transmit the private key.
    async function generateIdentityKeyPair() {
        requireSubtleCrypto();
        return globalThis.crypto.subtle.generateKey(
            { name: "ECDH", namedCurve: CURVE },
            false, // private key is non-extractable
            ["deriveBits"]
        );
    }

    async function saveIdentityKeyPair(keyPair) {
        validateEcdhKey(keyPair?.privateKey, "private", "privateKey");
        validateEcdhKey(keyPair?.publicKey, "public", "publicKey");
        await dbPut({
            id: IDENTITY_RECORD_ID,
            privateKey: keyPair.privateKey,
            publicKey: keyPair.publicKey,
            createdAt: new Date().toISOString()
        });
        return keyPair;
    }

    async function loadIdentityKeyPair() {
        const record = await dbGet(IDENTITY_RECORD_ID);
        if (!record) return null;
        validateEcdhKey(record.privateKey, "private", "stored privateKey");
        validateEcdhKey(record.publicKey, "public", "stored publicKey");
        return {
            privateKey: record.privateKey,
            publicKey: record.publicKey,
            createdAt: record.createdAt
        };
    }

    async function generateAndStoreIdentityKeyPair() {
        const keyPair = await generateIdentityKeyPair();
        await saveIdentityKeyPair(keyPair);
        return keyPair;
    }

    async function getOrCreateIdentityKeyPair() {
        const existing = await loadIdentityKeyPair();
        if (existing) return { ...existing, created: false };
        const keyPair = await generateAndStoreIdentityKeyPair();
        return { ...keyPair, created: true };
    }

    // IndexedDB stores the CryptoKey, while the original public bundle is retained for display.
    async function savePeerPublicKey(input) {
        const parsed = parsePublicKeyInput(input);
        const publicKey = await importPeerPublicKey(input);
        const fingerprint = await fingerprintPublicJwk(parsed.jwk);
        const bundleText = parsed.bundle
            ? JSON.stringify(parsed.bundle, null, 2)
            : await exportPublicKeyBundle(publicKey);
        await dbPut({
            id: PEER_RECORD_ID,
            publicKey,
            bundle: bundleText,
            fingerprint,
            importedAt: new Date().toISOString()
        });
        return { publicKey, bundle: bundleText, fingerprint };
    }

    async function loadPeerPublicKey() {
        const record = await dbGet(PEER_RECORD_ID);
        if (!record) return null;
        validateEcdhKey(record.publicKey, "public", "stored peer publicKey");
        return {
            publicKey: record.publicKey,
            bundle: record.bundle,
            fingerprint: record.fingerprint,
            importedAt: record.importedAt
        };
    }

    async function createSessionParameters() {
        requireSubtleCrypto();
        const sessionId = new Uint8Array(SESSION_ID_BYTES);
        const salt = new Uint8Array(SALT_BYTES);
        globalThis.crypto.getRandomValues(sessionId);
        globalThis.crypto.getRandomValues(salt);
        return {
            version: SESSION_VERSION,
            sessionId: bytesToBase64(sessionId),
            salt: bytesToBase64(salt)
        };
    }

    async function deriveDirectionalKey(hkdfKey, saltBytes, context, usages) {
        const info = new TextEncoder().encode(JSON.stringify({
            protocol: PROTOCOL_LABEL,
            version: SESSION_VERSION,
            ...context
        }));
        return globalThis.crypto.subtle.deriveKey(
            { name: "HKDF", hash: HASH, salt: saltBytes, info },
            hkdfKey,
            { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
            false,
            usages
        );
    }

    // params: { privateKey, peerPublicKey, localId, peerId, version, sessionId, salt }
    async function deriveSessionKeys(params) {
        requireSubtleCrypto();
        if (!params || typeof params !== "object") throw new TypeError("deriveSessionKeys requires a parameter object.");
        const { privateKey, peerPublicKey, localId, peerId, version, sessionId, salt } = params;
        validateEcdhKey(privateKey, "private", "privateKey");
        validateEcdhKey(peerPublicKey, "public", "peerPublicKey");
        if (version !== SESSION_VERSION) throw new TypeError(`Unsupported session version; expected ${SESSION_VERSION}.`);
        for (const [name, value] of [["localId", localId], ["peerId", peerId]]) {
            if (typeof value !== "string" || value.trim().length === 0 || value.length > 128) {
                throw new TypeError(`${name} must be a non-empty string of at most 128 characters.`);
            }
        }
        if (localId === peerId) throw new TypeError("localId and peerId must identify different participants.");
        if (typeof sessionId !== "string" || sessionId.length === 0 || sessionId.length > 256) {
            throw new TypeError("sessionId must be a non-empty string of at most 256 characters.");
        }
        const saltBytes = base64ToBytes(salt, "salt");
        if (saltBytes.length !== SALT_BYTES) throw new TypeError(`salt must decode to exactly ${SALT_BYTES} bytes.`);

        const secretBuffer = await globalThis.crypto.subtle.deriveBits(
            { name: "ECDH", public: peerPublicKey }, privateKey, 256
        );
        const secretBytes = new Uint8Array(secretBuffer);
        let hkdfKey;
        try {
            hkdfKey = await globalThis.crypto.subtle.importKey("raw", secretBytes, "HKDF", false, ["deriveKey"]);
        } finally {
            // Best effort only; Web Crypto/runtime internals may retain their own copies.
            secretBytes.fill(0);
        }

        const common = { sessionId };
        const [sendKey, receiveKey] = await Promise.all([
            deriveDirectionalKey(hkdfKey, saltBytes, { ...common, senderId: localId, recipientId: peerId }, ["encrypt"]),
            deriveDirectionalKey(hkdfKey, saltBytes, { ...common, senderId: peerId, recipientId: localId }, ["decrypt"])
        ]);
        return { version: SESSION_VERSION, sessionId, localId, peerId, sendKey, receiveKey };
    }

    return {
        generateIdentityKeyPair,
        saveIdentityKeyPair,
        loadIdentityKeyPair,
        generateAndStoreIdentityKeyPair,
        getOrCreateIdentityKeyPair,
        exportPublicKey,
        exportPublicKeyBundle,
        importPeerPublicKey,
        savePeerPublicKey,
        loadPeerPublicKey,
        fingerprintPublicJwk,
        createSessionParameters,
        deriveSessionKeys
    };
})();

globalThis.E2EEKeyManager = E2EEKeyManager;
