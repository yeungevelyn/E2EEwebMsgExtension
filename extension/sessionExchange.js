// This file manages the encryption session used when sending messages.
// It creates a session, generates encryption keys, and reuses the session for future messages.
// The session ID and salt are included in encrypted messages so the receiver can decrypt them.
// Public keys are exchanged manually through the extension popup, so no server is needed.

// Error codes: 302 = own key is missing, 303 = contact's public key is missing,
// 304 = session creation failed.

// some integration notes:
// - Import this file after keyManager.js and crypto.js are loaded.
// - Use E2EESession.encryptOutgoing(plaintext) when handling outgoing messages.
// - Pass its returned payload to E2EECrypto.encodeMessagePayload(payload).
// - Use E2EESession.isSessionReady() to check if a session is available.
// - Call E2EESession.resetSession() when a key is replaced or regenerated.


const STORAGE_KEY = "e2eeSessionParams";

// Creates an error with a code that the extension can use to identify the problem.
function sessionError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

// Creates the session manager that handles session creation, encryption, and storage.
export function createSessionExchange({ keyManager, crypto: e2eeCrypto, storage } = {}) {
    // storage is optional: { get(key) -> Promise<any>, set(key, value) -> Promise, remove(key) -> Promise }
    let cached = null; // { params, session, localId, peerId }
    let pending = null; // stops two sends at once from creating two sessions

    // Loads the user's identity key and the contact's public key, then gets their fingerprints.
    async function loadIdentityAndPeer() {
        const identity = await keyManager.loadIdentityKeyPair();
        if (!identity) {
            throw sessionError(302, "You have no key pair yet. Generate your key in the extension popup.");
        }
        const peer = await keyManager.loadPeerPublicKey();
        if (!peer) {
            throw sessionError(303, "No contact public key imported. Import it in the extension popup.");
        }
        const localId = await keyManager.fingerprintPublicJwk(
            await keyManager.exportPublicKey(identity.publicKey)
        );
        return { identity, peer, localId, peerId: peer.fingerprint };
    }

    // Reads the saved session settings from storage, returning null if unavailable.
    async function readStoredParams() {
        if (!storage) return null;
        try {
            return (await storage.get(STORAGE_KEY)) ?? null;
        } catch {
            return null;
        }
    }

    // Saves the session settings so the same session can be reused after a restart.
    async function writeStoredParams(value) {
        if (!storage) return;
        try {
            await storage.set(STORAGE_KEY, value);
        } catch {
            // Not fatal: the session still works, it just will not survive a restart.
        }
    }

    // Reuses valid saved session settings or creates new ones, then derives the session keys.
    async function buildSession() {
        const { identity, peer, localId, peerId } = await loadIdentityAndPeer();

        // Reuse stored parameters only if they were made for this exact pair of keys.
        const stored = await readStoredParams();
        const reusable =
            stored &&
            stored.localId === localId &&
            stored.peerId === peerId &&
            typeof stored.sessionId === "string" &&
            typeof stored.salt === "string";

        const params = reusable
            ? { version: stored.version, sessionId: stored.sessionId, salt: stored.salt }
            : await keyManager.createSessionParameters();

        let session;
        try {
            session = await keyManager.deriveSessionKeys({
                privateKey: identity.privateKey,
                peerPublicKey: peer.publicKey,
                localId,
                peerId,
                version: params.version,
                sessionId: params.sessionId,
                salt: params.salt
            });
        } catch (error) {
            throw sessionError(304, `Could not create session: ${error.message}`);
        }

        if (!reusable) {
            await writeStoredParams({ ...params, localId, peerId });
        }
        return { params, session, localId, peerId };
    }

    // Returns the current session if the keys are unchanged, otherwise creates a new session.
    async function getOrCreateSession() {
        if (cached) {
            // Make sure the keys have not changed since the session was made.
            const { peer, localId } = await loadIdentityAndPeer();
            if (cached.localId === localId && cached.peerId === peer.fingerprint) {
                return cached;
            }
            cached = null;
        }
        if (!pending) {
            pending = buildSession()
                .then((result) => { cached = result; return result; })
                .finally(() => { pending = null; });
        }
        return pending;
    }

    // Encrypts a message using the session's sending key and adds the session details to the payload.
    async function encryptOutgoing(plaintext) {
        if (typeof plaintext !== "string" || plaintext.length === 0) {
            throw new TypeError("Plaintext must be a non-empty string.");
        }
        const { params, session } = await getOrCreateSession();
        const payload = await e2eeCrypto.encryptMessage(plaintext, session.sendKey);
        return {
            ...payload,
            version: params.version,
            sessionId: params.sessionId,
            salt: params.salt
        };
    }

    // Checks whether a session can be created or reused with the available keys.
    async function isSessionReady() {
        try {
            await getOrCreateSession();
            return true;
        } catch {
            return false;
        }
    }

    // Clears the current session and its saved settings when either user's key changes.
    async function resetSession() {
        cached = null;
        pending = null;
        if (storage) {
            try { await storage.remove(STORAGE_KEY); } catch { /* ignore */ }
        }
    }

    return { getOrCreateSession, encryptOutgoing, isSessionReady, resetSession };
}

// Default instance for the extension. Uses the globals set by keyManager.js / crypto.js
// and chrome.storage.local (falls back to browser.storage.local, which this repo uses).
// Creates a storage helper that uses the browser's local extension storage.
function defaultStorage() {
    const area = globalThis.browser?.storage?.local ?? globalThis.chrome?.storage?.local;
    if (!area) return null;
    return {
        // Reads one value from extension storage using its key.
        async get(key) { return (await area.get(key))[key]; },
        // Saves one value in extension storage using its key.
        async set(key, value) { await area.set({ [key]: value }); },
        // Deletes one value from extension storage using its key.
        async remove(key) { await area.remove(key); }
    };
}

// Creates the default session manager when the key manager and encryption tools are available.
if (globalThis.E2EEKeyManager && globalThis.E2EECrypto) {
    globalThis.E2EESession = createSessionExchange({
        keyManager: globalThis.E2EEKeyManager,
        crypto: globalThis.E2EECrypto,
        storage: defaultStorage()
    });
}