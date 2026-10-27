async function sendBackgroundRequest(type, payload = {}) {
    const request = {
        type: type,
        requestId: crypto.randomUUID(),
        payload: payload
    };

    const response = await chrome.runtime.sendMessage(request);

    if (!response || response.status !== 0) {
        throw new Error(
            response?.error?.message || "Background request failed"
        );
    }

    return response.data;
}

const encryptionToggle = document.getElementById("encryptionToggle");

const encryptionStatus = document.getElementById("encryptionStatus");

// Display the current encryption state when the popup opens.
async function loadEncryptionState() {
    try {
        const state = await sendBackgroundRequest("GET_EXTENSION_STATE");

        encryptionToggle.checked = state.enabled;
        encryptionStatus.textContent = state.enabled
            ? "Enabled"
            : "Disabled";

    } catch (error) {
        console.error("Unable to load encryption state:", error);
        encryptionToggle.disabled = true;
        encryptionStatus.textContent = "Status unavailable";
    }
}

// Update the encryption state when the user changes the toggle.
encryptionToggle.addEventListener("change", async function () {
    const requestedEnabled = encryptionToggle.checked;

    encryptionToggle.disabled = true;

    try {
        await sendBackgroundRequest("SET_EXTENSION_STATE", {
            enabled: requestedEnabled
        });

        encryptionStatus.textContent = requestedEnabled
            ? "Enabled"
            : "Disabled";

    } catch (error) {
        console.error("Unable to update encryption state:", error);

        // Restore the previous state if the request fails.
        encryptionToggle.checked = !requestedEnabled;
        encryptionStatus.textContent = "Unable to update";

    } finally {
        encryptionToggle.disabled = false;
    }
});

loadEncryptionState();

const publicKey = document.getElementById("publicKey");

async function loadPublicKey() {
    try {
        // Request the public key from the background controller.
        const data = await sendBackgroundRequest("GET_LOCAL_PUBLIC_KEY");

        // Display the public key in the popup.
        publicKey.value = data.publicKeyBundle;

    } catch (error) {
        console.error("Unable to load public key:", error);
        publicKey.value = "";
        alert("Unable to load your public key.");
    }
}

async function loadKeyStatus() {
    try {
        const data = await sendBackgroundRequest("GET_KEY_STATUS");

        document.getElementById("identityKeyStatus").textContent =
            data.identityKeyReady ? "Ready" : "Not ready";

        document.getElementById("peerKeyStatus").textContent =
            data.peerKeyReady ? "Ready" : "Not ready";

        document.getElementById("sessionKeyStatus").textContent =
            data.sessionReady ? "Ready" : "Not ready";

    } catch (error) {
        console.error("Unable to load key status:", error);

        document.getElementById("identityKeyStatus").textContent = "Unavailable";
        document.getElementById("peerKeyStatus").textContent = "Unavailable";
        document.getElementById("sessionKeyStatus").textContent = "Unavailable";
    }
}

loadPublicKey();
loadKeyStatus();

const copyButton = document.getElementById("copyPublicKey");

copyButton.addEventListener("click", async function () {
    if (publicKey.value.trim() === "") {
        alert("No public key available to copy. ");
        return;
    }

    try {
        await navigator.clipboard.writeText(publicKey.value);
        alert("Public key copied successfully!");

    } catch (error) {
        alert("Unable to copy the public key");
    }
});

const recipientPublicKey = document.getElementById("recipientPublicKey");

const saveRecipientKey = document.getElementById("saveRecipientKey");

const recipientKeyMessage = document.getElementById("recipientKeyMessage");

saveRecipientKey.addEventListener("click", async function () {
    const key = recipientPublicKey.value.trim();

    if (key === "") {
        recipientKeyMessage.className = "error";
        recipientKeyMessage.textContent =
            "Please enter the recipient's public key.";
        return;
    }

    try {
        await sendBackgroundRequest("SAVE_PEER_PUBLIC_KEY", {
            publicKeyBundle: key
        });

        // Notify WhatsApp content scripts that the recipient key changed.
        await chrome.storage.local.set({
            peerKeyUpdatedAt: Date.now()
        });

await loadKeyStatus();

        recipientKeyMessage.className = "success";
        recipientKeyMessage.textContent =
            "Recipient's public key saved successfully.";

    } catch (error) {
        console.error("Unable to save recipient key:", error);

        recipientKeyMessage.className = "error";
        recipientKeyMessage.textContent =
            error.message || "Unable to save recipient's public key.";
    }
});

async function loadRecipientKey() {
    try {
        const savedKey = await E2EEKeyManager.loadPeerPublicKey();

        if (savedKey) {
            recipientPublicKey.value = savedKey.bundle;
        }

    } catch (error) {
        console.error("Unable to load recipient key:", error);

        recipientKeyMessage.className = "error";
        recipientKeyMessage.textContent =
            "Unable to load the saved recipient key.";
    }
}

loadRecipientKey();
