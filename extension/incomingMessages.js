// extension/incomingMessages.js
// Load this after whatsappAdapter.js and chat-ui.js in manifest.json content_scripts.
// Flow= observe WhatsApp DOM , find unseen "E2EE1:" messages , ask the background
// controller to decrypt (DECRYPT_MESSAGE) , pass the plaintext or the error to chat-ui.js.

(() => {
    "use strict";

    const MESSAGE_PREFIX = "E2EE1:";
    const SCAN_DELAY_MS = 250;

    // While the temporary shared test key is in use, your own sent messages can be
    // decrypted too, which is the only way to test on a single account. Set this to
    // false once real directional session keys are used 
    const INCLUDE_OUTGOING = false;

    // Duplicate protection.
    const processed = new Set();

    // Messages that failed only because a key was missing.
    const retryable = new Set();

    // Messages are decrypted one at a time
    let queue = Promise.resolve();

    let scanTimer = null;
    let extensionEnabled = null;
    let lastConversationName = null;

    // Text of one message bubble. 
    function getMessageText(messageElement) {
        if (!messageElement) {
            return null;
        }
        const textElement = messageElement.querySelector(
            '[data-testid="selectable-text"], span.selectable-text'
        );
        const text = ((textElement ?? messageElement).textContent ?? "").trim();

        if (text.startsWith(MESSAGE_PREFIX)) {
            const match = text.match(/^E2EE1:\{[\s\S]*\}/);
            if (match) {
                return match[0];
            }
        }
        return text;
    }

    function isOutgoingMessage(messageElement) {
        if (!messageElement) {
            return false;
        }
        if (messageElement.closest(".message-out")) {
            return true;
        }
        const idElement = messageElement.closest("[data-id]") ?? messageElement.querySelector("[data-id]");
        return idElement?.getAttribute("data-id")?.startsWith("true_") === true;
    }

    //chat-ui.js exposes globalThis.extraE2EEChatUI.
    function getChatUI() {
        return globalThis.extraE2EEChatUI;
    }

    function showDecrypted(plaintext) {
        const ui = getChatUI();
        if (ui && typeof ui.displayDecryptedMessage === "function") {
            ui.displayDecryptedMessage(plaintext);
        } else {
            console.log("[E2EE Incoming] Decrypted (chat-ui not available):", plaintext);
        }
    }

    function showError(message) {
        const ui = getChatUI();
        if (ui && typeof ui.displayError === "function") {
            ui.displayError(message);
        } else {
            console.error("[E2EE Incoming] Error (chat-ui not available):", message);
        }
    }

    async function requestDecrypt(ciphertext) {
        const response = await browser.runtime.sendMessage({
            type: "DECRYPT_MESSAGE",
            requestId: crypto.randomUUID(),
            payload: { ciphertext }
        });

        if (!response || response.status !== 0) {
            const error = new Error(response?.error?.message || "Decryption failed");
            error.code = response?.error?.code;
            throw error;
        }

        const plaintext = response.data?.plaintext;
        if (typeof plaintext !== "string") {
            throw new Error("Background returned invalid plaintext");
        }
        return plaintext;
    }

    async function handleEncryptedMessage(text, isOutgoing) {
        try {
            const plaintext = await requestDecrypt(text);
            showDecrypted(plaintext);
        } catch (error) {
            console.error("[E2EE Incoming] Could not decrypt message:", error.code, error.message);
            if (error.code === 302 || error.code === 303) {
                retryable.add(text);
            }
            // Failures on your own sent messages are expected once real session keys are
            // used, so do not show them to the user.
            if (!isOutgoing) {
                showError(error.message);
            }
        }
    }

    function scanMessages() {
        scanTimer = null;

        if (!extensionEnabled) {
            return;
        }

        // chat-ui clears its decrypted boxes when the conversation changes, so forget what we handled and decrypt the newly opened conversation again.
        const conversation = whatsappAdapter.getActiveConversation();
        const conversationName = conversation?.displayName ?? null;
        if (conversationName !== lastConversationName) {
            processed.clear();
            lastConversationName = conversationName;
        }
        if (!conversation) {
            return;
        }

        
        if (getChatUI() && !document.getElementById("extra-e2ee-decrypted")) {
            return;
        }

        for (const element of whatsappAdapter.getDisplayedMessages()) {
            const isOutgoing = isOutgoingMessage(element);
            if (isOutgoing && !INCLUDE_OUTGOING) {
                continue;
            }

            const text = getMessageText(element);
            if (typeof text !== "string" || !text.startsWith(MESSAGE_PREFIX)) {
                continue;
            }

            if (processed.has(text)) {
                continue;
            }
            processed.add(text);

            queue = queue.then(() => handleEncryptedMessage(text, isOutgoing));
        }
    }

    // WhatsApp mutates the dom constantly so batch the scans.
    function scheduleScan() {
        if (scanTimer !== null) {
            return;
        }
        scanTimer = setTimeout(scanMessages, SCAN_DELAY_MS);
    }

    async function loadExtensionState() {
        const response = await browser.runtime.sendMessage({
            type: "GET_EXTENSION_STATE",
            requestId: crypto.randomUUID(),
            payload: {}
        });

        if (!response || response.status !== 0) {
            throw new Error(response?.error?.message || "Could not load extension state");
        }
        extensionEnabled = response.data.enabled === true;
    }

    browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes.peerKeyUpdatedAt) {
            for (const text of retryable) {
                processed.delete(text);
            }
            retryable.clear();
            scheduleScan();
        }
        if (areaName === "local" && typeof changes.encryptionEnabled?.newValue === "boolean") {
            extensionEnabled = changes.encryptionEnabled.newValue;
            if (extensionEnabled) {
                // Messages skipped while disabled should now be decrypted.
                processed.clear();
                scheduleScan();
            }
        }
    });

    async function start() {
        try {
            await loadExtensionState();
        } catch (error) {
            console.error("[E2EE Incoming] Unable to load extension state:", error);
        }

        new MutationObserver(scheduleScan).observe(document.body, {
            childList: true,
            subtree: true
        });

        scheduleScan();
    }

    // Lets other code (e.g. after a key is imported) retry messages that failed earlier.
    globalThis.E2EEIncoming = {
        getMessageText,
        isOutgoingMessage,
        rescan() {
            processed.clear();
            scheduleScan();
        }
    };

    start();
})();